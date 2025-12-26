// app/api/wecom/message/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const openKfid = searchParams.get("open_kfid");
    const externalUserId = searchParams.get("external_userid");
    const takeParam = searchParams.get("take");
    const take = takeParam ? Math.min(parseInt(takeParam, 10) || 50, 200) : 50;

    if (!openKfid || !externalUserId) {
      return NextResponse.json(
        { ok: false, error: "missing open_kfid or external_userid" },
        { status: 400 }
      );
    }

    // 找到最近的一条 Session（同一个 open_kfid + externalUserId）
    const session = await prisma.session.findFirst({
      where: { openKfid, externalUserId },
      orderBy: { lastMsgAt: "desc" },
    });

    if (!session) {
      return NextResponse.json({ ok: true, messages: [] });
    }

    const dbMessages = await prisma.message.findMany({
      where: { sessionId: session.id },
      orderBy: { sendTime: "asc" },
      take,
    });

    const uiMessages = dbMessages.map((m) => {
      const sendTime =
        m.sendTime instanceof Date ? m.sendTime : new Date(m.sendTime as any);
      const ts = sendTime.getTime();

      const payload = (m.payload ?? {}) as any;
      const text =
        (m.text as string | null) ??
        (payload?.text as string | undefined) ??
        "";

      return {
        id: m.id,
        conversationId: externalUserId, // 前端会话 ID = external_userid
        direction: m.direction === "out" ? "out" : "in",
        text,
        timestamp: ts,
        timeLabel: sendTime.toLocaleTimeString("en-US", {
          hour: "numeric",
          minute: "2-digit",
        }),
        dateLabel: sendTime.toLocaleDateString("en-US", {
          month: "short",
          day: "2-digit",
          year: "numeric",
        }),
      };
    });

    return NextResponse.json({ ok: true, messages: uiMessages });
  } catch (e: any) {
    console.error("wecom message error", e);
    return NextResponse.json(
      { ok: false, error: "internal_error", detail: e?.message ?? String(e) },
      { status: 500 }
    );
  }
}
