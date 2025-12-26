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

  // ✅ 统一用北京时间显示
  const timeLabel = new Intl.DateTimeFormat("zh-CN", {
    timeZone: "Asia/Shanghai",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false, // 24 小时制：14:02
  }).format(sendDate);

  const dateLabel = new Intl.DateTimeFormat("zh-CN", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(sendDate);

  return {
    id: m.id,
    conversationId: externalUserId, // 前端用 external_userid 当 conversationId
    direction: (m as any).direction === "out" ? "out" : "in",
    text,
    timestamp: sendDate.getTime(), // 这个给前端算相对时间用，保持不变
    timeLabel,
    dateLabel,
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
