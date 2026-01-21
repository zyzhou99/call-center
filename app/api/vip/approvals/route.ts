// app/api/vip/approvals/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";

type VipStatus = "PENDING" | "APPROVED" | "REJECTED" | "EXPIRED";

function normalizeStatus(input?: string | null): VipStatus | undefined {
  if (!input) return undefined;
  const upper = input.toUpperCase();
  if (upper === "PENDING") return "PENDING";
  if (upper === "APPROVED") return "APPROVED";
  if (upper === "REJECTED") return "REJECTED";
  if (upper === "EXPIRED") return "EXPIRED";
  return undefined;
}

/**
 * VIP Requests 列表（給 Inbox 用）：
 *
 * GET /api/vip/approvals
 * GET /api/vip/approvals?status=PENDING
 */
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const statusParam = searchParams.get("status");

    const status = normalizeStatus(statusParam);

    const where: any = {};

    // 如果帶了 ?status=PENDING，就只取該狀態
    if (status) {
      where.status = status;
    }

    const approvals = await prisma.pendingApproval.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: {
        vipGuest: {
          select: {
            fullName: true,
            preferredName: true,
            tier: true,
            room: true,
            birthdayMd: true,
          },
        },
      },
    });

    // ⚠️ 重點：這裡字段名改成 approvals，對齊前端期待的格式
    return NextResponse.json(
      {
        ok: true,
        approvals: approvals.map((a) => ({
          id: a.id,
          status: a.status,
          reason: a.reason,
          kfUrl: a.kfUrl,
          sessionId: a.sessionId,
          vipNumber: a.vipNumber,
          version: a.version,
          entryMode: a.entryMode,
          scanChannel: a.scanChannel,
          createdAt: a.createdAt,
          updatedAt: a.updatedAt,

          // 申請時填的東西
          inputPreferredName: a.inputPreferredName,
          inputBirthdayMd: a.inputBirthdayMd,
          inputChannelIdentifier: a.inputChannelIdentifier,
          inputPhoneNumber: a.inputPhoneNumber,

          vipGuest: a.vipGuest
            ? {
                fullName: a.vipGuest.fullName,
                preferredName: a.vipGuest.preferredName,
                tier: a.vipGuest.tier,
                room: a.vipGuest.room,
                birthdayMd: a.vipGuest.birthdayMd,
              }
            : null,
        })),
      },
      { status: 200 }
    );
  } catch (err) {
    console.error("[GET /api/vip/approvals]", err);
    return NextResponse.json(
      { ok: false, error: "SERVER_ERROR" },
      { status: 500 }
    );
  }
}
