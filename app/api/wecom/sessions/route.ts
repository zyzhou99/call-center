// app/api/wecom/sessions/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

const ADMIN_TOKEN = process.env.ADMIN_TOKEN ?? "sync123";

export async function GET(req: NextRequest) {
  try {
    const adminToken = req.headers.get("x-admin-token");
    if (adminToken !== ADMIN_TOKEN) {
      return NextResponse.json(
        { ok: false, error: "unauthorized" },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(req.url);
    const openKfid = searchParams.get("open_kfid") || undefined;
    const q = searchParams.get("q")?.trim() || "";
    const takeParam = searchParams.get("take");
    const take = takeParam ? Math.min(Number(takeParam) || 50, 200) : 50;

    const where: any = {};
    if (openKfid) {
      where.openKfid = openKfid;
    }
    if (q) {
      where.OR = [
        { externalUserId: { contains: q } },
        { displayName: { contains: q } },
        { vipNumber: { contains: q } },
      ];
    }

    // ⭐ 关键：把 vipGuest 一起查出来
    const sessions = await prisma.session.findMany({
      where,
      orderBy: { lastMsgAt: "desc" },
      take,
      include: {
        vipGuest: true,
      },
    });

    const items = sessions.map((s) => {
      const g = s.vipGuest;

      return {
        id: s.id,
        openKfid: s.openKfid,
        externalUserId: s.externalUserId,
        displayName: s.displayName,
        channel: s.channel,
        lastMsgAt: s.lastMsgAt,
        lastMsgPreview: s.lastMsgPreview,
        unreadCount: s.unreadCount,
        vipNumber: s.vipNumber,
        // ⭐ 这里把 guest 侧边栏需要的字段都整理好
        vipGuest: g
          ? {
              id: g.id,
              vipNumber: g.vipNumber,
              fullName: g.fullName,
              preferredName: g.preferredName,
              tier: g.tier,
              room: g.room,
              checkInDate: g.checkInDate,
              checkOutDate: g.checkOutDate,
              segment: g.segment,
              statusLabel: g.statusLabel,
              notes: g.notes,
            }
          : null,
      };
    });

    return NextResponse.json({ ok: true, sessions: items });
  } catch (e) {
    console.error("[/api/wecom/sessions] error:", e);
    return NextResponse.json(
      { ok: false, error: "internal_error" },
      { status: 500 }
    );
  }
}
