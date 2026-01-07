// app/api/vip/submit/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";

type VipSubmitBody = {
  vipNumber: string;
  preferredName?: string;
  birthdayMd: string; // 用户输入，如 "0323" 或 "3-23"，后面会标准化
  version: "hybrid" | "h5";
  entryMode: "wecom" | "h5";
  scanChannel: "wechat" | "browser";
};

function normalizeBirthdayMd(input: string): string | null {
  if (!input) return null;
  // 只保留数字，例如 "03/23" -> "0323"
  const digits = input.replace(/\D/g, "");
  if (digits.length === 4) return digits;
  if (digits.length === 3) {
    // 比如 "323" => "0323"
    return digits.padStart(4, "0");
  }
  // 其他长度先认为不合法
  return null;
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as Partial<VipSubmitBody>;
    const {
      vipNumber,
      preferredName,
      birthdayMd,
      version,
      entryMode,
      scanChannel,
    } = body;

    if (!vipNumber || !birthdayMd || !version || !entryMode || !scanChannel) {
      return NextResponse.json(
        { ok: false, error: "INVALID_INPUT" },
        { status: 400 }
      );
    }

    const normalizedBirthday = normalizeBirthdayMd(birthdayMd);
    if (!normalizedBirthday) {
      return NextResponse.json(
        { ok: false, error: "INVALID_BIRTHDAY_FORMAT" },
        { status: 200 }
      );
    }

    // 1. 查 VipGuest
    const vip = await prisma.vipGuest.findUnique({
      where: { vipNumber },
    });

    if (!vip) {
      return NextResponse.json(
        { ok: false, error: "VIP_NOT_FOUND" },
        { status: 200 }
      );
    }

    // 2. 对比生日（MMDD）
    const storedBirthday = vip.birthdayMd
      ? normalizeBirthdayMd(vip.birthdayMd)
      : null;

    if (!storedBirthday || storedBirthday !== normalizedBirthday) {
      // 没有生日 or 不匹配，一律当作信息不符合
      return NextResponse.json(
        { ok: false, error: "VIP_INFO_MISMATCH" },
        { status: 200 }
      );
    }

    // 3. 生日 & VIP 号都匹配，才创建 PendingApproval
    const pending = await prisma.pendingApproval.create({
      data: {
        vipNumber,
        vipGuestId: vip.id,
        inputPreferredName: preferredName ?? null,
        inputBirthdayMd: normalizedBirthday,
        version,
        entryMode,
        scanChannel,
        // 其他字段先让默认值处理：status = "PENDING"
      },
    });

    return NextResponse.json(
      {
        ok: true,
        pendingId: pending.id,
      },
      { status: 200 }
    );
  } catch (err) {
    console.error("Error in /api/vip/submit:", err);
    return NextResponse.json(
      { ok: false, error: "SERVER_ERROR" },
      { status: 500 }
    );
  }
}
