// app/api/wecom/kf/send/route.ts
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { getWecomAccessToken } from "@/lib/wecom/token";
import { prisma } from "@/lib/db";

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const open_kfid = body.open_kfid as string;
    const touser = body.touser as string; // external_userid
    const content = body.content as string;

    if (!open_kfid || !touser || !content) {
      return NextResponse.json(
        { ok: false, error: "Missing open_kfid / touser / content" },
        { status: 400 }
      );
    }

    const accessToken = await getWecomAccessToken();

    const payload = {
      open_kfid,
      touser,
      msgtype: "text",
      text: { content },
    };

    // 1) 先发给企微
    const resp = await fetch(
      `https://qyapi.weixin.qq.com/cgi-bin/kf/send_msg?access_token=${encodeURIComponent(
        accessToken
      )}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }
    );

    const data = await resp.json();

    if (data?.errcode !== 0) {
      console.error("❌ kf/send_msg error:", data);
      return NextResponse.json(
        { ok: false, error: "wecom_send_failed", detail: data },
        { status: 500 }
      );
    }

    const openKfid = open_kfid;
    const now = new Date();
    const msgId = String(data.msgid || `local-${Date.now()}`);

    // 2) 更新 / 创建 Session
    let session: any = null;
    try {
      session = await prisma.session.upsert({
        where: {
          openKfid_externalUserId: {
            openKfid,
            externalUserId: touser,
          },
        },
        update: {
          lastMsgAt: now,
          lastMsgPreview: content,
          // 这里不改 unreadCount，未读是客户的
        },
        create: {
          openKfid,
          externalUserId: touser,
          displayName: touser,
          lastMsgAt: now,
          lastMsgPreview: content,
          unreadCount: 0,
          channel: "wechat",
        },
      });

      console.log(
        "✅ session upserted (agent):",
        JSON.stringify({ openKfid, touser, content }, null, 2)
      );
    } catch (e) {
      console.error("❌ failed to upsert session in kf/send:", e);
    }

    // 3) 写入 Message 表（direction = 'out'）
    try {
      if (session) {
        await prisma.message.upsert({
          where: { msgId },
          update: {
            sendTime: now,
            text: content,
            payload: JSON.stringify(data),   // ✅ 存字符串
          },
          create: {
            msgId,
            openKfid,
            externalUserId: touser,
            origin: "agent",
            msgType: "text",
            sendTime: now,
            payload: JSON.stringify(data),   // ✅ 存字符串
            direction: "out",
            text: content,
            sessionId: session.id,
          },
        });

        console.log(
          "✅ message upserted (out):",
          JSON.stringify(
            {
              msgId,
              openKfid,
              externalUserId: touser,
              content,
            },
            null,
            2
          )
        );
      } else {
        console.warn(
          "⚠️ session not found when inserting agent message, skip Message.create"
        );
      }
    } catch (msgErr) {
      console.error("❌ failed to upsert agent message:", msgErr);
    }

    return NextResponse.json({ ok: true, data });
  } catch (e: any) {
    console.error("kf/send route error:", e);
    return NextResponse.json(
      { ok: false, error: e?.message ?? String(e) },
      { status: 500 }
    );
  }
}
