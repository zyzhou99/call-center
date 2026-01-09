// app/api/h5/sessions/[id]/messages/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";

interface RouteParams {
  params: { id: string };
}

// 映射成前端 ChatPanel 用的 Message 結構
function mapDbMessageToUiMessage(m: any) {
  const sendTime =
    m.sendTime instanceof Date ? m.sendTime : new Date(m.sendTime);

  return {
    id: m.id,
    conversationId: m.sessionId,
    direction: m.direction === "out" ? "out" : "in", // out: concierge, in: VIP
    text: m.text || "",
    timeLabel: sendTime.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
    }),
    timestamp: sendTime.getTime(),
  };
}

// 拉 H5 / webchat 會話的所有消息（Inbox & /vip-chat 都會用到）
export async function GET(req: Request, { params }: RouteParams) {
  try {
    const sessionId = params.id;
    if (!sessionId) {
      return NextResponse.json(
        { ok: false, error: "MISSING_SESSION_ID" },
        { status: 400 }
      );
    }

    const url = new URL(req.url);
    const takeParam = url.searchParams.get("take");
    const take = takeParam
      ? Math.min(200, Math.max(1, parseInt(takeParam, 10)))
      : 50;

    const rows = await prisma.message.findMany({
      where: { sessionId },
      orderBy: { sendTime: "asc" }, // 時間升序
      take,
    });

    const messages = rows.map(mapDbMessageToUiMessage);

    return NextResponse.json(
      {
        ok: true,
        messages,
      },
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

// 寫入一條 H5 消息（VIP 或客服均可調用）
export async function POST(req: Request, { params }: RouteParams) {
  try {
    const sessionId = params.id;
    if (!sessionId) {
      return NextResponse.json(
        { ok: false, error: "MISSING_SESSION_ID" },
        { status: 400 }
      );
    }

    const body = (await req.json().catch(() => ({}))) as {
      text?: string;
      from?: "vip" | "agent" | "system";
    };

    const rawText = body.text?.trim();
    if (!rawText) {
      return NextResponse.json(
        { ok: false, error: "EMPTY_TEXT" },
        { status: 400 }
      );
    }

    const from = body.from || "vip"; // 默認當作 VIP 發的
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
    const msgId = `h5-${sessionId}-${Date.now()}-${Math.random()
      .toString(36)
      .slice(2)}`;

    const created = await prisma.message.create({
      data: {
        msgId,
        openKfid: session.openKfid || "H5",
        externalUserId: session.externalUserId,
        origin: "h5",
        msgType: "text",
        sendTime: now,
        payload: JSON.stringify({ content: rawText }),
        direction: from === "vip" ? "in" : "out",
        text: rawText,
        sessionId,
      },
    });

    // 更新 Session 的最後消息 & 未讀數
    await prisma.session.update({
      where: { id: sessionId },
      data: {
        lastMsgAt: now,
        lastMsgPreview: rawText,
        // 未來如果要做真正的已讀邏輯可以再細分，這裡簡單 +1
        unreadCount: session.unreadCount + 1,
      },
    });

    return NextResponse.json(
      {
        ok: true,
        message: mapDbMessageToUiMessage(created),
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
