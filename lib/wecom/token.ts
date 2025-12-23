import { assertWecomEnv, wecomConfig } from "./config";

let cachedToken: { token: string; expiresAt: number } | null = null;

export async function getWecomAccessToken() {
  assertWecomEnv();

  // 提前 60 秒刷新，避免刚好过期
  const now = Date.now();
  if (cachedToken && cachedToken.expiresAt - 60_000 > now) {
    return cachedToken.token;
  }

  const url =
    `https://qyapi.weixin.qq.com/cgi-bin/gettoken` +
    `?corpid=${encodeURIComponent(wecomConfig.corpId)}` +
    `&corpsecret=${encodeURIComponent(wecomConfig.secret)}`;

  const res = await fetch(url, { cache: "no-store" });
  const data = await res.json();

  if (data.errcode !== 0) {
    // 不要打印 secret，只打印错误信息
    throw new Error(`gettoken failed: errcode=${data.errcode}, errmsg=${data.errmsg}`);
  }

  const token = data.access_token as string;
  const expiresIn = (data.expires_in as number) ?? 7200;

  cachedToken = { token, expiresAt: now + expiresIn * 1000 };
  return token;
}
