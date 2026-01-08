// app/api/vip/submit/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";

type VipSubmitBody = {
  vipNumber: string;
  preferredName?: string;
  version: "hybrid" | "h5";
  entryMode: "wecom" | "h5";
  scanChannel: "wechat" | "browser";
};

function normalizeName(input?: string | null): string {
  if (!input) return "";
  return input.trim().toLowerCase();
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as Partial<VipSubmitBody>;
    const vipNumber = body.vipNumber?.trim();
    const preferredName = body.preferredName?.trim();
    const version = body.version;
    const entryMode = body.entryMode;
    const scanChannel = body.scanChannel;

    if (!vipNumber || !version || !entryMode || !scanChannel) {
      return NextResponse.json(
        { ok: false, error: "INVALID_INPUT" },
        { status: 400 }
      );
    }

    // 1. 查 VipGuest（如果酒店初始已發這張卡）
    const vip = await prisma.vipGuest.findUnique({
      where: { vipNumber },
    });

    let riskLevel: string | null = null;
    let matchHint: string | null = null;
    let vipGuestId: string | null = null;

    const inputNameNorm = normalizeName(preferredName);

    if (vip) {
      vipGuestId = vip.id;

      const fullNorm = normalizeName(vip.fullName);
      const prefNorm = normalizeName(vip.preferredName);

      const nameMatches =
        !!inputNameNorm &&
        (inputNameNorm === fullNorm || inputNameNorm === prefNorm);

      if (nameMatches) {
        // VIP 號 & 名字都對得上：風險最低
        riskLevel = "LOW";
        matchHint = "VIP_AND_NAME_MATCH";
      } else if (inputNameNorm) {
        // 有這張卡，但名字對不上：中等風險，後台再人工核對
        riskLevel = "MEDIUM";
        matchHint = "VIP_FOUND_NAME_MISMATCH";
      } else {
        // 有卡但沒填名字：也給個中等風險
        riskLevel = "MEDIUM";
        matchHint = "VIP_FOUND_NO_NAME";
      }
    } else {
      // 系統裡沒這張 VIP 卡：標成 HIGH，交給線下判斷要不要放行
      riskLevel = "HIGH";
      matchHint = "VIP_NOT_FOUND";
    }

    // 2. 無論是否匹配，都建立 PendingApproval，交給禮賓人工決策
    const pending = await prisma.pendingApproval.create({
      data: {
        vipNumber,
        vipGuestId,
        inputPreferredName: preferredName || null,
        version,
        entryMode,
        scanChannel,
        riskLevel,
        matchHint,
        // status 預設 "PENDING"
      },
    });

    return NextResponse.json(
      {
        ok: true,
        pendingId: pending.id,
        riskLevel: pending.riskLevel ?? riskLevel ?? undefined,
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
