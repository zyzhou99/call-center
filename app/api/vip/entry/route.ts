// app/api/vip/entry/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";
// 每次都走动态逻辑，不要静态缓存
export const dynamic = "force-dynamic";

// 简单约定一个 H5 的 openKfid（只是标识用，不和企业微信抢）
const H5_OPENKFID = process.env.NEXT_PUBLIC_H5_OPENKFID || "H5_WEBCHAT";

export async function POST(req: NextRequest) {
  try {
    const body: any = await req.json().catch(() => ({}));

    // ✅ 支持两种字段：qrCode（推荐）和 token（兼容老写法）
    const qrCode =
      typeof body.qrCode === "string" && body.qrCode.trim().length > 0
        ? body.qrCode.trim()
        : undefined;

    const token =
      typeof body.token === "string" && body.token.trim().length > 0
        ? body.token.trim()
        : undefined;

    const channelIdentifier =
      typeof body.channelIdentifier === "string" &&
      body.channelIdentifier.trim().length > 0
        ? body.channelIdentifier.trim()
        : undefined;

    // 原始 scanChannel，可能是 "wechat" 或 "browser"
    const rawScanChannel =
      typeof body.scanChannel === "string"
        ? body.scanChannel.trim().toLowerCase()
        : "";

    // 规范化后的 scanChannel：只认 wechat / browser 两种
    const scanChannel = rawScanChannel === "wechat" ? "wechat" : "browser";

    // 🔒 必填：qrCode 或 token 至少一个
    if (!qrCode && !token) {
      return NextResponse.json(
        { ok: false, error: "MISSING_QRCODE_OR_TOKEN" },
        { status: 400 }
      );
    }

    // 🔒 必填：channelIdentifier（前端用来标识「哪个浏览器 / 设备」）
    if (!channelIdentifier) {
      return NextResponse.json(
        { ok: false, error: "MISSING_CHANNEL_IDENTIFIER" },
        { status: 400 }
      );
    }

    // 1. 根据 qrCode / token 找到 VipGuest
    //    - 优先使用 qrCode
    //    - 没有 qrCode 再退回用 token 匹配 id / vipNumber
    let vip = null;

    if (qrCode) {
      vip = await prisma.vipGuest.findFirst({
        where: { qrCode },
      });
    } else if (token) {
      vip = await prisma.vipGuest.findFirst({
        where: {
          OR: [{ id: token }, { vipNumber: token }],
        },
      });
    }

    if (!vip) {
      return NextResponse.json(
        { ok: false, error: "VIP_NOT_FOUND" },
        { status: 404 }
      );
    }

    // 2. 根据扫的渠道决定 Session.channel & externalUserId：
    //
    //    - 手机浏览器 / 相机扫码  → channel = "webchat"
    //      externalUserId = "h5:"   + browserId
    //
    //    - 微信内扫码（H5 模式） → channel = "wechat"
    //      externalUserId = "wxh5:" + browserId
    //
    //    两种都用同一个 H5_OPENKFID，只是 channel 不同，用来在列表里分类。
    const openKfid = H5_OPENKFID;
    const channel: "webchat" | "wechat" =
      scanChannel === "wechat" ? "wechat" : "webchat";

    const externalUserId =
      channel === "wechat"
        ? `wxh5:${channelIdentifier}`
        : `h5:${channelIdentifier}`;

    // 3. 尝试复用已有 Session：同一 openKfid + externalUserId + channel
    let session = await prisma.session.findFirst({
      where: {
        openKfid,
        externalUserId,
        channel,
      },
    });

    if (session) {
      // 已有会话 → 补齐 VIP 关联 / 名字
      session = await prisma.session.update({
        where: { id: session.id },
        data: {
          vipGuestId: vip.id,
          vipNumber: vip.vipNumber,
          displayName:
            vip.preferredName && vip.preferredName.trim() !== ""
              ? vip.preferredName
              : vip.fullName,
        },
      });
    } else {
      // 4. 没有会话 → 新建一条会话（channel 已经是 webchat 或 wechat）
      session = await prisma.session.create({
        data: {
          openKfid,
          externalUserId,
          channelIdentifier,
          channel,
          displayName:
            vip.preferredName && vip.preferredName.trim() !== ""
              ? vip.preferredName
              : vip.fullName,
          vipGuestId: vip.id,
          vipNumber: vip.vipNumber,
          lastMsgAt: null,
          lastMsgPreview: "",
        },
      });
    }

    // 5. 如果这个 Session 下面还没有任何消息，就自动发一条 system welcome
    const existingMsgCount = await prisma.message.count({
      where: { sessionId: session.id },
    });

    if (existingMsgCount === 0) {
      const now = new Date();
      const displayName =
        vip.preferredName && vip.preferredName.trim() !== ""
          ? vip.preferredName
          : vip.fullName;

      const text = `您好，尊貴的貴賓${displayName}，歡迎下榻永利皇宮。我是 Joye，很高興為您服務，請問今天有什麼可以幫到您？`;

      await prisma.message.create({
        data: {
          msgId: `h5-welcome-${session.id}-${now.getTime()}`,
          openKfid,
          externalUserId,
          sessionId: session.id,
          origin: "system",
          msgType: "text",
          sendTime: now,
          payload: JSON.stringify({
            type: "text",
            content: text,
          }),
          direction: "out",
          text,
          hasSensitive: false,
          sensitiveHits: null,
        },
      });
    }

    // 6. 返回给前端：sessionId + VIP 基本信息 + 渠道（现在 channel 已经是 webchat / wechat）
    return NextResponse.json({
      ok: true,
      sessionId: session.id,
      vip: {
        id: vip.id,
        vipNumber: vip.vipNumber,
        fullName: vip.fullName,
        preferredName: vip.preferredName,
      },
      channel,
      scanChannel,
    });
  } catch (err) {
    console.error("POST /api/vip/entry error:", err);
    return NextResponse.json(
      { ok: false, error: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}
