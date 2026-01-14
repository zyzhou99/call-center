// ⚠️ LEGACY FLOW: VIP 自助驗證入口（輸入 VIP 卡號 + 生日）
// 現在需求已改為「每位 VIP 對應一個永久專屬二維碼」，
// 未來會用新的 /vip-entry H5 頁面取代這個表單。
// 目前暫時保留，以免影響已有測試鏈路，但新功能不要再往這裡加。


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
  channelIdentifier?: string; // browserId / openid / phone 等
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

    // 解析 channelIdentifier（可能是 browserId / openid / phone 等）
    const channelIdentifierRaw = body.channelIdentifier;
    const channelIdentifier =
      typeof channelIdentifierRaw === "string" && channelIdentifierRaw.trim()
        ? channelIdentifierRaw.trim()
        : null;

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

    // 3) 算出 version / scanChannel / entryMode（統一一下）
    const rawVersion = body.version ?? null;
    const rawEntryMode = body.entryMode ?? null;
    const rawScanChannel = body.scanChannel ?? null;

    const version: "h5" | "hybrid" =
      rawVersion === "hybrid" || rawVersion === "h5" ? rawVersion : "h5";

    const scanChannel: "wechat" | "browser" =
      rawScanChannel === "wechat" || rawScanChannel === "browser"
        ? rawScanChannel
        : "browser";

    let entryMode: "wecom" | "h5";
    if (rawEntryMode === "wecom" || rawEntryMode === "h5") {
      entryMode = rawEntryMode;
    } else if (version === "hybrid" && scanChannel === "wechat") {
      // hybrid + 微信掃碼 → 默認認為是 WeCom 入口
      entryMode = "wecom";
    } else {
      entryMode = "h5";
    }

    // 4) WeCom 入口：這裡就直接決定 kfUrl
    let kfUrl: string | null = null;
    if (entryMode === "wecom") {
      const envKf =
        process.env.NEXT_PUBLIC_WECOM_KF_URL || process.env.WECOM_KF_URL || null;
      if (!envKf) {
        console.warn(
          "[/api/vip/submit] WeCom entry but WECOM_KF_URL not configured; will create pendingApproval without kfUrl"
        );
      } else {
        kfUrl = envKf;
      }
    }

    // 5) 创建 PendingApproval（只要 VIP 号對，就能發 request）
    const approval = await prisma.pendingApproval.create({
      data: {
        vipNumber: vip.vipNumber,
        vipGuestId: vip.id,
        inputPreferredName: body.preferredName?.trim() || null,
        inputBirthdayMd: inputBirthday,
        // 渠道唯一 ID（H5 = browserId，微信之後會換成 openid）
        inputChannelIdentifier: channelIdentifier ?? undefined,

        version,
        entryMode,
        scanChannel,

        // WeCom 入口時，提前寫好企業微信跳轉鏈接
        kfUrl: kfUrl ?? undefined,
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
