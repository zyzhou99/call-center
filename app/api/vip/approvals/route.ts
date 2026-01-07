// app/api/vip/approvals/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";

// 简单版本：一次性把所有 PendingApproval 拉出来（含 VipGuest 信息）
// 过滤、统计都放到前端做，POC 够用
export async function GET() {
  try {
    const items = await prisma.pendingApproval.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        vipGuest: true,
      },
    });

    return NextResponse.json({ ok: true, items });
  } catch (err) {
    console.error("[GET /api/vip/approvals]", err);
    return NextResponse.json(
      { ok: false, error: "SERVER_ERROR" },
      { status: 500 }
    );
  }
}
