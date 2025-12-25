// app/api/wecom/sessions/[id]/messages/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

const ADMIN_TOKEN = process.env.ADMIN_TOKEN ?? "sync123";

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // 简单保护
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
    const take = takeParam ? Math.min(Number(takeParam) || 20, 100) : 20;

    if (!openKfid) {
      return NextResponse.json(
        { ok: false, error: "missing_open_kfid" },
        { status: 400 }
      );
    }

    const externalUserId = params.id; // 路径里的 :id = external_userid

    const rows = await prisma.message.findMany({
      where: {
        openKfid,
        externalUserId,
      },
      orderBy: { sendTime: "asc" }, // 时间顺序
      take,
    });

    // 映射成前端用的 Message 类型
    const messages = rows.map((m) => {
      // 文本优先从 m.text 拿，兜底从 payload 里拿
      let text = (m as any).text as string | null;
      if (!text) {
        const payload = m.payload as any;
        if (m.msgType === "text") {
          text = payload?.text ?? "";
        } else {
          text = `[${m.msgType}]`;
        }
      }

      const sendDate = new Date(m.sendTime);

      return {
        id: m.id,
        conversationId: externalUserId, // 前端这边就用 external_userid 当 conversationId
        direction: (m as any).direction === "out" ? "out" : "in",
        text,
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
