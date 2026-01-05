// app/api/vip/pending/[id]/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

interface PendingParams {
  id: string;
}

export async function GET(
  req: Request,
  context: { params: PendingParams }
) {
  try {
    const { id } = context.params;

    const pending = await prisma.pendingApproval.findUnique({
      where: { id },
    });

    if (!pending) {
      return NextResponse.json(
        { ok: false, error: "NOT_FOUND" },
        { status: 404 }
      );
    }

    // 先把状态和必要信息暴露给前端
    return NextResponse.json({
      ok: true,
      status: pending.status, // "PENDING" | "APPROVED" | "REJECTED"
      vipNumber: pending.vipNumber,
      preferredName: pending.preferredName,
      reason: pending.reason ?? null,
      contactIdentifier: pending.contactIdentifier ?? null,
      conversationId: pending.conversationId ?? null,
      mode: pending.mode,
    });
  } catch (err) {
    console.error("Error in GET /api/vip/pending/[id]", err);
    return NextResponse.json(
      { ok: false, error: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}
