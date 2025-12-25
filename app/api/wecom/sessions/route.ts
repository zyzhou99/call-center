// app/api/wecom/sessions/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const openKfid = searchParams.get("open_kfid");

    if (!openKfid) {
      return NextResponse.json(
        { ok: false, error: "missing open_kfid" },
        { status: 400 }
      );
    }

    const sessions = await prisma.session.findMany({
      where: { openKfid },
      orderBy: { lastMsgAt: "desc" },
    });

    const conversations = sessions.map((s) => ({
      // ✅ UI 里用 externalUserId 当作会话 id
      id: s.externalUserId,
      displayName: s.displayName ?? s.externalUserId ?? "Guest",
      lastMessagePreview: s.lastMsgPreview ?? "",
      unreadCount: s.unreadCount ?? 0,
      channel: (s.channel as any) ?? "wechat",
    }));

    return NextResponse.json({ ok: true, conversations });
  } catch (e) {
    console.error("wecom sessions error", e);
    return NextResponse.json(
      { ok: false, error: "internal_error" },
      { status: 500 }
    );
  }
}
