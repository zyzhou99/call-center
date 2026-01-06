// app/api/vip/approvals/[id]/approve/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { ensureChatwootContactAndConversation } from "@/lib/chatwoot";

interface RouteParams {
  params: { id: string };
}

const DEFAULT_ASSIGNEE_ID = Number(process.env.CHATWOOT_DEFAULT_ASSIGNEE_ID ?? 0) || undefined;

export async function POST(_req: Request, { params }: RouteParams) {
  const { id } = params;

  try {
    // 1) 查 PendingApproval + VIP 信息
    const pending = await prisma.pendingApproval.findUnique({
      where: { id },
      include: {
        vipGuest: true,
      },
    });

    if (!pending) {
      return NextResponse.json(
        { ok: false, error: "NOT_FOUND" },
        { status: 404 }
      );
    }

    if (pending.status !== "PENDING") {
      return NextResponse.json(
        { ok: false, error: "ALREADY_PROCESSED" },
        { status: 400 }
      );
    }

    const vip = pending.vipGuest;
    if (!vip) {
      return NextResponse.json(
        { ok: false, error: "VIP_GUEST_MISSING" },
        { status: 400 }
      );
    }

    const displayName =
      pending.preferredName || vip.preferredName || vip.fullName;
    const mode = pending.mode || "h5";

    // 2) 调 Chatwoot：拿到 contactIdentifier + conversationId
    const { contactIdentifier, conversationId } =
      await ensureChatwootContactAndConversation({
        vipNumber: pending.vipNumber,
        displayName,
        mode,
        platform: pending.platform,
        assigneeId: DEFAULT_ASSIGNEE_ID,
      });

    // 3) 写回 PendingApproval
    const updated = await prisma.pendingApproval.update({
      where: { id },
      data: {
        status: "APPROVED",
        contactIdentifier,
        conversationId,
      },
    });

    return NextResponse.json({
      ok: true,
      id: updated.id,
      status: updated.status,
      contactIdentifier,
      conversationId,
      mode,
    });
  } catch (err: any) {
    console.error("Error approving pending", err);

    // Prisma 没找到记录
    if (err?.code === "P2025") {
      return NextResponse.json(
        { ok: false, error: "NOT_FOUND" },
        { status: 404 }
      );
    }

    // 其他任何错误（包含 Chatwoot 调用失败）
    return NextResponse.json(
      { ok: false, error: "SERVER_ERROR" },
      { status: 500 }
    );
  }
}
