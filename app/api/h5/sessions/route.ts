// app/api/h5/sessions/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";

export async function GET() {
  try {
    const sessions = await prisma.session.findMany({
      where: {
        channel: "webchat", // 只拉 H5/webchat 渠道的會話
      },
      include: {
        vipGuest: true,
      },
      orderBy: [
        {
          lastMsgAt: "desc",
        },
        {
          createdAt: "desc",
        },
      ],
    });

    const payload = sessions.map((s) => ({
      id: s.id,
      channel: s.channel,
      displayName:
        s.displayName ||
        s.vipGuest?.preferredName ||
        s.vipGuest?.fullName ||
        `VIP ${s.vipNumber}`,
      lastMsgPreview: s.lastMsgPreview,
      vipNumber: s.vipNumber,
      lastMsgAt: (s.lastMsgAt ?? s.createdAt).toISOString(),
      unreadCount: s.unreadCount ?? 0,
      vipGuest: s.vipGuest
        ? {
            id: s.vipGuest.id,
            fullName: s.vipGuest.fullName,
            preferredName: s.vipGuest.preferredName,
            tier: s.vipGuest.tier,
            room: s.vipGuest.room,
          }
        : null,
    }));

    return NextResponse.json(
      {
        ok: true,
        sessions: payload,
      },
      { status: 200 }
    );
  } catch (err) {
    console.error("Error in GET /api/h5/sessions:", err);
    return NextResponse.json(
      {
        ok: false,
        error: "SERVER_ERROR",
      },
      { status: 500 }
    );
  }
}
