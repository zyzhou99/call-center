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

// ====== 新增：1 分鐘未回覆自動提示相關 ======
const AUTO_REPLY_DELAY_MS = 60 * 1000;
const AUTO_REPLY_TEXT =
  "尊敬的贵宾，当前正值服务高峰，請您稍等片刻。";

type NoReplyTimer = ReturnType<typeof setTimeout>;
const noReplyTimers = new Map<string, NoReplyTimer>();

function scheduleNoAgentReplyReminder(opts: {
  sessionId: string;
  openKfid: string;
  externalUserId: string;
  lastCustomerSendTime: Date;
}) {
  const key = opts.sessionId;

  // 如果這個會話之前已經設置過計時器，先清掉
  const existing = noReplyTimers.get(key);
  if (existing) {
    clearTimeout(existing);
    noReplyTimers.delete(key);
  }

  const timeout = setTimeout(() => {
    (async () => {
      noReplyTimers.delete(key);

      try {
        // 1) 檢查這條客戶消息之後，有沒有客服的輸出消息
        const agentReplyCount = await prisma.message.count({
          where: {
            sessionId: opts.sessionId,
            origin: "agent",
            direction: "out",
            sendTime: { gt: opts.lastCustomerSendTime },
          },
        });

        if (agentReplyCount > 0) {
          // 已經有客服回覆了，就不發自動提示
          console.log(
            "[no-reply auto] agent already replied, skip. sessionId=",
            opts.sessionId
          );
          return;
        }

        // 2) 沒有客服回覆 -> 發自動提示（企業微信）
        const accessToken = await getWecomAccessToken();
        const sendResp = await fetch(
          `https://qyapi.weixin.qq.com/cgi-bin/kf/send_msg?access_token=${encodeURIComponent(
            accessToken
          )}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              open_kfid: opts.openKfid,
              touser: opts.externalUserId,
              msgtype: "text",
              text: { content: AUTO_REPLY_TEXT },
            }),
          }
        );

        const sendData = await sendResp.json();
        console.log(
          "✅ no-reply auto message send_msg:",
          sendData
        );

        // 3) 把這條自動提示寫入 Message 表
        const botMsgId = String(
          sendData.msgid || `no-reply-${Date.now()}`
        );

        await prisma.message.create({
          data: {
            msgId: botMsgId,
            openKfid: opts.openKfid,
            externalUserId: opts.externalUserId,
            origin: "bot",
            msgType: "text",
            sendTime: new Date(),
            payload: JSON.stringify(sendData),
            direction: "out",
            text: AUTO_REPLY_TEXT,
            sessionId: opts.sessionId,
          },
        });

        console.log(
          "✅ saved no-reply auto message:",
          botMsgId,
          AUTO_REPLY_TEXT
        );
      } catch (e) {
        console.error("❌ no-reply auto message failed:", e);
      }
    })();
  }, AUTO_REPLY_DELAY_MS);

  noReplyTimers.set(key, timeout);
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

// 收到事件通知：拉消息 + 写入 Session / Message 表 + 欢迎语自动回复
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

    console.log(
      "[wecom callback] openKfid =",
      openKfid,
      "token =",
      tokenFromEvent
    );

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
        session_state: (m as any).session_state,
      }))
    );

    // 用来记录“本次确实新出现的、最后一条客户侧消息”（用於 VIP 歡迎語）
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

        console.log("[callback] rawScene for msg", msgId, "=", rawScene);

        if (rawScene && typeof rawScene === "string") {
          const prefix = "vip:";
          const idx = rawScene.indexOf(prefix);
          if (idx >= 0) {
            const vipNumber = rawScene.slice(idx + prefix.length).trim();
            console.log(
              "[callback] parsed vipNumber from scene_param:",
              vipNumber
            );

            if (vipNumber) {
              vipGuest = await prisma.vipGuest.findUnique({
                where: { vipNumber },
              });
              if (vipGuest) {
                console.log(
                  "[callback] found vipGuest from scene_param:",
                  vipGuest.vipNumber
                );
              } else {
                console.log(
                  "[callback] vipGuest not found for vipNumber:",
                  vipNumber
                );
              }
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
      let savedMessage: any = null;
      try {
        savedMessage = await prisma.message.create({
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

      // ⭐ 新增：1 分鐘無客服回覆自動提示（只對客戶文字消息啟動）
      if (origin === "customer" && msgType === "text" && text && savedMessage) {
        scheduleNoAgentReplyReminder({
          sessionId: session.id,
          openKfid,
          externalUserId,
          lastCustomerSendTime: sendTime,
        });
      }

      // ⭐ VIP 歡迎語這裡維持之前的邏輯：只要是客戶端方向的消息（包括進入會話 event），
      //    就視為本次互動，用來觸發 pending VIP 綁定 + 歡迎語。
      if (origin === "customer") {
        lastNewCustomerText = {
          openKfid,
          externalUserId,
          content: text ?? "",
          sessionId: session.id,
        };
      }
    }

    // 2.3 如果这次有新的客户侧消息，并且有挂起的 VIP 绑定，就把 VIP 绑定到这个 externalUserId 上
    //     并发送一条高端酒店欢迎语
    if (lastNewCustomerText) {
      try {
        let pending: any = null;

        // ⭐ 先用 Token 試圖讀取 pending，這對應的是「以 config_id / Token 為 key 存的方案」
        if (tokenFromEvent) {
          pending = consumePendingVipBinding(String(tokenFromEvent));
          if (pending) {
            console.log(
              "✅ found pending VIP via Token:",
              tokenFromEvent,
              pending.vipNumber
            );
          }
        }

        // ⭐ 如果 Token 沒取到，再用 openKfid 試一次（對應你之前 openKfid 為 key 的實現）
        if (!pending) {
          pending = consumePendingVipBinding(openKfid);
          if (pending) {
            console.log(
              "✅ found pending VIP via openKfid:",
              openKfid,
              pending.vipNumber
            );
          }
        }

        if (!pending) {
          console.log(
            "ℹ️ no pending VIP binding for Token/openKfid:",
            tokenFromEvent,
            openKfid
          );
        } else {
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

          // 绑定成功后，根据 VIP 信息发送欢迎语
          let vipGuestForWelcome: any = null;
          try {
            vipGuestForWelcome = await prisma.vipGuest.findUnique({
              where: { id: pending.vipGuestId },
            });
          } catch (e) {
            console.error("❌ failed to load vipGuest for welcome:", e);
          }

          const nameFromVip =
            vipGuestForWelcome?.preferredName?.trim() ||
            vipGuestForWelcome?.fullName?.trim() ||
            "";

          const welcomeText = nameFromVip
            ? `尊贵的 ${nameFromVip} 贵宾，欢迎入住永利皇宫。我是您的专属礼宾 Joye，竭诚为您服务。`
            : `尊贵的贵宾，欢迎入住永利皇宫。我是您的专属礼宾 Joye，竭诚为您服务。`;

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
                  text: { content: welcomeText },
                }),
              }
            );

            const sendData = await sendResp.json();
            console.log("✅ welcome auto-reply send_msg:", sendData);

            try {
              const botMsgId = String(
                sendData.msgid || `welcome-${Date.now()}`
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
                  text: welcomeText,
                  sessionId: lastNewCustomerText.sessionId,
                },
              });

              console.log(
                "✅ saved welcome auto-reply:",
                botMsgId,
                welcomeText
              );
            } catch (e) {
              console.error(
                "❌ failed to save welcome auto-reply:",
                e
              );
            }
          } catch (e) {
            console.error("❌ welcome auto-reply failed:", e);
          }
        }
      } catch (e) {
        console.error("❌ failed to bind VIP from pending state:", e);
      }
    }

    // 不再发送「已收到：xxx」的自动回复
    return new NextResponse("success", { status: 200 });
  } catch (e: any) {
    console.error("callback bot error:", e);
    return new NextResponse("success", { status: 200 });
  }
}
