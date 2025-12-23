// app/api/wecom/kf/accounts/route.ts
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { getWecomAccessToken } from "@/lib/wecom/token";

export async function GET() {
  try {
    const accessToken = await getWecomAccessToken();
    const url = `https://qyapi.weixin.qq.com/cgi-bin/kf/account/list?access_token=${encodeURIComponent(accessToken)}`;

    const resp = await fetch(url, { method: "GET" });
    const data = await resp.json();

    return NextResponse.json({ ok: true, data });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message || String(e) },
      { status: 500 }
    );
  }
}
