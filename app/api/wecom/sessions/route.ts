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

    // ⭐ 把 vipGuest 一起查出來
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

      const displayNameFromVip =
        (g?.preferredName as string | null) ||
        (g?.fullName as string | null) ||
        null;

      return {
        id: s.id,
        openKfid: s.openKfid,
        externalUserId: s.externalUserId,
        // ⭐ 優先用 VIP 的名字，沒有再 fallback
        displayName:
          displayNameFromVip ||
          s.displayName ||
          s.externalUserId ||
          s.id,
        channel: s.channel,
        lastMsgAt: s.lastMsgAt,
        lastMsgPreview: s.lastMsgPreview,
        unreadCount: s.unreadCount,
        vipNumber: s.vipNumber,
        // ⭐ 把 vipGuest 結構明確返回給前端
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
              // 如果你在 VipGuest 裡加了下面幾個喜好字段，也一起帶出去
              stayPreference: (g as any).stayPreference ?? null,
              diningPreference: (g as any).diningPreference ?? null,
              travelPreference: (g as any).travelPreference ?? null,
              culturePrivacy: (g as any).culturePrivacy ?? null,
              other: (g as any).other ?? null,
            }
          : null,
      };
    });

    // ⭐ 方便確認後端到底有沒有 vipGuest
    console.log(
      "[/api/wecom/sessions] sample:",
      items[0]
        ? {
            id: items[0].id,
            displayName: items[0].displayName,
            vipNumber: items[0].vipNumber,
            hasVipGuest: !!items[0].vipGuest,
          }
        : "no sessions"
    );

    return NextResponse.json({ ok: true, sessions: items });
  } catch (e) {
    console.error("[/api/wecom/sessions] error:", e);
    return NextResponse.json(
      { ok: false, error: "internal_error" },
      { status: 500 }
    );
  }
}
