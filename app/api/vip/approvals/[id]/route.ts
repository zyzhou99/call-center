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
    return `您好尊貴的貴賓，歡迎下榻永利皇宮，我是 Joye，很高興為您服務，請問今天有什麼可以幫到您？`;
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
 *
 * ✅ 新增：支持
 * - inputVipNumber
 * - inputPreferredName
 * - inputPhoneNumber
 * 這三個字段，從前端 request detail 確認後傳入。
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

    // ✅ 新增：前端傳來的最終確認值
    const inputVipNumberFromBody: string =
      typeof body?.inputVipNumber === "string" && body.inputVipNumber.trim()
        ? body.inputVipNumber.trim()
        : "";
    const inputPreferredNameFromBody: string =
      typeof body?.inputPreferredName === "string" &&
      body.inputPreferredName.trim()
        ? body.inputPreferredName.trim()
        : "";
    const inputPhoneNumberFromBody: string =
      typeof body?.inputPhoneNumber === "string" &&
      body.inputPhoneNumber.trim()
        ? body.inputPhoneNumber.trim()
        : "";

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
          // REJECT / EXPIRED 也保留 reason
          reason: nextStatus === "REJECTED" ? reason : reason,
          assignedAgentId: agentId ?? "demo-agent",
          assignedAt: now,
          // 順便把前端確認的值同步一下（可選）
          vipNumber:
            inputVipNumberFromBody || existing.vipNumber || undefined,
          inputPreferredName:
            inputPreferredNameFromBody ||
            existing.inputPreferredName ||
            undefined,
          inputPhoneNumber:
            inputPhoneNumberFromBody ||
            existing.inputPhoneNumber ||
            undefined,
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

    // 最終要寫回去的幾個值（先組一份“候選值”）
    let vipGuestIdToUse = existing.vipGuestId as string | null;

    let vipNumberToUse: string | null =
      inputVipNumberFromBody ||
      existing.vipNumber ||
      null;

    let preferredNameToUse: string | null =
      inputPreferredNameFromBody ||
      (existing.inputPreferredName?.trim() || "") ||
      (existing.vipGuest?.preferredName?.trim() || "") ||
      (existing.vipGuest?.fullName?.trim() || "") ||
      null;

    let phoneNumberToUse: string | null =
      inputPhoneNumberFromBody ||
      (existing.inputPhoneNumber?.trim() || "") ||
      null;

    // 兜底一下 vipNumber
    if (!vipNumberToUse) {
      const suffix = Math.floor(Math.random() * 10000)
        .toString()
        .padStart(4, "0");
      vipNumberToUse = `20${suffix}`;
    }

    // --------- 有已有 VipGuest：更新它 ---------
    if (vipGuestIdToUse && existing.vipGuest) {
      try {
        const updatedGuest = await prisma.vipGuest.update({
          where: { id: vipGuestIdToUse },
          data: {
            vipNumber: vipNumberToUse,
            preferredName: preferredNameToUse || undefined,
            // 如果原來沒有 fullName，就用這次確認的 preferredName 當作 fullName
            fullName:
              existing.vipGuest.fullName ||
              preferredNameToUse ||
              undefined,
            contactPhone: phoneNumberToUse || undefined,
          },
        });

        vipGuestIdToUse = updatedGuest.id;
        vipNumberToUse = updatedGuest.vipNumber;
        preferredNameToUse =
          updatedGuest.preferredName || preferredNameToUse;
      } catch (e) {
        console.error(
          "[vipApproval] failed to update existing VipGuest",
          e
        );
      }
    }

    // --------- 還沒有 VipGuest：創一個新的 ---------
    if (!vipGuestIdToUse) {
      const suffix = Math.floor(Math.random() * 10000)
        .toString()
        .padStart(4, "0");

      const baseName =
        preferredNameToUse ||
        (existing.inputDisplayName?.trim() || "") ||
        `Guest_${suffix}`;

      try {
        const newVipGuest = await prisma.vipGuest.create({
          data: {
            vipNumber: vipNumberToUse!,
            fullName: baseName,
            preferredName: preferredNameToUse || baseName,
            contactPhone: phoneNumberToUse || undefined,
          },
        });

        vipGuestIdToUse = newVipGuest.id;
        vipNumberToUse = newVipGuest.vipNumber;
        preferredNameToUse = newVipGuest.preferredName;
      } catch (e) {
        console.error("[vipApproval] failed to create VipGuest", e);
      }
    }

    const safeVipNumber = vipNumberToUse || "0000";

    // --------- 把這次審批的備註，同步寫到 VipGuest.remark ---------
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

    // --------- H5 / WeCom 不同入口的會話處理 ---------

    let sessionIdToUse: string | null = existing.sessionId ?? null;
    let kfUrlToUse: string | null = existing.kfUrl ?? null;

    // ✅ H5 入口（mode=h5）：
    if (existing.entryMode === "h5") {
      const scanChannel = existing.scanChannel || "browser";
      const isWeChatScan = scanChannel === "wechat";

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
          phoneNumber: phoneNumberToUse || undefined,
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
          phoneNumber: phoneNumberToUse || undefined,
        },
      });

      sessionIdToUse = session.id;

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

    // ✅ WeCom / hybrid + 微信 掃碼入口（entryMode === "wecom"）
    if (existing.entryMode === "wecom") {
      kfUrlToUse = WECOM_FIXED_KF_URL;

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

    // 4) 回填 PendingApproval 的狀態 & 基本欄位
    const updated = await prisma.pendingApproval.update({
      where: { id },
      data: {
        status: nextStatus,
        reason,
        assignedAgentId: agentId ?? "demo-agent",
        assignedAt: now,
        sessionId: sessionIdToUse,
        kfUrl: kfUrlToUse,
        vipGuestId: vipGuestIdToUse ?? existing.vipGuestId,
        vipNumber: vipNumberToUse ?? existing.vipNumber,
        inputPreferredName:
          inputPreferredNameFromBody ||
          preferredNameToUse ||
          existing.inputPreferredName ||
          undefined,
        inputPhoneNumber:
          inputPhoneNumberFromBody ||
          phoneNumberToUse ||
          existing.inputPhoneNumber ||
          undefined,
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
