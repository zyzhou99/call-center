// app/api/mini/bind-phone/route.ts
import { NextResponse } from "next/server";

export const runtime = "nodejs";

type AccessTokenResp = {
  access_token?: string;
  expires_in?: number;
  errcode?: number;
  errmsg?: string;
};

type PhoneResp = {
  errcode?: number;
  errmsg?: string;
  phone_info?: {
    phoneNumber?: string;
    purePhoneNumber?: string;
    countryCode?: string;
    watermark?: { appid?: string; timestamp?: number };
  };
};

const APPID = process.env.WECHAT_MINI_APPID;
const SECRET = process.env.WECHAT_MINI_SECRET;

// 简单的内存缓存（同一台服务器进程内有效）
let cachedToken: { token: string; expiresAt: number } | null = null;

async function getAccessToken(): Promise<string> {
  if (!APPID || !SECRET) {
    throw new Error("Missing env: WECHAT_MINI_APPID / WECHAT_MINI_SECRET");
  }

  const now = Date.now();
  if (cachedToken && cachedToken.expiresAt > now + 30_000) {
    return cachedToken.token;
  }

  const url =
    "https://api.weixin.qq.com/cgi-bin/token" +
    `?grant_type=client_credential&appid=${encodeURIComponent(APPID)}` +
    `&secret=${encodeURIComponent(SECRET)}`;

  const r = await fetch(url, { method: "GET" });
  const data = (await r.json()) as AccessTokenResp;

  if (!r.ok || !data.access_token) {
    throw new Error(
      `getAccessToken failed: ${data.errcode ?? r.status} ${data.errmsg ?? ""}`.trim()
    );
  }

  const expiresIn = (data.expires_in ?? 7200) * 1000;
  cachedToken = {
    token: data.access_token,
    // 提前 60 秒过期，避免边界问题
    expiresAt: Date.now() + expiresIn - 60_000,
  };

  return cachedToken.token;
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const code = typeof body?.code === "string" ? body.code : "";

    if (!code) {
      return NextResponse.json({ ok: false, error: "Missing code" }, { status: 400 });
    }

    const accessToken = await getAccessToken();

    const api = `https://api.weixin.qq.com/wxa/business/getuserphonenumber?access_token=${encodeURIComponent(
      accessToken
    )}`;

    const r = await fetch(api, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ code }),
    });

    const data = (await r.json()) as PhoneResp;

    if (!r.ok || data.errcode) {
      return NextResponse.json(
        {
          ok: false,
          error: `getuserphonenumber failed: ${data.errcode ?? r.status} ${data.errmsg ?? ""}`.trim(),
        },
        { status: 400 }
      );
    }

    const phone = data.phone_info?.purePhoneNumber || data.phone_info?.phoneNumber;
    const countryCode = data.phone_info?.countryCode;

    if (!phone) {
      return NextResponse.json({ ok: false, error: "No phone in response" }, { status: 400 });
    }

    // TODO（下一步我们再做）：把手机号写入数据库 / 绑定到某个 sessionId 或 scanResult
    return NextResponse.json({
      ok: true,
      phone,
      countryCode,
    });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message || "Server error" },
      { status: 500 }
    );
  }
}
