// app/api/vip/submit/route.ts
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

interface SubmitBody {
  vipNumber?: string;
  preferredName?: string;
  birthdayMd?: string;
  version?: string;
  entryMode?: string;
  scanChannel?: string;
  channelIdentifier?: string; // ⭐ 前端傳來的 browserId / openid / phone 等
}

/**
 * 把各种输入（0323 / 3-23 / 3/23 / 00323）统一成 "MMDD"
 */
function normalizeBirthdayMd(input?: string | null): string | null {
  if (!input) return null;
  const digits = input.replace(/\D/g, "");
  if (!digits) return null;
  const last4 = digits.slice(-4);
  return last4.padStart(4, "0");
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as SubmitBody;

    const vipNumberRaw = body.vipNumber?.trim();
    if (!vipNumberRaw) {
      return NextResponse.json(
        { ok: false, error: "MISSING_VIP_NUMBER" },
        { status: 400 }
      );
    }

    // ⭐ 解析 channelIdentifier（可能是 browserId / openid / phone 等）
    const channelIdentifierRaw = body.channelIdentifier;
    const channelIdentifier =
      typeof channelIdentifierRaw === "string" && channelIdentifierRaw.trim()
        ? channelIdentifierRaw.trim()
        : null;

    // ⭐ 規範 version / entryMode / scanChannel 的值
    const version: "hybrid" | "h5" =
      body.version === "h5" ? "h5" : "hybrid";

    const entryMode: "h5" | "wecom" =
      body.entryMode === "wecom" ? "wecom" : "h5";

    const scanChannel: "wechat" | "browser" =
      body.scanChannel === "wechat" ? "wechat" : "browser";

    // 1) 只用 VIP 号做硬校验
    const vip = await prisma.vipGuest.findUnique({
      where: { vipNumber: vipNumberRaw },
    });

    if (!vip) {
      // VIP 号根本不存在：不创建 PendingApproval
      return NextResponse.json(
        { ok: false, error: "VIP_NOT_FOUND" },
        { status: 400 }
      );
    }

    // 2) 生日做软校验，只产生提示，不拦截
    const inputBirthday = normalizeBirthdayMd(body.birthdayMd ?? null);

    let matchHint = "";
    if (vip.birthdayMd) {
      const stored = normalizeBirthdayMd(vip.birthdayMd);
      if (stored && inputBirthday && stored === inputBirthday) {
        matchHint = "VIP number and birthday matched in the system.";
      } else if (!inputBirthday) {
        matchHint =
          "VIP number matched. Birthday was not provided; please verify with the guest.";
      } else {
        matchHint =
          "VIP number matched, but birthday did not match. Please verify with the guest.";
      }
    } else {
      matchHint =
        "VIP number matched. Birthday is not recorded in the system; please verify with the guest.";
    }

    // 3) 创建 PendingApproval（永远只要 VIP 号对，就能发 request）
    const approval = await prisma.pendingApproval.create({
      data: {
        vipNumber: vip.vipNumber,
        vipGuestId: vip.id,
        inputPreferredName: body.preferredName?.trim() || null,
        inputBirthdayMd: inputBirthday,
        // ⭐ 把渠道唯一 ID 寫進去（H5 = browserId，微信可以是 openid）
        inputChannelIdentifier: channelIdentifier ?? undefined,

        // ⭐ 這裡使用剛剛規範好的 version / entryMode / scanChannel
        version,
        entryMode,
        scanChannel,
      },
    });

    return NextResponse.json({
      ok: true,
      pendingId: approval.id,
      matchHint,
    });
  } catch (err) {
    console.error("Error in /api/vip/submit:", err);
    return NextResponse.json(
      { ok: false, error: "SERVER_ERROR" },
      { status: 500 }
    );
  }
}
