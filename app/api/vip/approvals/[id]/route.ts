// app/api/vip/approvals/[id]/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";

interface RouteParams {
  params: { id: string };
}

function safeTrim(str: string | null | undefined): string {
  return (str ?? "").trim();
}

// 构建「同姓 / 同名」候选列表
async function buildNameCandidates(approval: any) {
  const candidates: any[] = [];
  const seen = new Set<string>();

  // 1) 同 VIP 號（不管名字有沒對上，都列出來給前台看）
  if (approval.vipNumber) {
    const byNumber = await prisma.vipGuest.findUnique({
      where: { vipNumber: approval.vipNumber },
    });
    if (byNumber) {
      candidates.push(byNumber);
      seen.add(byNumber.id);
    }
  }

  // 2) 同名 / 同姓：用 inputPreferredName 來匹配
  const inputName = safeTrim(approval.inputPreferredName);
  if (inputName) {
    const normalized = inputName.replace(/\s+/g, "");
    const firstChar = normalized[0];

    const byName = await prisma.vipGuest.findMany({
      where: {
        OR: [
          // 完整名字包含（中英都適用）
          { fullName: { contains: inputName } },
          { preferredName: { contains: inputName } },

          // 同姓（中文場景：用第一個字做 startsWith）
          ...(firstChar
            ? [
                { fullName: { startsWith: firstChar } },
                { preferredName: { startsWith: firstChar } },
              ]
            : []),
        ],
      },
      take: 10,
    });

    for (const g of byName) {
      if (!seen.has(g.id)) {
        seen.add(g.id);
        candidates.push(g);
      }
    }
  }

  return candidates;
}

// GET：查單條 PendingApproval（給 /vip-pending + 後台詳情）
export async function GET(_req: Request, { params }: RouteParams) {
  const { id } = params;

  if (!id) {
    return NextResponse.json(
      { ok: false, error: "MISSING_ID" },
      { status: 400 }
    );
  }

  try {
    const approval = await prisma.pendingApproval.findUnique({
      where: { id },
      include: {
        vipGuest: true,
      },
    });

    if (!approval) {
      return NextResponse.json(
        { ok: false, error: "NOT_FOUND" },
        { status: 404 }
      );
    }

    const nameCandidates = await buildNameCandidates(approval);

    return NextResponse.json(
      {
        ok: true,
        approval,
        nameCandidates,
      },
      { status: 200 }
    );
  } catch (err) {
    console.error("GET /api/vip/approvals/[id] error:", err);
    return NextResponse.json(
      { ok: false, error: "SERVER_ERROR" },
      { status: 500 }
    );
  }
}

// POST：審批動作（APPROVE / REJECT），APPROVE 時可以帶 bindVipGuestId 綁定 CRM VIP
export async function POST(req: Request, { params }: RouteParams) {
  const { id } = params;

  if (!id) {
    return NextResponse.json(
      { ok: false, error: "MISSING_ID" },
      { status: 400 }
    );
  }

  try {
    const body = await req.json().catch(() => ({}));
    const action = body?.action as "APPROVE" | "REJECT" | undefined;
    const bindVipGuestId = body?.bindVipGuestId as string | undefined;

    if (action !== "APPROVE" && action !== "REJECT") {
      return NextResponse.json(
        { ok: false, error: "INVALID_ACTION" },
        { status: 400 }
      );
    }

    const approval = await prisma.pendingApproval.findUnique({
      where: { id },
    });

    if (!approval) {
      return NextResponse.json(
        { ok: false, error: "NOT_FOUND" },
        { status: 404 }
      );
    }

    if (approval.status !== "PENDING") {
      return NextResponse.json(
        { ok: false, error: "ALREADY_PROCESSED" },
        { status: 400 }
      );
    }

    if (action === "REJECT") {
      const updated = await prisma.pendingApproval.update({
        where: { id },
        data: {
          status: "REJECTED",
          assignedAt: new Date(),
        },
      });

      return NextResponse.json(
        { ok: true, approval: updated },
        { status: 200 }
      );
    }

    // APPROVE 分支
    let vipGuestIdToUse: string | null = approval.vipGuestId;

    // 如果前台手動選了某個 VIP，就用這個做綁定
    if (bindVipGuestId) {
      vipGuestIdToUse = bindVipGuestId;
    }

    // TODO：之後在這裡創建 Session / H5 chat / kfUrl 等

    const updated = await prisma.pendingApproval.update({
      where: { id },
      data: {
        status: "APPROVED",
        vipGuestId: vipGuestIdToUse,
        assignedAt: new Date(),
        // assignedAgentId 之後再接你的客服登入系統
      },
    });

    return NextResponse.json(
      { ok: true, approval: updated },
      { status: 200 }
    );
  } catch (err) {
    console.error("POST /api/vip/approvals/[id] error:", err);
    return NextResponse.json(
      { ok: false, error: "SERVER_ERROR" },
      { status: 500 }
    );
  }
}
