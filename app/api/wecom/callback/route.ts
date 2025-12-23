export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { getWecomAccessToken } from "@/lib/wecom/token"; // ✅ 关键：把它 import 进来

const WXBizMsgCrypt = require("wxcrypt");
const { x2o } = require("wxcrypt");

function getCrypt() {
  const corpId = process.env.WECOM_CORP_ID!;
  const token = process.env.WECOM_CALLBACK_TOKEN!;
  const aesKey = process.env.WECOM_ENCODING_AES_KEY!;
  return new WXBizMsgCrypt(token, aesKey, corpId);
}

// 企业微信保存配置时 GET 验证
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const msg_signature = searchParams.get("msg_signature") || "";
    const timestamp = searchParams.get("timestamp") || "";
    const nonce = searchParams.get("nonce") || "";
    const echostr = searchParams.get("echostr") || "";

    const crypt = getCrypt();
    const plain = crypt.verifyURL(
      msg_signature,
      timestamp,
      nonce,
      decodeURIComponent(echostr)
    );

    return new NextResponse(plain, { status: 200 });
  } catch (e: any) {
    return new NextResponse(`fail: ${e?.message || String(e)}`, { status: 400 });
  }
}

// 收到事件通知：自动拉消息 + 自动回一条（echo）
export async function POST(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const msg_signature = searchParams.get("msg_signature") || "";
    const timestamp = searchParams.get("timestamp") || "";
    const nonce = searchParams.get("nonce") || "";

    const rawXml = await req.text();
    const crypt = getCrypt();
    const decryptedXml = crypt.decryptMsg(msg_signature, timestamp, nonce, rawXml);
    const obj = x2o(decryptedXml);

    console.log("✅ callback decrypted:", JSON.stringify(obj, null, 2));

    const token = obj?.xml?.Token;
    const open_kfid = obj?.xml?.OpenKfId;

    // 不是微信客服事件就忽略
    if (!token || !open_kfid) {
      return new NextResponse("success", { status: 200 });
    }

    // ✅ 用你项目里已经跑通 kf/accounts 的 token 方法
    const accessToken = await getWecomAccessToken();

    // 1) 拉消息（cursor 先空，POC 阶段 OK）
    const syncResp = await fetch(
      `https://qyapi.weixin.qq.com/cgi-bin/kf/sync_msg?access_token=${encodeURIComponent(
        accessToken
      )}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token,
          open_kfid,
          cursor: "",
          limit: 20,
        }),
      }
    );

    const syncData = await syncResp.json();

    if (syncData?.errcode !== 0) {
      console.log("❌ sync_msg error:", syncData);
      return new NextResponse("success", { status: 200 });
    }

    const list = syncData?.msg_list || [];
    const lastText = [...list]
      .reverse()
      .find((m: any) => m.msgtype === "text" && m.text?.content && m.external_userid);

    if (!lastText) return new NextResponse("success", { status: 200 });

    const touser = lastText.external_userid; // ✅ send_msg 需要 touser
    const content = lastText.text.content;

    // 2) 回消息
    const sendResp = await fetch(
      `https://qyapi.weixin.qq.com/cgi-bin/kf/send_msg?access_token=${encodeURIComponent(
        accessToken
      )}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          open_kfid,
          touser,
          msgtype: "text",
          text: { content: `已收到：${content}` },
        }),
      }
    );

    const sendData = await sendResp.json();
    console.log("✅ send_msg:", sendData);

    return new NextResponse("success", { status: 200 });
  } catch (e: any) {
    console.error("callback bot error:", e);
    // 企微要求快速返回 success，否则会重试
    return new NextResponse("success", { status: 200 });
  }
}
