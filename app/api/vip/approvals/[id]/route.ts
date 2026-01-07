// app/api/vip/approvals/[id]/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";

type Action = "APPROVE" | "REJECT";

interface DecisionBody {
  action: Action;
  reason?: string;
}

// 详情（目前前端用不到很多字段，但留着）
export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const { id } = params;
  try {
    const item = await prisma.pendingApproval.findUnique({
      where: { id },
      include: { vipGuest: true },
    });

    if (!item) {
      return NextResponse.json(
        { ok: false, error: "NOT_FOUND" },
        { status: 404 }
      );
    }

    return NextResponse.json({ ok: true, item });
  } catch (err) {
    console.error("[GET /api/vip/approvals/:id]", err);
    return NextResponse.json(
      { ok: false, error: "SERVER_ERROR" },
      { status: 500 }
    );
  }
}

// 审批：Approve / Reject
export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  const { id } = params;

  try {
    const body = (await req.json()) as Partial<DecisionBody>;
    const action = body.action;

    if (action !== "APPROVE" && action !== "REJECT") {
      return NextResponse.json(
        { ok: false, error: "INVALID_ACTION" },
        { status: 400 }
      );
    }

    const existing = await prisma.pendingApproval.findUnique({
      where: { id },
    });

    if (!existing) {
      return NextResponse.json(
        { ok: false, error: "NOT_FOUND" },
        { status: 404 }
      );
    }

    // 后面可以根据实际登录用户写成 req.user.id 之类，这里先用 demo
    const assignedAgentId = "demo-agent";
    const now = new Date();

    if (action === "APPROVE") {
      // 👉 简化版：先只改状态 + assigned 信息
      // 后续可以在这里：
      // - entryMode = 'wecom' 时生成 kfUrl
      // - entryMode = 'h5' 时创建 Session + 欢迎消息 + sessionId
      const updated = await prisma.pendingApproval.update({
        where: { id },
        data: {
          status: "APPROVED",
          assignedAgentId,
          assignedAt: now,
        },
        include: { vipGuest: true },
      });

      return NextResponse.json({ ok: true, item: updated });
    }

    // REJECT
    const updated = await prisma.pendingApproval.update({
      where: { id },
      data: {
        status: "REJECTED",
        reason: body.reason ?? null,
        assignedAgentId,
        assignedAt: now,
      },
      include: { vipGuest: true },
    });

    return NextResponse.json({ ok: true, item: updated });
  } catch (err) {
    console.error("[POST /api/vip/approvals/:id]", err);
    return NextResponse.json(
      { ok: false, error: "SERVER_ERROR" },
      { status: 500 }
    );
  }
}
