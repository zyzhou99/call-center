export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { getWecomAccessToken } from "@/lib/wecom/token";

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const open_kfid = body.open_kfid as string;
    const touser = body.touser as string; // ✅ 改成 touser
    const content = body.content as string;

    if (!open_kfid || !touser || !content) {
      return NextResponse.json(
        { ok: false, error: "Missing open_kfid / touser / content" },
        { status: 400 }
      );
    }

    const accessToken = await getWecomAccessToken();

    const payload = {
      open_kfid,
      touser, // ✅ 企业微信要求这个字段
      msgtype: "text",
      text: { content },
    };

    const resp = await fetch(
      `https://qyapi.weixin.qq.com/cgi-bin/kf/send_msg?access_token=${encodeURIComponent(
        accessToken
      )}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
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
