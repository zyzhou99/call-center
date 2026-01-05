// app/api/vip/approvals/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET() {
  try {
    const approvals = await prisma.pendingApproval.findMany({
      where: {
        status: "PENDING",
      },
      orderBy: {
        createdAt: "asc",
      },
      include: {
        vipGuest: true, // 方便右侧看到房号 / 等级
      },
    });

    const items = approvals.map((p) => ({
      id: p.id,
      vipNumber: p.vipNumber,
      preferredName: p.preferredName,
      birthday: p.birthday?.toISOString() ?? null,
      mode: p.mode,
      platform: p.platform,
      status: p.status,
      createdAt: p.createdAt.toISOString(),
      vipGuest: p.vipGuest
        ? {
            fullName: p.vipGuest.fullName,
            tier: p.vipGuest.tier,
            room: p.vipGuest.room,
            statusLabel: p.vipGuest.statusLabel,
            segment: p.vipGuest.segment,
          }
        : null,
    }));

    return NextResponse.json({ ok: true, items });
  } catch (err) {
    console.error("Error listing approvals", err);
    return NextResponse.json(
      { ok: false, error: "SERVER_ERROR" },
      { status: 500 }
    );
  }
}
