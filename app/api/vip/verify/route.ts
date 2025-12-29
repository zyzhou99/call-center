// app/api/vip/verify/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

const DEV_OPEN_KF = "DEV_OPEN_KF"; // 本地开发用的虚拟 openKfid
const devExternalUserId = (vipNumber: string) => `dev-${vipNumber}`;

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as {
      vipNumber?: string;
      preferredName?: string | null;
    };

    const vipNumber = body.vipNumber?.trim();
    const preferredName = body.preferredName?.trim() || null;

    if (!vipNumber) {
      return NextResponse.json(
        { ok: false, error: "MISSING_VIP" },
        { status: 400 }
      );
    }

    // 1) 找 VipGuest
    const guest = await prisma.vipGuest.findUnique({
      where: { vipNumber },
    });

    if (!guest) {
      return NextResponse.json(
        { ok: false, error: "NOT_FOUND" },
        { status: 404 }
      );
    }

    // 2) 如果用户这次输入了 preferredName，就更新 VipGuest.preferredName
    let guestToUse = guest;

    if (preferredName && preferredName !== guest.preferredName) {
      guestToUse = await prisma.vipGuest.update({
        where: { id: guest.id },
        data: { preferredName },
      });
    }

    // 3) 本地开发：用固定 openKfid + vipNumber 生成 externalUserId
    const externalUserId = devExternalUserId(vipNumber);

    const displayName =
      guestToUse.preferredName ||
      guestToUse.fullName ||
      `VIP ${vipNumber}`;

    const session = await prisma.session.upsert({
      where: {
        openKfid_externalUserId: {
          openKfid: DEV_OPEN_KF,
          externalUserId,
        },
      },
      update: {
        vipNumber,
        vipGuestId: guestToUse.id,
        displayName,
      },
      create: {
        openKfid: DEV_OPEN_KF,
        externalUserId,
        channel: "wechat",
        vipNumber,
        vipGuestId: guestToUse.id,
        displayName,
      },
    });

    // 4) 返回给前端（注意这里使用的是更新后的 guestToUse）
    return NextResponse.json({
      ok: true,
      vipGuest: {
        vipNumber: guestToUse.vipNumber,
        preferredName: guestToUse.preferredName ?? null,
        fullName: guestToUse.fullName ?? null,
        room: guestToUse.room ?? null,
        vipTier: guestToUse.tier ?? null,
        notes: guestToUse.notes ?? null,
      },
      kfUrl: null,            // 本地不跳企业微信
      sessionId: session.id,  // 给 /vip-access 跳转用
    });
  } catch (err) {
    console.error("[/api/vip/verify] error", err);
    return NextResponse.json(
      { ok: false, error: "SERVER_ERROR" },
      { status: 500 }
    );
  }
}
