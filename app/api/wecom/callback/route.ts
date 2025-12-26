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

// 企业微信后台“保存配置”时的 URL 验证
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

// 收到事件通知：拉消息 + 写入 Session / Message 表 + 简单自动回复
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

    const tokenFromEvent = obj?.xml?.Token;
    const open_kfid = obj?.xml?.OpenKfId;

    // 不是微信客服的事件就直接忽略掉
    if (!tokenFromEvent || !open_kfid) {
      console.log("not kf_msg_or_event, ignore");
      return new NextResponse("success", { status: 200 });
    }

    const syncToken = String(tokenFromEvent);
    const openKfid = String(open_kfid);

    const accessToken = await getWecomAccessToken();

    // 1) 通过 sync_msg 拉这次事件相关的消息
    const syncResp = await fetch(
      `https://qyapi.weixin.qq.com/cgi-bin/kf/sync_msg?access_token=${encodeURIComponent(
        accessToken
      )}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          open_kfid,
          token: syncToken,
          cursor: "",
          limit: 100, // 一般一次不会很多，100 足够
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

    // 用来记录“本次确实新出现的、最后一条客户文本消息”
    let lastNewCustomerText:
      | {
          openKfid: string;
          externalUserId: string;
          content: string;
          sessionId: string;
        }
      | null = null;

    // 2) 把这次拉到的消息全部同步进 Session / Message 表
    for (const m of list) {
      const msgId = String(m.msgid || "");
      const externalUserId = m.external_userid
        ? String(m.external_userid)
        : "";
      const originCode = m.origin; // 3=外部客户, 4=接待人员，其它值暂时归为 other
      const msgType = m.msgtype;
      const sendTsSec = typeof m.send_time === "number" ? m.send_time : 0;
      const sendTime = sendTsSec ? new Date(sendTsSec * 1000) : new Date();

      if (!msgId || !msgType || !externalUserId) {
        continue;
      }

      let origin: string = "other";
      let direction: "in" | "out" = "in";

      if (originCode === 3) {
        origin = "customer";
        direction = "in";
      } else if (originCode === 4) {
        origin = "agent";
        direction = "out";
      } else if (originCode === 1 || originCode === 2) {
        origin = "bot";
      }

      // 文本内容
      let text: string | null = null;
      if (msgType === "text") {
        text = m.text?.content ?? null;
      }

      // 先看 DB 里是不是已经有这条 msgId（避免重复写入）
      let exists = null;
      try {
        exists = await prisma.message.findUnique({
          where: { msgId },
        });
      } catch (e) {
        console.error("❌ failed to query message:", e);
      }

      if (exists) {
        console.log("ℹ️ message already exists, skip:", msgId);
        continue;
      }

      // 2.1 upsert Session（按 openKfid + externalUserId）
      let session: any = null;
      try {
        session = await prisma.session.upsert({
          where: {
            openKfid_externalUserId: {
              openKfid,
              externalUserId,
            },
          },
          update: {
            lastMsgAt: sendTime,
            lastMsgPreview: text ?? `[${msgType}]`,
            // 客户来的消息才 +1 未读
            unreadCount:
              direction === "in" ? { increment: 1 } : undefined,
          },
          create: {
            openKfid,
            externalUserId,
            displayName: externalUserId,
            lastMsgAt: sendTime,
            lastMsgPreview: text ?? `[${msgType}]`,
            unreadCount: direction === "in" ? 1 : 0,
            channel: "wechat",
          },
        });
      } catch (e) {
        console.error("❌ failed to upsert session in callback:", e);
        // session 挂了就没办法写 Message，只能跳过
        continue;
      }

      // 2.2 写入 Message 表
      try {
        await prisma.message.create({
          data: {
            msgId,
            openKfid,
            externalUserId,
            origin,
            msgType,
            sendTime,
            payload: m as any,
            direction,
            text,
            sessionId: session.id,
          },
        });

        console.log(
          "✅ saved message:",
          msgId,
          text ?? `[${msgType}]`,
          origin
        );
      } catch (e) {
        console.error("❌ failed to create message:", e);
      }

      // 记录“本次真正新出现的客户文本消息”，用于后面的自动回复
      if (origin === "customer" && msgType === "text" && text) {
        lastNewCustomerText = {
          openKfid,
          externalUserId,
          content: text,
          sessionId: session.id,
        };
      }
    }

    // 3) 简单自动回复：
    //    这里只做“收到一条新的客户消息，就回一条：已收到：xxx”
    //    不再做 1 分钟判断，先保证链路稳定。
    if (lastNewCustomerText) {
      const autoText = `已收到：${lastNewCustomerText.content}`;

      try {
        const sendResp = await fetch(
          `https://qyapi.weixin.qq.com/cgi-bin/kf/send_msg?access_token=${encodeURIComponent(
            accessToken
          )}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              open_kfid: lastNewCustomerText.openKfid,
              touser: lastNewCustomerText.externalUserId,
              msgtype: "text",
              text: { content: autoText },
            }),
          }
        );

        const sendData = await sendResp.json();
        console.log("✅ auto-reply send_msg:", sendData);

        // 把机器人这条回复也写进 Message
        try {
          const botMsgId = String(
            sendData.msgid || `bot-${Date.now()}`
          );
          await prisma.message.create({
            data: {
              msgId: botMsgId,
              openKfid: lastNewCustomerText.openKfid,
              externalUserId: lastNewCustomerText.externalUserId,
              origin: "bot",
              msgType: "text",
              sendTime: new Date(),
              payload: sendData as any,
              direction: "out",
              text: autoText,
              sessionId: lastNewCustomerText.sessionId,
            },
          });

          console.log("✅ saved bot auto-reply:", botMsgId, autoText);
        } catch (e) {
          console.error("❌ failed to save bot auto-reply:", e);
        }
      } catch (e) {
        console.error("❌ auto-reply failed:", e);
      }
    }

    // 一定要快速返回 success，否则企微会重试
    return new NextResponse("success", { status: 200 });
  } catch (e: any) {
    console.error("callback bot error:", e);
    return new NextResponse("success", { status: 200 });
  }
}
