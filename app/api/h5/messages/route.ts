// app/api/h5/messages/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

const SENSITIVE_WORDS = ["博彩", "赌博", "赌场"]; // 先来个简单版本，后面你可以改成配置表

function containsSensitive(text: string) {
  return SENSITIVE_WORDS.some((w) => text.includes(w));
}

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const sessionId = body.sessionId as string | undefined;
    const text = (body.text as string | undefined)?.trim();
    const origin = (body.origin as string | undefined) || "customer"; // "customer" | "agent"

    if (!sessionId || !text) {
      return NextResponse.json(
        { ok: false, error: "BAD_REQUEST", message: "缺少 sessionId 或 text" },
        { status: 400 }
      );
    }

    if (containsSensitive(text)) {
      return NextResponse.json(
        {
          ok: false,
          error: "BLOCKED_BY_POLICY",
          message: "消息中包含敏感词，未能发送。",
        },
        { status: 400 }
      );
    }

    const session = await prisma.session.findUnique({
      where: { id: sessionId },
    });

    if (!session) {
      return NextResponse.json(
        { ok: false, error: "SESSION_NOT_FOUND" },
        { status: 404 }
      );
    }

    const now = new Date();
    const direction = origin === "customer" ? "in" : "out";

    // 如果 Message.openKfid / externalUserId 是 NOT NULL，
    // 用固定占位符保证不报错；如果在 schema 里是可选，就可以传 undefined
    const openKfidForH5 = "h5";
    const externalUserIdForH5 = sessionId;

    const msgId = `h5-${sessionId}-${now.getTime()}`;

    const message = await prisma.message.create({
      data: {
        msgId,
        openKfid: openKfidForH5,
        externalUserId: externalUserIdForH5,
        origin,
        direction,
        msgType: "text",
        sendTime: now,
        text,
        payload: JSON.stringify({ source: "h5", raw: body }),
        sessionId,
      },
    });

    // 更新 Session 的 lastMsg 信息
    await prisma.session.update({
      where: { id: sessionId },
      data: {
        lastMsgAt: now,
        lastMsgPreview: text.slice(0, 100),
        updatedAt: now,
        // channel: "h5", // 如果你想在第一次 H5 发消息时把 channel 改成 h5，可以加上这一行
      },
    });

    return NextResponse.json({ ok: true, message });
  } catch (err) {
    console.error("POST /api/h5/messages error", err);
    return NextResponse.json(
      { ok: false, error: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}
