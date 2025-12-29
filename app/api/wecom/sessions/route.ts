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

    // 先拿到所有 Session
    const sessions = await prisma.session.findMany({
      where: { openKfid },
      orderBy: { lastMsgAt: "desc" },
    });

    console.log(
      "[/api/wecom/sessions] sessions count =",
      sessions.length
    );

    // 对每个 Session 再查一条「最后一条消息」做 preview 兜底
    const conversations = await Promise.all(
      sessions.map(async (s) => {
        // 从 Message 表里拿这个客户的最后一条消息
        const lastMessage = await prisma.message.findFirst({
          where: {
            openKfid,
            externalUserId: s.externalUserId,
          },
          orderBy: { sendTime: "desc" },
          select: { text: true },
        });

        // 优先用 Session 表里的 lastMsgPreview；没有就用最后一条消息的 text
        const lastMessagePreview =
          s.lastMsgPreview ??
          lastMessage?.text ??
          "";

        return {
          // 用 externalUserId 当作会话 id（UI 用这个字段）
          id: s.externalUserId ?? "",
          displayName: s.displayName || s.externalUserId || "Guest",
          lastMessagePreview,
          unreadCount: s.unreadCount ?? 0,
          channel: (s.channel as any) ?? "wechat",
        };
      })
    );

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
