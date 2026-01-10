// app/api/vip/approvals/[id]/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";

interface RouteParams {
  params: { id: string };
}

// 随便定义一个 H5 用的 openKfId，主要用来跟 externalUserId 组成唯一键
const H5_OPENKFID = "H5_WEBCHAT_DEMO";

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

    let sessionIdToUse: string | null = existing.sessionId ?? null;
    // 🆕 新增：為了寫回企業微信跳轉鏈接
    let kfUrlToUse: string | null = existing.kfUrl ?? null;

    // 目前我們只為 H5 入口（entryMode === 'h5'）創建 Session；
    // WeCom 入口的會話是通過企業微信同步那條鏈路建的。
    if (existing.entryMode === "h5") {
      // 1) 準備 openKfId / externalUserId / channel
      const openKfid = H5_OPENKFID;

      // 優先用 inputChannelIdentifier（browserId），沒有就退回 vipNumber
      const identifierSource =
        existing.inputChannelIdentifier?.trim() || existing.vipNumber;
      const externalUserId = `h5:${identifierSource}`;

      // 這個必須跟 Inbox 裡 webchat channel 的名字一致
      const channel = "webchat";

      // 顯示用的名字
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

      // 2) upsert 一條 Session（保證同一個 browserId 多次掃碼命中同一條）
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

      // 3) 在 Message 裡插入一條系統歡迎語
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
    // 🆕 新增：WeCom 混合場景（entryMode === 'wecom'，一般就是微信掃碼 + hybrid）
    else if (existing.entryMode === "wecom") {
      // 這裡用你之前企業微信客服的 URL 配置
      // 如果你原來用的是其他 env 名字，把這兩行改成你原來的就行
      const envKfUrl =
        process.env.NEXT_PUBLIC_WECOM_KF_URL || process.env.WECOM_KF_URL || "";

      if (!envKfUrl) {
        console.error(
          "[vip/approvals] WECOM_KF_URL not configured in env vars; pendingApproval.id=",
          existing.id
        );
        // 沒配置我們就不強行設置，前端會一直停在 Connecting，
        // 你只需要補上 env，重新 deploy 即可。
      } else {
        kfUrlToUse = envKfUrl;
      }
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
