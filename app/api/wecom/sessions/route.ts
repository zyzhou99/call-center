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

    console.log("[/api/wecom/sessions] open_kfid =", openKfid);

    const sessions = await prisma.session.findMany({
      where: { openKfid },
      orderBy: { lastMsgAt: "desc" },
    });

    console.log(
      "[/api/wecom/sessions] sessions count =",
      sessions.length
    );

    const conversations = sessions.map((s) => ({
      // 用 externalUserId 当作会话 id（UI 用这个字段）
      id: s.externalUserId ?? "",
      displayName: s.displayName || s.externalUserId || "Guest",
      lastMessagePreview: s.lastMsgPreview ?? "",
      unreadCount: s.unreadCount ?? 0,
      channel: (s.channel as any) ?? "wechat",
    }));

    return NextResponse.json({ ok: true, conversations });
  } catch (err: any) {
    console.error("[/api/wecom/sessions] error:", err);

    const message =
      err?.message ||
      (typeof err === "string" ? err : JSON.stringify(err));

    return NextResponse.json(
      {
        ok: false,
        error: "internal_error",
        detail: message,
      },
      { status: 500 }
    );
  }
}

