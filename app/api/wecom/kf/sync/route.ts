export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { getWecomAccessToken } from "@/lib/wecom/token";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);

    const token = searchParams.get("token") || "";
    const cursor = searchParams.get("cursor") || "";
    const open_kfid = searchParams.get("open_kfid") || "";
    const limit = Number(searchParams.get("limit") || "50");

    if (!token || !open_kfid) {
      return NextResponse.json(
        { ok: false, error: "Missing token or open_kfid" },
        { status: 400 }
      );
    }

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
          open_kfid, // ✅ 关键：必须带
        }),
      }
    );

    const data = await resp.json();
    return NextResponse.json({ ok: true, data });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message ?? String(e) },
      { status: 500 }
    );
  }
}
