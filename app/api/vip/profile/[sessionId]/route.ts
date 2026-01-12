// app/api/vip/profile/[sessionId]/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

type Params = {
  params: {
    sessionId: string;
  };
};

export async function GET(_req: Request, { params }: Params) {
  const { sessionId } = params;

  if (!sessionId) {
    return NextResponse.json(
      { ok: false, error: "MISSING_SESSION_ID" },
      { status: 400 }
    );
  }

  try {
    const session = await prisma.session.findUnique({
      where: { id: sessionId },
      include: {
        vipGuest: true,
      },
    });

    if (!session || !session.vipGuest) {
      return NextResponse.json(
        { ok: false, error: "NOT_FOUND" },
        { status: 404 }
      );
    }

    const g = session.vipGuest;

    // 拼成 GuestProfilePanel 期待的结构
    const profile = {
      conversationId: session.id,
      name:
        g.fullName ||
        g.preferredName ||
        `VIP ${g.vipNumber}`,
      preferredName: g.preferredName || null,
      vipNumber: g.vipNumber,
      vipTier: g.tier || "Gold", // 没填 tier 的话给个默认
      room: g.room || "",
      checkInDate: g.checkInDate
        ? g.checkInDate.toISOString().slice(0, 10)
        : "",
      checkOutDate: g.checkOutDate
        ? g.checkOutDate.toISOString().slice(0, 10)
        : "",
      segment: g.segment || "",
      statusLabel: g.statusLabel || "",
      preference: g.preference || "",
      restriction: g.restriction || "",
    };

    return NextResponse.json({
      ok: true,
      profile,
    });
  } catch (err) {
    console.error("[/api/vip/profile] error", err);
    return NextResponse.json(
      { ok: false, error: "SERVER_ERROR" },
      { status: 500 }
    );
  }
}
