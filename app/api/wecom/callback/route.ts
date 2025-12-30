// app/api/wecom/callback/route.ts
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { getWecomAccessToken } from "@/lib/wecom/token";
import { prisma } from "@/lib/db";
import { consumePendingVipBinding } from "@/lib/vipBindingState";

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

    const openKfid = String(open_kfid);
    const accessToken = await getWecomAccessToken();

    // 1) 通过 sync_msg 拉最近一批消息
    const syncResp = await fetch(
      `https://qyapi.weixin.qq.com/cgi-bin/kf/sync_msg?access_token=${encodeURIComponent(
        accessToken
      )}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          open_kfid: openKfid,
          limit: 1000,
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
        scene_param: m.scene_param,
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

    // 2) 把这次拉到的消息同步进 Session / Message 表
    for (const m of list) {
      const msgId = String(m.msgid || "");
      const externalUserId = m.external_userid
        ? String(m.external_userid)
        : "";
      const originCode = m.origin;
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

      let text: string | null = null;
      if (msgType === "text") {
        text = m.text?.content ?? null;
      }

      // ==== 2.0 解析 scene_param -> vipNumber（如果有的话）====
      let vipGuest: any = null;
      try {
        const rawScene: string | undefined =
          m.scene_param || (m as any).scene || (m as any).session_state;

        if (rawScene && typeof rawScene === "string") {
          const prefix = "vip:";
          const idx = rawScene.indexOf(prefix);
          if (idx >= 0) {
            const vipNumber = rawScene.slice(idx + prefix.length).trim();
            if (vipNumber) {
              vipGuest = await prisma.vipGuest.findUnique({
                where: { vipNumber },
              });
            }
          }
        }
      } catch (e) {
        console.error("❌ failed to parse/bind VIP from scene_param:", e);
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
        const updateData: any = {
          lastMsgAt: sendTime,
          lastMsgPreview: text ?? `[${msgType}]`,
          unreadCount:
            direction === "in" ? { increment: 1 } : undefined,
        };

        const createData: any = {
          openKfid,
          externalUserId,
          displayName: externalUserId,
          lastMsgAt: sendTime,
          lastMsgPreview: text ?? `[${msgType}]`,
          unreadCount: direction === "in" ? 1 : 0,
          channel: "wechat",
        };

        // 如果这次消息带了 VIP 信息，就把 vipNumber / vipGuestId 写进 Session
        if (vipGuest) {
          updateData.vipNumber = vipGuest.vipNumber;
          updateData.vipGuestId = vipGuest.id;
          createData.vipNumber = vipGuest.vipNumber;
          createData.vipGuestId = vipGuest.id;

          const displayNameFromVip =
            vipGuest.preferredName || vipGuest.fullName;
          if (displayNameFromVip) {
            updateData.displayName = displayNameFromVip;
            createData.displayName = displayNameFromVip;
          }
        }

        session = await prisma.session.upsert({
          where: {
            openKfid_externalUserId: {
              openKfid,
              externalUserId,
            },
          },
          update: updateData,
          create: createData,
        });
      } catch (e) {
        console.error("❌ failed to upsert session in callback:", e);
        continue;
      }

      // 2.2 写入 Message 表（payload 一定要是字符串）
      try {
        await prisma.message.create({
          data: {
            msgId,
            openKfid,
            externalUserId,
            origin,
            msgType,
            sendTime,
            payload: JSON.stringify(m),
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

      if (origin === "customer" && msgType === "text" && text) {
        lastNewCustomerText = {
          openKfid,
          externalUserId,
          content: text,
          sessionId: session.id,
        };
      }
    }

    // 2.3 如果这次有新的客户文本消息，并且有挂起的 VIP 绑定，就把 VIP 绑定到这个 externalUserId 上
    if (lastNewCustomerText) {
      try {
        const pending = consumePendingVipBinding(openKfid);
        if (pending) {
          await prisma.session.updateMany({
            where: {
              openKfid,
              externalUserId: lastNewCustomerText.externalUserId,
            },
            data: {
              vipNumber: pending.vipNumber,
              vipGuestId: pending.vipGuestId,
            },
          });

          console.log("✅ bound VIP to session via pending state:", {
            openKfid,
            externalUserId: lastNewCustomerText.externalUserId,
            vipNumber: pending.vipNumber,
          });
        }
      } catch (e) {
        console.error("❌ failed to bind VIP from pending state:", e);
      }
    }

    // 3) 简单自动回复
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
              payload: JSON.stringify(sendData),
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

    return new NextResponse("success", { status: 200 });
  } catch (e: any) {
    console.error("callback bot error:", e);
    return new NextResponse("success", { status: 200 });
  }
}
