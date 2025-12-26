// app/api/wecom/sessions/[id]/messages/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

const ADMIN_TOKEN = process.env.ADMIN_TOKEN ?? "sync123";

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const adminToken = req.headers.get("x-admin-token");
    if (adminToken !== ADMIN_TOKEN) {
      return NextResponse.json(
        { ok: false, error: "unauthorized" },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(req.url);
    const openKfid = searchParams.get("open_kfid");
    const takeParam = searchParams.get("take");
    const take = takeParam ? Math.min(Number(takeParam) || 50, 200) : 50;

    if (!openKfid) {
      return NextResponse.json(
        { ok: false, error: "missing_open_kfid" },
        { status: 400 }
      );
    }

    const externalUserId = params.id; // 路径里的 :id = external_userid

    // ✅ 从“最新的”开始取，再反转成时间正序给前端
    const rowsDesc = await prisma.message.findMany({
      where: {
        openKfid,
        externalUserId,
      },
      orderBy: { sendTime: "desc" }, // 最新的在前
      take,
    });

    const rows = rowsDesc.slice().reverse(); // 转成从旧到新

    const messages = rows.map((m) => {
      let text = (m as any).text as string | null;
      if (!text) {
        const payload = m.payload as any;
        if (m.msgType === "text") {
          // 保险兜底一下
          text = payload?.text ?? payload?.content ?? "";
        } else {
          text = `[${m.msgType}]`;
        }
      }

      const sendDate =
        m.sendTime instanceof Date ? m.sendTime : new Date(m.sendTime as any);

      return {
        id: m.id,
        conversationId: externalUserId,
        direction: (m as any).direction === "out" ? "out" : "in",
        text: text ?? "",
        timestamp: sendDate.getTime(),
        timeLabel: sendDate.toLocaleTimeString("en-US", {
          hour: "numeric",
          minute: "2-digit",
        }),
        dateLabel: sendDate.toLocaleDateString("en-US", {
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
        }),
      };
    });

    return NextResponse.json({ ok: true, messages });
  } catch (e) {
    console.error("[wecom/messages] error:", e);
    return NextResponse.json(
      { ok: false, error: "internal_error" },
      { status: 500 }
    );
  }
}
