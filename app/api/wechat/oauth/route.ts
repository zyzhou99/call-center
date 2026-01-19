// app/api/wechat/oauth/route.ts
export const runtime = "nodejs";

import { NextResponse } from "next/server";

/**
 * 微信 H5 網頁授權回調：
 * 前端會調用：GET /api/wechat/oauth?code=XXX
 *
 * 這裡會用 code 換取：
 *  - access_token + openid
 *  - 再用 access_token + openid 換取用戶資料（nickname、headimgurl）
 *
 * 返回格式：
 *  { ok: true, openid, nickname, avatarUrl }
 * 或
 *  { ok: false, error: "SOME_ERROR" }
 */
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const code = searchParams.get("code");

    if (!code) {
      return NextResponse.json(
        { ok: false, error: "MISSING_CODE" },
        { status: 400 }
      );
    }

    // 後端使用的 AppId / Secret
    // 建議在 .env 裡配置：
    // WECHAT_APPID=xxx
    // WECHAT_APP_SECRET=yyy
    // 前端用的是 NEXT_PUBLIC_WECHAT_APPID（可以和 WECHAT_APPID 同一個值）
    const appid =
      process.env.WECHAT_APPID || process.env.NEXT_PUBLIC_WECHAT_APPID;
    const secret = process.env.WECHAT_APP_SECRET;

    if (!appid || !secret) {
      console.error("Missing WECHAT_APPID or WECHAT_APP_SECRET env vars");
      return NextResponse.json(
        { ok: false, error: "MISSING_WECHAT_CONFIG" },
        { status: 500 }
      );
    }

    // 1) 用 code 換取 access_token + openid
    const tokenUrl =
      "https://api.weixin.qq.com/sns/oauth2/access_token" +
      `?appid=${encodeURIComponent(appid)}` +
      `&secret=${encodeURIComponent(secret)}` +
      `&code=${encodeURIComponent(code)}` +
      `&grant_type=authorization_code`;

    const tokenRes = await fetch(tokenUrl, { cache: "no-store" });
    const tokenJson = await tokenRes.json();

    // WeChat 錯誤格式一般帶 errcode / errmsg
    if (!tokenRes.ok || tokenJson.errcode) {
      console.error("WeChat access_token error:", tokenJson);
      return NextResponse.json(
        {
          ok: false,
          error: "WECHAT_TOKEN_ERROR",
          detail: tokenJson,
        },
        { status: 500 }
      );
    }

    const accessToken = tokenJson.access_token as string | undefined;
    const openid = tokenJson.openid as string | undefined;

    if (!accessToken || !openid) {
      console.error("WeChat token response missing access_token/openid:", tokenJson);
      return NextResponse.json(
        {
          ok: false,
          error: "WECHAT_TOKEN_MISSING_FIELDS",
        },
        { status: 500 }
      );
    }

    // 2) 用 access_token + openid 拉取用戶信息
    const userInfoUrl =
      "https://api.weixin.qq.com/sns/userinfo" +
      `?access_token=${encodeURIComponent(accessToken)}` +
      `&openid=${encodeURIComponent(openid)}` +
      `&lang=zh_CN`;

    const userRes = await fetch(userInfoUrl, { cache: "no-store" });
    const userJson = await userRes.json();

    if (!userRes.ok || userJson.errcode) {
      console.error("WeChat userinfo error:", userJson);
      // 即使 userinfo 掛了，至少還是可以返回 openid
      return NextResponse.json(
        {
          ok: true,
          openid,
          nickname: null,
          avatarUrl: null,
          warning: "USERINFO_ERROR",
          detail: userJson,
        },
        { status: 200 }
      );
    }

    const nickname = (userJson.nickname as string | undefined) ?? null;
    const avatarUrl = (userJson.headimgurl as string | undefined) ?? null;

    return NextResponse.json(
      {
        ok: true,
        openid,
        nickname,
        avatarUrl,
      },
      { status: 200 }
    );
  } catch (err) {
    console.error("Error in /api/wechat/oauth:", err);
    return NextResponse.json(
      { ok: false, error: "SERVER_ERROR" },
      { status: 500 }
    );
  }
}
