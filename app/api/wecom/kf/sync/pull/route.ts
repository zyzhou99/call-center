export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getWecomAccessToken } from "@/lib/wecom/token";
import { extractPreview } from "@/lib/wecom/preview";

function checkAdmin(req: Request) {
  const need = process.env.ADMIN_SYNC_TOKEN;
  if (!need) return true; // 没配就不拦（POC阶段）
  const got = req.headers.get("x-admin-token");
  return got === need;
}

export async function GET(req: Request) {
  try {
    if (!checkAdmin(req)) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const open_kfid = searchParams.get("open_kfid") || "";
    const limit = Number(searchParams.get("limit") || "50");

    // 兼容首次初始化：如果 DB 里还没有 token，你可以用 query 传一次 token
    const initToken = searchParams.get("token") || "";

    if (!open_kfid) {
      return NextResponse.json({ ok: false, error: "Missing open_kfid" }, { status: 400 });
    }

    // 1) 从 DB 读取同步状态
    const state = await prisma.kfSyncState.findUnique({
      where: { openKfid: open_kfid },
    });

    const cursor = state?.cursor ?? "";
    const token = state?.token ?? initToken;

    if (!token) {
      return NextResponse.json(
        { ok: false, error: "Missing sync token (db empty and no init token provided)" },
        { status: 400 }
      );
    }

    // 2) 调企业微信 sync_msg
    const accessToken = await getWecomAccessToken();

    const resp = await fetch(
      `https://qyapi.weixin.qq.com/cgi-bin/kf/sync_msg?access_token=${encodeURIComponent(accessToken)}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cursor,
          token,
          limit,
          open_kfid,
        }),
      }
    );

    const data = await resp.json();

    if (!resp.ok || data?.errcode) {
      return NextResponse.json(
        { ok: false, error: "wecom sync_msg failed", wecom: data },
        { status: 502 }
      );
    }

    const nextCursor = data?.next_cursor ?? cursor;
    const nextToken = data?.token ?? token;
    const msgList: any[] = data?.msg_list ?? [];
    const hasMore = Boolean(data?.has_more);

    let inserted = 0;
    let duplicated = 0;

    // 3) 事务：消息落库 + 游标更新一起做
    await prisma.$transaction(async (tx) => {
      // 3.1 更新游标/token
      await tx.kfSyncState.upsert({
        where: { openKfid: open_kfid },
        update: { cursor: nextCursor, token: nextToken },
        create: { openKfid: open_kfid, cursor: nextCursor, token: nextToken },
      });

      // 3.2 保存消息（msgId 唯一约束去重）
      for (const m of msgList) {
        const msgId = String(m?.msgid || "");
        const externalUserId = String(m?.external_userid || "");
        const msgType = String(m?.msgtype || "unknown");
        const origin = m?.origin ? String(m.origin) : null;
        const sendTime = new Date((Number(m?.send_time || 0) || 0) * 1000);

        if (!msgId || !externalUserId) continue;

        // session：按 (openKfid, externalUserId) 聚合
        const session = await tx.session.upsert({
          where: {
            openKfid_externalUserId: { openKfid: open_kfid, externalUserId },
          },
          update: {
            lastMsgAt: sendTime,
            lastMsgPreview: extractPreview(m),
          },
          create: {
            openKfid: open_kfid,
            externalUserId,
            lastMsgAt: sendTime,
            lastMsgPreview: extractPreview(m),
          },
        });

        try {
          await tx.message.create({
            data: {
              msgId,
              openKfid: open_kfid,
              externalUserId,
              origin,
              msgType,
              sendTime,
              payload: m,
              sessionId: session.id,
            },
          });
          inserted += 1;
        } catch (e: any) {
          // Prisma unique constraint violation
          if (e?.code === "P2002") duplicated += 1;
          else throw e;
        }
      }
    });

    return NextResponse.json({
      ok: true,
      open_kfid,
      cursor_before: cursor,
      cursor_after: nextCursor,
      has_more: hasMore,
      pulled: msgList.length,
      inserted,
      duplicated,
    });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message ?? String(e) },
      { status: 500 }
    );
  }
}
