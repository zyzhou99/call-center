// app/api/vip/approvals/[id]/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";

interface RouteParams {
  params: { id: string };
}

// H5 用的 openKfId，占位：只用來和 externalUserId 做唯一鍵（瀏覽器掃碼的 H5）
const H5_OPENKFID = "H5_WEBCHAT_DEMO";

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

      // ⭐ 核心調整：
      // - 瀏覽器掃碼：openKfid = H5_OPENKFID, channel = "webchat"（出現在 Webchat tab）
      // - 微信掃碼：  openKfid = WECOM_OPENKFID, channel = "wechat"（出現在 WeChat tab）
      const openKfid = isWeChatScan ? WECOM_OPENKFID : H5_OPENKFID;
      const channel = isWeChatScan ? "wechat" : "webchat";

      // 優先用 inputChannelIdentifier（browserId / openid），沒有就退回 vipNumber
      const identifierSource =
        existing.inputChannelIdentifier?.trim() || existing.vipNumber;
      const externalUserId = `h5:${identifierSource}`;

      const displayName =
        existing.inputPreferredName ||
        existing.vipGuest?.preferredName ||
        existing.vipGuest?.fullName ||
        `VIP ${existing.vipNumber}`;

      const welcomeText = buildWelcomeText({
        preferredName:
          existing.inputPreferredName ?? existing.vipGuest?.preferredName,
        vipNumber: existing.vipNumber,
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
          vipNumber: existing.vipNumber,
          vipGuestId: existing.vipGuestId,
          lastMsgAt: now,
          lastMsgPreview: welcomeText,
        },
        create: {
          openKfid,
          externalUserId,
          displayName,
          channel,
          vipNumber: existing.vipNumber,
          vipGuestId: existing.vipGuestId,
          lastMsgAt: now,
          lastMsgPreview: welcomeText,
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
    }

    // 4) 回填 PendingApproval 的狀態 & sessionId / kfUrl
    const updated = await prisma.pendingApproval.update({
      where: { id },
      data: {
        status: nextStatus,
        reason: null, // APPROVED 不存 reason
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
