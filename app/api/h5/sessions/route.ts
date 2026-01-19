// app/api/h5/sessions/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";

// ✅ 和 /api/vip/entry、/api/vip/approvals/[id] 使用同一個 H5 openKfId
const H5_OPENKFID =
  process.env.NEXT_PUBLIC_H5_OPENKFID || "H5_WEBCHAT";

export async function GET() {
  try {
    const sessions = await prisma.session.findMany({
      where: {
        openKfid: H5_OPENKFID,
        // ✅ 同時包含瀏覽器 H5（webchat）和微信內 H5（wechat）
        channel: { in: ["webchat", "wechat"] },
      },
      include: {
        vipGuest: true,
      },
      orderBy: [
        { lastMsgAt: "desc" },
        { createdAt: "desc" },
      ],
    });

    const payload = sessions.map((s) => {
      const g = s.vipGuest;

      // ⭐ 从 vipGuest 里拿最新的名字
      const preferredName =
        (g?.preferredName && g.preferredName.trim()) || null;
      const fullName =
        (g?.fullName && g.fullName.trim()) || null;

      // ⭐ displayName 优先用 vipGuest 的名字，其次才是 session.displayName
      const displayName =
        preferredName ||
        fullName ||
        s.displayName ||
        (s.vipNumber
          ? `VIP ${s.vipNumber}`
          : s.externalUserId || s.id);

      return {
        id: s.id,
        // ✅ 把真實的 channel 帶給前端：可能是 "webchat" 也可能是 "wechat"
        channel: s.channel,

        // 会话列表 / ChatPanel 统一用这个 displayName
        displayName,
        // 额外把 fullName / preferredName 摊平给前端（我们在前端用 `(conversation as any).preferredName`）
        preferredName,
        fullName,

        lastMsgPreview: s.lastMsgPreview ?? "",
        vipNumber: s.vipNumber,
        // 前端目前把 lastMsgAt 當 string 用，所以保持 toISOString
        lastMsgAt: (s.lastMsgAt ?? s.createdAt).toISOString(),
        unreadCount: s.unreadCount ?? 0,

        // 保留之前的 vipGuest 子对象（给 profile、history 等用）
        vipGuest: g
          ? {
              id: g.id,
              fullName: g.fullName,
              preferredName: g.preferredName,
              tier: g.tier,
              room: g.room,
              // ✅ 把喜好/忌諱也帶給前端（你表裡已經有這兩個欄位了）
              preference: (g as any).preference ?? null,
              restriction: (g as any).restriction ?? null,
              remark: (g as any).remark ?? null,
            }
          : null,
      };
    });

    return NextResponse.json(
      { ok: true, sessions: payload },
      { status: 200 }
    );
  } catch (err) {
    console.error("Error in GET /api/h5/sessions:", err);
    return NextResponse.json(
      { ok: false, error: "SERVER_ERROR" },
      { status: 500 }
    );
  }
}
