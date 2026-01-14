// app/api/vip/approvals/[id]/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { setPendingVipBinding } from "@/lib/vipBindingState";

export const runtime = "nodejs";

interface RouteParams {
  params: { id: string };
}

// H5 用的 openKfId，占位：只用來和 externalUserId 做唯一鍵（瀏覽器掃碼的 H5）
const H5_OPENKFID = process.env.NEXT_PUBLIC_H5_OPENKFID || "H5_WEBCHAT";

// WeCom / hybrid + 微信 掃碼後，審批通過要跳轉的企業微信客服鏈接（寫死）
const WECOM_FIXED_KF_URL =
  "https://work.weixin.qq.com/kfid/kfcc8d4feb1548d37de";

// ⚠️ 這個要和前端 inbox 裡的 OPEN_KFID 保持一致
// inbox/page.tsx 裡現在是：
// const OPEN_KFID = "wkF2d-UgAAEh3wgchi7suzX_aSxSTynw";
const WECOM_OPENKFID = "wkF2d-UgAAEh3wgchi7suzX_aSxSTynw";

function buildWelcomeText(opts: {
  preferredName?: string | null;
  vipNumber: string;
}) {
  const name = opts.preferredName?.trim();
  if (name) {
    return `您好尊貴的 VIP ${name}，歡迎下榻永利皇宮，我是 Joye，很高興為您服務，請問今天有什麼可以幫到您？`;
  }
  return `您好尊貴的貴賓，歡迎下榻永利皇宮，我是 Joye，很高興為您服務，請問今天有什麼可以幫到您？`;
}

/**
 * GET: 查單條 PendingApproval，給 /vip-pending 用
 * GET /api/vip/approvals/:id
 */
export async function GET(_req: Request, { params }: RouteParams) {
  try {
    const id = params.id;

    if (!id) {
      return NextResponse.json(
        { ok: false, error: "MISSING_ID" },
        { status: 400 }
      );
    }

    const approval = await prisma.pendingApproval.findUnique({
      where: { id },
      include: {
        vipGuest: {
          select: {
            fullName: true,
            preferredName: true,
            tier: true,
            room: true,
          },
        },
      },
    });

    if (!approval) {
      return NextResponse.json(
        { ok: false, error: "NOT_FOUND" },
        { status: 200 }
      );
    }

    // 這裡不再做自動補建 Session 的 fallback，
    // Session / sessionId 的創建統一放在 POST(審批通過) 裡面做，
    // 這樣邏輯單一也更好查。

    return NextResponse.json(
      {
        ok: true,
        approval: {
          id: approval.id,
          status: approval.status,
          reason: approval.reason,
          kfUrl: approval.kfUrl,
          sessionId: approval.sessionId,
          vipNumber: approval.vipNumber,
          version: approval.version,
          entryMode: approval.entryMode,
          scanChannel: approval.scanChannel,
          createdAt: approval.createdAt,
          vipGuest: approval.vipGuest,
        },
      },
      { status: 200 }
    );
  } catch (err) {
    console.error("Error in GET /api/vip/approvals/[id]:", err);
    return NextResponse.json(
      { ok: false, error: "SERVER_ERROR" },
      { status: 500 }
    );
  }
}

/**
 * 後台審批操作（Approve / Reject）：
 * POST /api/vip/approvals/:id
 *
 * body:
 * { action: "APPROVE" }
 * { action: "REJECT", reason?: string }
 * 也兼容 { status: "APPROVED" | "REJECTED" | "EXPIRED" }
 */
export async function POST(req: Request, { params }: RouteParams) {
  try {
    const id = params.id;

    if (!id) {
      return NextResponse.json(
        { ok: false, error: "MISSING_ID" },
        { status: 400 }
      );
    }

    const body = (await req.json().catch(() => ({}))) as any;

    let action: string | undefined = body?.action;
    const statusInput: string | undefined = body?.status;
    const reason: string | null =
      typeof body?.reason === "string" && body.reason.trim()
        ? body.reason.trim()
        : null;
    const agentId: string | null =
      typeof body?.agentId === "string" && body.agentId.trim()
        ? body.agentId.trim()
        : null;

    // 兼容 action / status 兩種寫法
    if (!action && statusInput) {
      action = statusInput;
    }

    if (!action) {
      return NextResponse.json(
        { ok: false, error: "INVALID_ACTION" },
        { status: 400 }
      );
    }

    const upper = action.toString().toUpperCase();

    let nextStatus: "APPROVED" | "REJECTED" | "EXPIRED";
    switch (upper) {
      case "APPROVE":
      case "APPROVED":
        nextStatus = "APPROVED";
        break;
      case "REJECT":
      case "REJECTED":
        nextStatus = "REJECTED";
        break;
      case "EXPIRE":
      case "EXPIRED":
        nextStatus = "EXPIRED";
        break;
      default:
        return NextResponse.json(
          { ok: false, error: "INVALID_ACTION" },
          { status: 400 }
        );
    }

    // 把這條申請拉出來（帶上 vipGuest，後面好組文案）
    const existing = await prisma.pendingApproval.findUnique({
      where: { id },
      include: {
        vipGuest: true,
      },
    });

    if (!existing) {
      return NextResponse.json(
        { ok: false, error: "NOT_FOUND" },
        { status: 200 }
      );
    }

    const now = new Date();

    // --------- 情況一：不是 APPROVED，只改狀態就好 ---------
    if (nextStatus !== "APPROVED") {
      const updated = await prisma.pendingApproval.update({
        where: { id },
        data: {
          status: nextStatus,
          reason: nextStatus === "REJECTED" ? reason : null,
          assignedAgentId: agentId ?? "demo-agent",
          assignedAt: now,
        },
        include: {
          vipGuest: {
            select: {
              fullName: true,
              preferredName: true,
              tier: true,
              room: true,
            },
          },
        },
      });

      return NextResponse.json(
        {
          ok: true,
          approval: {
            id: updated.id,
            status: updated.status,
            reason: updated.reason,
            kfUrl: updated.kfUrl,
            sessionId: updated.sessionId,
            vipNumber: updated.vipNumber,
            version: updated.version,
            entryMode: updated.entryMode,
            scanChannel: updated.scanChannel,
            createdAt: updated.createdAt,
            vipGuest: updated.vipGuest,
          },
        },
        { status: 200 }
      );
    }

    // ===========================
    // 下面是 APPROVED 的處理邏輯
    // ===========================

    // 先準備一些“可變”的本地變量，之後可以根據是否已有 VIP 來覆蓋
    let vipGuestIdToUse = existing.vipGuestId as string | null;
    let vipNumberToUse = existing.vipNumber as string | null;
    let preferredNameToUse: string | null =
      (existing.inputPreferredName &&
        existing.inputPreferredName.trim()) ||
      existing.vipGuest?.preferredName ||
      existing.vipGuest?.fullName ||
      null;

    // --------- 新邏輯：如果還沒有 VIP，就幫他創一個“Guest_xxxx” ---------
    if (!vipGuestIdToUse || !vipNumberToUse) {
      // 隨機 4 位數後綴，例如 2930
      const suffix = Math.floor(Math.random() * 10000)
        .toString()
        .padStart(4, "0");

      // 顯示名：Guest_2930
      const generatedGuestName =
        preferredNameToUse && preferredNameToUse.length > 0
          ? preferredNameToUse
          : `Guest_${suffix}`;

      // 隨機 VIP 號：例如 20 + 4 位 = 20008
      const generatedVipNumber = `20${suffix}`;

      // 創建一條新的 VipGuest
      const newVipGuest = await prisma.vipGuest.create({
        data: {
          vipNumber: generatedVipNumber,
          fullName: generatedGuestName,
          preferredName: generatedGuestName,
        },
      });

      vipGuestIdToUse = newVipGuest.id;
      vipNumberToUse = newVipGuest.vipNumber;
      preferredNameToUse =
        newVipGuest.preferredName || generatedGuestName;

      // 把 PendingApproval 裡也補齊這些信息（方便後面列表顯示）
      await prisma.pendingApproval.update({
        where: { id },
        data: {
          vipGuestId: vipGuestIdToUse,
          vipNumber: vipNumberToUse,
          // 如果之前沒有輸入 preferredName，就順便用 Guest_xxxx 填上
          inputPreferredName:
            existing.inputPreferredName &&
            existing.inputPreferredName.trim()
              ? existing.inputPreferredName
              : generatedGuestName,
        },
      });
    }

    // 這裡 vipGuestIdToUse / vipNumberToUse 理論上已經都有值了
    const safeVipNumber = vipNumberToUse || "0000";

    // 如果這次審批單上有客人輸入的 preferredName，
    // 優先同步到 VipGuest.preferredName，
    // 這樣會話列表 / 歡迎語 / VIP Profile 都用這個名字。
    if (
      vipGuestIdToUse &&
      typeof existing.inputPreferredName === "string" &&
      existing.inputPreferredName.trim()
    ) {
      const newPreferred = existing.inputPreferredName.trim();

      try {
        await prisma.vipGuest.update({
          where: { id: vipGuestIdToUse },
          data: { preferredName: newPreferred },
        });
        console.log("[vipApproval] updated vipGuest.preferredName", {
          vipGuestId: vipGuestIdToUse,
          preferredName: newPreferred,
        });
        preferredNameToUse = newPreferred;
      } catch (e) {
        console.error(
          "[vipApproval] failed to update vipGuest.preferredName",
          e
        );
      }
    }

        // --------- 把這次審批填的備註，同步寫到 VipGuest.notes ---------
    // （只在 APPROVED 分支裡，REJECT 不會寫入 VIP）
    if (vipGuestIdToUse && reason) {
      try {
        await prisma.vipGuest.update({
          where: { id: vipGuestIdToUse },
          data: { remark: reason },
        });

        console.log("[vipApproval] synced remark into vipGuest.remark", {
          vipGuestId: vipGuestIdToUse,
          remark: reason,
        });
      } catch (e) {
        console.error(
          "[vipApproval] failed to sync remark into vipGuest.remark",
          e
        );
      }
    }


    // --------- 情況二：APPROVED，要為 H5 / WeCom 做不同處理 ---------

    // 先沿用 DB 裡已有的值（理論上大多數情況都是 null）
    let sessionIdToUse: string | null = existing.sessionId ?? null;
    let kfUrlToUse: string | null = existing.kfUrl ?? null;

    // ✅ H5 入口（mode=h5）：
    // 為 H5/webchat／wechat 建 Session + 歡迎語
    if (existing.entryMode === "h5") {
      // 根據 scanChannel 判斷是「微信掃碼的 H5」還是「瀏覽器掃碼的 H5」
      const scanChannel = existing.scanChannel || "browser";
      const isWeChatScan = scanChannel === "wechat";

      // - 瀏覽器掃碼：openKfid = H5_OPENKFID, channel = "webchat"（出現在 Webchat tab）
      // - 微信掃碼：  openKfid = WECOM_OPENKFID, channel = "wechat"（出現在 WeChat tab）
      const openKfid = isWeChatScan ? WECOM_OPENKFID : H5_OPENKFID;
      const channel = isWeChatScan ? "wechat" : "webchat";

      // 優先用 inputChannelIdentifier（browserId / openid），沒有就退回 vipNumber
      const identifierSource =
        (existing.inputChannelIdentifier &&
          existing.inputChannelIdentifier.trim()) ||
        safeVipNumber;
      const externalUserId = `h5:${identifierSource}`;

      const displayName =
        preferredNameToUse ||
        existing.vipGuest?.preferredName ||
        existing.vipGuest?.fullName ||
        `VIP ${safeVipNumber}`;

      const welcomeText = buildWelcomeText({
        preferredName: preferredNameToUse,
        vipNumber: safeVipNumber,
      });

      // upsert Session（同一個 browserId/openid 多次掃碼命中同一會話）
      const session = await prisma.session.upsert({
        where: {
          openKfid_externalUserId: {
            openKfid,
            externalUserId,
          },
        },
        update: {
          displayName,
          channel,
          vipNumber: safeVipNumber,
          vipGuestId: vipGuestIdToUse ?? undefined,
          lastMsgAt: now,
          lastMsgPreview: welcomeText,
          channelIdentifier: existing.inputChannelIdentifier ?? null,
        },
        create: {
          openKfid,
          externalUserId,
          displayName,
          channel,
          vipNumber: safeVipNumber,
          vipGuestId: vipGuestIdToUse ?? undefined,
          lastMsgAt: now,
          lastMsgPreview: welcomeText,
          channelIdentifier: existing.inputChannelIdentifier ?? null,
        },
      });

      sessionIdToUse = session.id;

      // 寫一條系統歡迎語到 Message
      await prisma.message.create({
        data: {
          msgId: `vip-welcome-${session.id}-${now.getTime()}`,
          openKfid,
          externalUserId,
          origin: "system",
          msgType: "text",
          sendTime: now,
          payload: JSON.stringify({
            type: "system_welcome",
            text: welcomeText,
          }),
          direction: "out",
          text: welcomeText,
          hasSensitive: false,
          sensitiveHits: null,
          sessionId: session.id,
        },
      });
    }

    // ✅ WeCom / hybrid + 微信 掃碼的入口（entryMode === "wecom"）：
    // 審批通過後，直接設置企業微信客服鏈接，讓 /vip-pending 跳過去。
    if (existing.entryMode === "wecom") {
      kfUrlToUse = WECOM_FIXED_KF_URL;

      // 把這個 VIP 掛到當前 openKfid（企業微信客服賬號）上
      if (vipGuestIdToUse && vipNumberToUse) {
        setPendingVipBinding(
          WECOM_OPENKFID,
          vipGuestIdToUse,
          vipNumberToUse
        );
      } else {
        console.warn(
          "[vipApproval] entryMode=wecom but missing vipGuestId/vipNumber",
          {
            vipGuestId: vipGuestIdToUse,
            vipNumber: vipNumberToUse,
          }
        );
      }
    }

    // 4) 回填 PendingApproval 的狀態 & sessionId / kfUrl
    const updated = await prisma.pendingApproval.update({
      where: { id },
      data: {
        status: nextStatus,
        // ⭐ 不管 APPROVED / REJECTED，都把備註寫進 reason
        reason,
        assignedAgentId: agentId ?? "demo-agent",
        assignedAt: now,
        sessionId: sessionIdToUse,
        kfUrl: kfUrlToUse,
      },
      include: {
        vipGuest: {
          select: {
            fullName: true,
            preferredName: true,
            tier: true,
            room: true,
          },
        },
      },
    });

    return NextResponse.json(
      {
        ok: true,
        approval: {
          id: updated.id,
          status: updated.status,
          reason: updated.reason,
          kfUrl: updated.kfUrl,
          sessionId: updated.sessionId,
          vipNumber: updated.vipNumber,
          version: updated.version,
          entryMode: updated.entryMode,
          scanChannel: updated.scanChannel,
          createdAt: updated.createdAt,
          vipGuest: updated.vipGuest,
        },
      },
      { status: 200 }
    );
  } catch (err) {
    console.error("Error in POST /api/vip/approvals/[id]:", err);
    return NextResponse.json(
      { ok: false, error: "SERVER_ERROR" },
      { status: 500 }
    );
  }
}
