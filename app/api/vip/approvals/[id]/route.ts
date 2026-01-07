// app/api/vip/approvals/[id]/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";

interface RouteParams {
  params: { id: string };
}

/**
 * 查單條 PendingApproval 給 /vip-pending 用：
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
 * body 可以是：
 * { action: "APPROVE" } 或 { action: "REJECT", reason?: string }
 * 也兼容 { status: "APPROVED" | "REJECTED", reason?: string }
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

    // 兼容兩種寫法：action 或 status
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

    // 先確認這條申請存在
    const existing = await prisma.pendingApproval.findUnique({
      where: { id },
    });

    if (!existing) {
      return NextResponse.json(
        { ok: false, error: "NOT_FOUND" },
        { status: 200 }
      );
    }

    // TODO：未來在這裡補：Approve 時自動生成 Session / kfUrl / sessionId 等
    // 目前先只更新狀態，讓按鈕恢復可用

    const updated = await prisma.pendingApproval.update({
      where: { id },
      data: {
        status: nextStatus,
        // 只有 REJECTED 才保留 reason，其它情況清空
        reason: nextStatus === "REJECTED" ? reason : null,
        assignedAgentId: agentId ?? "demo-agent",
        assignedAt: new Date(),
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
