// app/api/vip/submit/route.ts
// ⚠️ LEGACY FLOW 的註釋可以保留，但下面已改成「通用 QR」專用版本

export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

interface SubmitBody {
  scanChannel?: string;       // "wechat" | "browser"
  channelIdentifier?: string; // browserId / wxh5:xxx 等
}

// 小工具：把 scanChannel 正規化成 "wechat" | "browser"
function normalizeScanChannel(raw?: string | null): "wechat" | "browser" {
  if (!raw) return "browser";
  return raw === "wechat" ? "wechat" : "browser";
}

// 生成一個 4 位數隨機碼和對應的 Guest 名稱
function generateGuestLabel() {
  const code = Math.floor(1000 + Math.random() * 9000); // 1000–9999
  const label = `Guest_${code}`;
  return { code, label };
}

export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => null)) as SubmitBody | null;
    if (!body) {
      return NextResponse.json(
        { ok: false, error: "INVALID_BODY" },
        { status: 400 }
      );
    }

    const scanChannel = normalizeScanChannel(body.scanChannel);
    const rawId = body.channelIdentifier;

    const channelIdentifier =
      typeof rawId === "string" && rawId.trim() ? rawId.trim() : null;

    if (!channelIdentifier) {
      return NextResponse.json(
        { ok: false, error: "MISSING_CHANNEL_IDENTIFIER" },
        { status: 400 }
      );
    }

    // 生成一個隨機 Guest 名，例如 Guest_2930
    const { code, label } = generateGuestLabel();

    const approval = await prisma.pendingApproval.create({
      data: {
        // ✅ 通用 QR：一律從 PENDING 開始
        status: "PENDING",

        // ✅ 這裡不再依賴任何已存在的 VIP 資料
        vipNumber: null,
        vipGuestId: null,

        // 用來顯示在 Requests 右側的“Guest 名字”
        inputPreferredName: label,

        // 生日已經不用了，留空
        inputBirthdayMd: null,

        // 渠道唯一 ID：瀏覽器 = browserId、微信 = wxh5:xxx
        inputChannelIdentifier: channelIdentifier,

        // 固定用 h5 版本
        version: "h5",
        entryMode: "h5",

        // 從哪裡掃的 QR：wechat / browser
        scanChannel,

        // 通用 QR 不走 WeCom，所以不設 kfUrl
        kfUrl: null,
      },
    });

    return NextResponse.json(
      {
        ok: true,
        pendingId: approval.id,
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
