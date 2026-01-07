// app/api/vip/submit/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";

type VersionType = "hybrid" | "h5";
type EntryMode = "wecom" | "h5";
type ScanChannel = "wechat" | "browser";

type VipSubmitBody = {
  vipNumber: string;
  preferredName?: string;
  birthdayMd: string; // 使用者輸入，如 "0323" 或 "3-23"
  version: VersionType;
  entryMode: EntryMode;
  scanChannel: ScanChannel;
};

function normalizeBirthdayMd(input: string): string | null {
  if (!input) return null;
  // 只保留數字，例如 "03/23" -> "0323"
  const digits = input.replace(/\D/g, "");
  if (digits.length === 4) return digits;
  if (digits.length === 3) {
    // 比如 "323" => "0323"
    return digits.padStart(4, "0");
  }
  // 其他長度先認為不合法，交給前端顯示「格式不正確」
  return null;
}

// 額外做一層 runtime 校驗，避免亂值寫進 DB
function isValidVersion(v: any): v is VersionType {
  return v === "hybrid" || v === "h5";
}
function isValidEntryMode(v: any): v is EntryMode {
  return v === "wecom" || v === "h5";
}
function isValidScanChannel(v: any): v is ScanChannel {
  return v === "wechat" || v === "browser";
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as Partial<VipSubmitBody>;
    let {
      vipNumber,
      preferredName,
      birthdayMd,
      version,
      entryMode,
      scanChannel,
    } = body;

    vipNumber = (vipNumber ?? "").trim();
    preferredName = preferredName?.trim() || undefined;
    birthdayMd = (birthdayMd ?? "").trim();

    // 1) 基本必填檢查
    if (!vipNumber || !birthdayMd || !version || !entryMode || !scanChannel) {
      return NextResponse.json(
        { ok: false, error: "INVALID_INPUT" },
        { status: 400 }
      );
    }

    // 2) 檢查 version / entryMode / scanChannel 是否在允許範圍
    if (
      !isValidVersion(version) ||
      !isValidEntryMode(entryMode) ||
      !isValidScanChannel(scanChannel)
    ) {
      return NextResponse.json(
        { ok: false, error: "INVALID_INPUT" },
        { status: 400 }
      );
    }

    // 3) 標準化生日為 MMDD
    const normalizedBirthday = normalizeBirthdayMd(birthdayMd);
    if (!normalizedBirthday) {
      return NextResponse.json(
        { ok: false, error: "INVALID_BIRTHDAY_FORMAT" },
        { status: 200 }
      );
    }

    // 4) 查 VipGuest（VIP 号必須存在）
    const vip = await prisma.vipGuest.findUnique({
      where: { vipNumber },
    });

    if (!vip) {
      // 你前端已經把 VIP_NOT_FOUND 和 VIP_INFO_MISMATCH 都映射成同一個提示文案
      return NextResponse.json(
        { ok: false, error: "VIP_NOT_FOUND" },
        { status: 200 }
      );
    }

    // 5) 對比生日（DB 裡的 birthdayMd 也標準化做一次）
    const storedBirthday = vip.birthdayMd
      ? normalizeBirthdayMd(vip.birthdayMd)
      : null;

    if (!storedBirthday || storedBirthday !== normalizedBirthday) {
      // 沒有生日 or 不匹配：一律當作資料不符合，讓前端顯示「資訊不符合，請重新輸入」
      return NextResponse.json(
        { ok: false, error: "VIP_INFO_MISMATCH" },
        { status: 200 }
      );
    }

    // 6) VIP 号 + 生日都匹配，才創建 PendingApproval
    const pending = await prisma.pendingApproval.create({
      data: {
        vipNumber,
        vipGuestId: vip.id,
        inputPreferredName: preferredName ?? null,
        inputBirthdayMd: normalizedBirthday,
        version,
        entryMode,
        scanChannel,
        // status 預設 "PENDING"
        // kfUrl / sessionId / assignedAgentId / assignedAt 先留給後面審批流程填
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
