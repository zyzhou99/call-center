// app/api/vip/verify/route.ts
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { setPendingVipBinding } from "@/lib/vipBindingState";

// ✅ 明确告诉 Next：这是 Node.js runtime 的 API，不能当静态页面搞
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// 真实企微的 open_kfid（用你现在在 inbox 里用的那一个）
const REAL_OPEN_KFID =
  process.env.WECOM_OPEN_KFID ?? "wkF2d-UgAAEh3wgchi7suzX_aSxSTynw";

// 真实企微客服的 H5 链接
const PROD_KF_URL =
  process.env.WECOM_KF_URL ??
  "https://work.weixin.qq.com/kfid/kfcc8d4feb1548d37de";

// 简单区分环境：本地/POC 用 DEV_OPEN_KF，线上用 REAL_OPEN_KFID
const isDev = process.env.NODE_ENV !== "production";

// 本地开发 mock 用
const DEV_OPEN_KF = "DEV_OPEN_KF";
const devExternalUserId = (vipNumber: string) => `dev-${vipNumber}`;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({} as any));

    const vipNumber = typeof body.vipNumber === "string"
      ? body.vipNumber.trim()
      : "";
    const preferredName =
      typeof body.preferredName === "string"
        ? body.preferredName.trim() || null
        : null;

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

    const displayName =
      guestToUse.preferredName ||
      guestToUse.fullName ||
      `VIP ${vipNumber}`;

    // 3) 开发环境：继续使用之前的 DEV_OPEN_KF + /inbox 流程
    if (isDev) {
      const externalUserId = devExternalUserId(vipNumber);

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

      return NextResponse.json({
        ok: true,
        vipGuest: {
          vipNumber: guestToUse.vipNumber,
          preferredName: guestToUse.preferredName ?? null,
          fullName: guestToUse.fullName ?? null,
          room: guestToUse.room ?? null,
          vipTier: guestToUse.tier ?? null,
        },
        // 本地 / POC 继续走 inbox
        kfUrl: null,
        sessionId: session.id,
      });
    }

    // 4) 生产环境：只做「记录待绑定 VIP」+ 返回企微客服链接
    setPendingVipBinding(REAL_OPEN_KFID, guestToUse.id, guestToUse.vipNumber);

    return NextResponse.json({
      ok: true,
      vipGuest: {
        vipNumber: guestToUse.vipNumber,
        preferredName: guestToUse.preferredName ?? null,
        fullName: guestToUse.fullName ?? null,
        room: guestToUse.room ?? null,
        vipTier: guestToUse.tier ?? null,
      },
      kfUrl: PROD_KF_URL, // H5 会跳到这个真实客服链接
      sessionId: null, // 生产不跳 inbox
    });
  } catch (err) {
    console.error("[/api/vip/verify] error", err);
    return NextResponse.json(
      { ok: false, error: "SERVER_ERROR" },
      { status: 500 }
    );
  }
}
