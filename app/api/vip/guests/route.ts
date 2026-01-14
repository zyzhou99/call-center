// app/api/vip/guests/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { randomBytes } from "crypto";

export const runtime = "nodejs";
// 确保每次请求都会打到数据库，而不是被静态缓存
export const dynamic = "force-dynamic";

// 🔑 统一封装一个生成 qrCode token 的函数
// 形如：QR-10001-8F3A7C2B
function generateVipQrCodeToken(vipNumber: string) {
  const clean = String(vipNumber).trim() || "UNKNOWN";
  const rand = randomBytes(4).toString("hex").toUpperCase(); // 8 位十六进制
  return `QR-${clean}-${rand}`;
}

// GET：返回通讯录里要用到的基础信息 + qrCode
export async function GET(_req: NextRequest) {
  try {
    const guests = await prisma.vipGuest.findMany({
      orderBy: {
        updatedAt: "desc",
      },
      select: {
        id: true,
        vipNumber: true,
        fullName: true,
        firstName: true,
        lastName: true,
        preferredName: true,
        tier: true,
        room: true,
        segment: true,
        statusLabel: true,
        birthdayMd: true,
        contactPhone: true,
        contactEmail: true,
        preference: true,
        restriction: true,
        qrCode: true,
        updatedAt: true,
      },
    });

    return NextResponse.json({
      ok: true,
      list: guests.map((g) => ({
        id: g.id,
        vipNumber: g.vipNumber,
        fullName: g.fullName,
        firstName: g.firstName,
        lastName: g.lastName,
        preferredName: g.preferredName,
        tier: g.tier,
        room: g.room,
        segment: g.segment,
        statusLabel: g.statusLabel,
        birthdayMd: g.birthdayMd,
        contactPhone: g.contactPhone,
        contactEmail: g.contactEmail,
        preference: g.preference,
        restriction: g.restriction,
        qrCode: g.qrCode,
        updatedAt: g.updatedAt.toISOString(),
      })),
    });
  } catch (err) {
    console.error("GET /api/vip/guests failed:", err);
    return NextResponse.json(
      {
        ok: false,
        error: "INTERNAL_ERROR",
      },
      { status: 500 }
    );
  }
}

// POST：新建一个 VIP Guest，并且自动生成 qrCode（如果还没有）
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({} as any));

    const vipNumber = (body.vipNumber ?? "").toString().trim();
    const fullNameRaw = (body.fullName ?? "").toString().trim();
    const preferredNameRaw = (body.preferredName ?? "").toString().trim();
    const firstNameRaw = (body.firstName ?? "").toString().trim();
    const lastNameRaw = (body.lastName ?? "").toString().trim();

    const birthdayMd =
      typeof body.birthdayMd === "string" && body.birthdayMd.trim()
        ? body.birthdayMd.trim()
        : null;

    const contactPhone =
      typeof body.contactPhone === "string" && body.contactPhone.trim()
        ? body.contactPhone.trim()
        : null;

    const contactEmail =
      typeof body.contactEmail === "string" && body.contactEmail.trim()
        ? body.contactEmail.trim()
        : null;

    const tier =
      typeof body.tier === "string" && body.tier.trim()
        ? body.tier.trim()
        : null;

    const room =
      typeof body.room === "string" && body.room.trim()
        ? body.room.trim()
        : null;

    const segment =
      typeof body.segment === "string" && body.segment.trim()
        ? body.segment.trim()
        : null;

    const statusLabel =
      typeof body.statusLabel === "string" && body.statusLabel.trim()
        ? body.statusLabel.trim()
        : null;

    const preference =
      typeof body.preference === "string" ? body.preference.trim() : "";
    const restriction =
      typeof body.restriction === "string" ? body.restriction.trim() : "";

    // ✅ 必填校验：vipNumber + （lastName / firstName / preferredName 三选一）
    if (!vipNumber) {
      return NextResponse.json(
        { ok: false, error: "MISSING_VIP_NUMBER" },
        { status: 400 }
      );
    }

    const hasAnyName =
      !!lastNameRaw || !!firstNameRaw || !!preferredNameRaw || !!fullNameRaw;

    if (!hasAnyName) {
      return NextResponse.json(
        { ok: false, error: "MISSING_NAME" },
        { status: 400 }
      );
    }

    // 兜底生成 fullName：优先用 fullName，其次 last + first，再其次 preferredName
    let fullName = fullNameRaw;
    if (!fullName) {
      const combined = `${lastNameRaw} ${firstNameRaw}`.trim();
      fullName = combined || preferredNameRaw || vipNumber;
    }

    // 👮‍♀️ 简单防止重复：如果同一个 vipNumber 已存在，可以直接返回已有记录
    const existing = await prisma.vipGuest.findFirst({
      where: { vipNumber },
    });

    if (existing) {
      return NextResponse.json({
        ok: true,
        guest: {
          id: existing.id,
          vipNumber: existing.vipNumber,
          fullName: existing.fullName,
          preferredName: existing.preferredName,
          qrCode: existing.qrCode,
        },
        duplicated: true,
      });
    }

    // 🎫 决定 qrCode token：
    // - 如果前端已经传了 body.qrCode，就直接用（比如从别的系统导入）
    // - 否则我们帮你生成一个：QR-<vipNumber>-<随机码>
    const qrCodeTokenRaw =
      typeof body.qrCode === "string" && body.qrCode.trim()
        ? body.qrCode.trim()
        : generateVipQrCodeToken(vipNumber);

    const guest = await prisma.vipGuest.create({
      data: {
        vipNumber,
        fullName,
        firstName: firstNameRaw || null,
        lastName: lastNameRaw || null,
        preferredName: preferredNameRaw || null,
        birthdayMd,
        contactPhone,
        contactEmail,
        tier,
        room,
        segment,
        statusLabel,
        preference,
        restriction,
        qrCode: qrCodeTokenRaw,
      },
    });

    return NextResponse.json({
      ok: true,
      guest: {
        id: guest.id,
        vipNumber: guest.vipNumber,
        fullName: guest.fullName,
        preferredName: guest.preferredName,
        qrCode: guest.qrCode,
      },
    });
  } catch (err) {
    console.error("POST /api/vip/guests failed:", err);
    return NextResponse.json(
      {
        ok: false,
        error: "INTERNAL_ERROR",
      },
      { status: 500 }
    );
  }
}
