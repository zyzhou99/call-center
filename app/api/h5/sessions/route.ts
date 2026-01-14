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

    const payload = sessions.map((s) => ({
      id: s.id,
      // ✅ 把真實的 channel 帶給前端：可能是 "webchat" 也可能是 "wechat"
      channel: s.channel,
      displayName:
        s.displayName ||
        s.vipGuest?.preferredName ||
        s.vipGuest?.fullName ||
        (s.vipNumber
          ? `VIP ${s.vipNumber}`
          : s.externalUserId || s.id),
      lastMsgPreview: s.lastMsgPreview ?? "",
      vipNumber: s.vipNumber,
      // 前端目前把 lastMsgAt 當 string 用，所以保持 toISOString
      lastMsgAt: (s.lastMsgAt ?? s.createdAt).toISOString(),
      unreadCount: s.unreadCount ?? 0,
      vipGuest: s.vipGuest
        ? {
            id: s.vipGuest.id,
            fullName: s.vipGuest.fullName,
            preferredName: s.vipGuest.preferredName,
            tier: s.vipGuest.tier,
            room: s.vipGuest.room,
            // ✅ 把喜好/忌諱也帶給前端（你表裡已經有這兩個欄位了）
            preference: (s.vipGuest as any).preference ?? null,
            restriction: (s.vipGuest as any).restriction ?? null,
          }
        : null,
    }));

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
