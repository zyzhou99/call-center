export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { getWecomAccessToken } from "@/lib/wecom/token";

function isAdmin(req: Request) {
  const need = process.env.ADMIN_SYNC_TOKEN;
  if (!need) return false;
  const got = req.headers.get("x-admin-token");
  return got === need;
}

export async function GET(req: Request) {
  try {
    const accessToken = await getWecomAccessToken();

    // 只有你自己带口令，才给全量
    if (isAdmin(req)) {
      return NextResponse.json({ ok: true, accessToken });
    }

    // 默认只给预览（脱敏）
    return NextResponse.json({
      ok: true,
      tokenPreview: `${accessToken.slice(0, 8)}...`,
    });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message ?? String(e) },
      { status: 500 }
    );
  }
}
