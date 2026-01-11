// app/api/h5/sessions/[id]/messages/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";

interface RouteParams {
  params: { id: string };
}

// 映射成前端 ChatPanel / inbox 用的 Message 結構
function mapDbMessageToUi(m: any, sessionId: string) {
  const ts =
    m.sendTime instanceof Date ? m.sendTime.getTime() : Date.now();

  return {
    id: m.id,
    conversationId: sessionId,
    direction: m.direction === "out" ? "out" : "in",
    text: m.text || "",
    timestamp: ts,
    timeLabel: new Date(ts).toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
    }),
  };
}

/**
 * GET /api/h5/sessions/[id]/messages?take=100
 * 拉取某個 H5 Session 的消息（包含：
 * - channel = "webchat"（瀏覽器 H5）
 * - channel = "wechat"（mode=h5 下，微信內打開 H5 的那一種）
 */
export async function GET(req: NextRequest, { params }: RouteParams) {
  try {
    const sessionId = params.id;
    if (!sessionId) {
      return NextResponse.json(
        { ok: false, error: "MISSING_SESSION_ID" },
        { status: 400 }
      );
    }

    const { searchParams } = new URL(req.url);
    const takeParam = searchParams.get("take");
    const take = takeParam ? Math.min(Number(takeParam) || 100, 200) : 100;

    const session = await prisma.session.findUnique({
      where: { id: sessionId },
    });

    if (!session) {
      return NextResponse.json(
        { ok: false, error: "SESSION_NOT_FOUND" },
        { status: 404 }
      );
    }

    const messages = await prisma.message.findMany({
      where: { sessionId },
      orderBy: { sendTime: "asc" },
      take,
    });

    const payload = messages.map((m) => mapDbMessageToUi(m, sessionId));

    return NextResponse.json(
      { ok: true, messages: payload },
      { status: 200 }
    );
  } catch (err) {
    console.error("Error in GET /api/h5/sessions/[id]/messages:", err);
    return NextResponse.json(
      { ok: false, error: "SERVER_ERROR" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/h5/sessions/[id]/messages
 *
 * body:
 *  { text: string, from: "guest" | "agent" | "system" }
 *
 * - guest  => 方向為 in，unreadCount 需要 +1
 * - agent  => 方向為 out，不動 unreadCount
 * - system => 方向為 out，不動 unreadCount
 *
 * ✨ 重點：不管這個 session 是 channel = "webchat" 還是 "wechat"
 * 只要是 from = "guest"，都要給 session.unreadCount +1，
 * 這樣 inbox 的小紅點才會隨後續消息正常跳。
 */
export async function POST(req: NextRequest, { params }: RouteParams) {
  try {
    const sessionId = params.id;
    if (!sessionId) {
      return NextResponse.json(
        { ok: false, error: "MISSING_SESSION_ID" },
        { status: 400 }
      );
    }

    const body = (await req.json().catch(() => null)) as any;
    const rawText = typeof body?.text === "string" ? body.text : "";
    const text = rawText.trim();

    if (!text) {
      return NextResponse.json(
        { ok: false, error: "EMPTY_TEXT" },
        { status: 400 }
      );
    }

    const from =
      typeof body?.from === "string" ? body.from.toLowerCase() : "guest";

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

    const direction = from === "agent" || from === "system" ? "out" : "in";
    const origin =
      from === "agent"
        ? "agent"
        : from === "system"
        ? "system"
        : "external";

    const msgId = `h5-${sessionId}-${now.getTime()}`;

    const created = await prisma.message.create({
      data: {
        msgId,
        openKfid: session.openKfid,
        externalUserId: session.externalUserId,
        origin,
        msgType: "text",
        sendTime: now,
        payload: JSON.stringify({
          type: "h5_text",
          from,
          text,
        }),
        direction,
        text,
        hasSensitive: false,
        sensitiveHits: null,
        sessionId: session.id,
      },
    });

    // ⭐ 重點：客人發消息才需要增加 unreadCount
    const shouldIncreaseUnread = direction === "in";

    const nextUnread = shouldIncreaseUnread
      ? (session.unreadCount ?? 0) + 1
      : session.unreadCount ?? 0;

    await prisma.session.update({
      where: { id: session.id },
      data: {
        lastMsgAt: now,
        lastMsgPreview: text,
        unreadCount: nextUnread,
      },
    });

    return NextResponse.json(
      {
        ok: true,
        message: mapDbMessageToUi(created, sessionId),
      },
      { status: 200 }
    );
  } catch (err) {
    console.error("Error in POST /api/h5/sessions/[id]/messages:", err);
    return NextResponse.json(
      { ok: false, error: "SERVER_ERROR" },
      { status: 500 }
    );
  }
}
