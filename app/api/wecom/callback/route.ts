// app/api/wecom/callback/route.ts
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { getWecomAccessToken } from "@/lib/wecom/token";
import { prisma } from "@/lib/db";

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
    return new NextResponse(`fail: ${e?.message || String(e)}`, {
      status: 400,
    });
  }
}

// 收到事件通知：拉消息 + 写入 Session 表 + 自动回一条
export async function POST(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const msg_signature = searchParams.get("msg_signature") || "";
    const timestamp = searchParams.get("timestamp") || "";
    const nonce = searchParams.get("nonce") || "";

    const rawXml = await req.text();
    const crypt = getCrypt();
    const decryptedXml = crypt.decryptMsg(
      msg_signature,
      timestamp,
      nonce,
      rawXml
    );
    const obj = x2o(decryptedXml);

    console.log("✅ callback decrypted:", JSON.stringify(obj, null, 2));

    const token = obj?.xml?.Token;
    const open_kfid = obj?.xml?.OpenKfId;
    const eventCreateTime = Number(obj?.xml?.CreateTime || "0");

    // 不是微信客服事件就忽略
    if (!token || !open_kfid) {
      return new NextResponse("success", { status: 200 });
    }

    const openKfid = String(open_kfid);

    const accessToken = await getWecomAccessToken();

    // 1) 拉消息
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
          limit: 50, // 最近一小段就够了
        }),
      }
    );

    const syncData = await syncResp.json();

    if (syncData?.errcode !== 0) {
      console.log("❌ sync_msg error:", syncData);
      return new NextResponse("success", { status: 200 });
    }

    const list: any[] = syncData?.msg_list || [];

    console.log(
      "sync_msg list (short):",
      list.map((m: any) => ({
        msgid: m.msgid,
        send_time: m.send_time,
        origin: m.origin,
        msgtype: m.msgtype,
        text: m.text?.content,
        external_userid: m.external_userid,
      }))
    );

    // 先拿出所有「外部客户的文本消息」
    const baseCandidates = list.filter(
      (m: any) =>
        m.msgtype === "text" &&
        m.text?.content &&
        m.external_userid &&
        m.origin === 3 // 3 = external user
    );

    // 再根据这次事件的 CreateTime 做一次“时间过滤”
    // 只保留 send_time >= eventCreateTime - 5 秒 的
    const candidates = baseCandidates.filter((m: any) => {
      if (!eventCreateTime || typeof m.send_time !== "number") return true;
      // 给一点余量，防止时间戳有1~2秒偏差
      return m.send_time >= eventCreateTime - 5;
    });

    if (candidates.length === 0) {
      console.log(
        "no customer text messages for this event, baseCandidates =",
        baseCandidates.length
      );
      return new NextResponse("success", { status: 200 });
    }

    // 在“本次事件范围内”的消息里，选 send_time 最大的那一条
    const lastText = candidates.reduce((latest: any, cur: any) => {
      if (!latest) return cur;
      return cur.send_time > latest.send_time ? cur : latest;
    }, null as any);

    const touser = lastText.external_userid;
    const content = lastText.text.content;
    const sendTime =
      typeof lastText.send_time === "number"
        ? new Date(lastText.send_time * 1000)
        : new Date();

    // 2) 写入 / 更新 Session 表
    try {
      await prisma.session.upsert({
        where: {
          openKfid_externalUserId: {
            openKfid,
            externalUserId: touser,
          },
        },
        update: {
          lastMsgAt: sendTime,
          lastMsgPreview: content,
          unreadCount: { increment: 1 },
        },
        create: {
          openKfid,
          externalUserId: touser,
          displayName: touser,
          lastMsgAt: sendTime,
          lastMsgPreview: content,
          unreadCount: 1,
          channel: "wechat",
        },
      });

      console.log(
        "✅ session upserted:",
        JSON.stringify({ openKfid, touser, content }, null, 2)
      );
    } catch (dbErr) {
      console.error("❌ failed to upsert session:", dbErr);
      // 不影响回调返回
    }

    // 3) 回消息（echo）
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
    return new NextResponse("success", { status: 200 });
  }
}

