// app/q/page.tsx
"use client";

import { useEffect, useMemo } from "react";
import { useSearchParams } from "next/navigation";

function isWeChat() {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent.toLowerCase();
  return ua.includes("micromessenger");
}

/**
 * 你需要在 .env / .env.production 里配置这个：
 * NEXT_PUBLIC_MINIAPP_URL_LINK=
 *
 * 它可以是：
 * 1) 一个完整的「打开小程序」URL Link（微信后台生成的那种 https://...）
 * 2) 或者你自己准备好的跳转地址
 *
 * 我们会把 scene 参数拼进去：scene=<编码后的 mode/qrCode/token>
 */
function buildMiniAppUrl(base: string, scene: string) {
  if (!base) return "";

  // 支持你用 {SCENE} 占位符的写法（最稳）
  if (base.includes("{SCENE}")) {
    return base.replace("{SCENE}", encodeURIComponent(scene));
  }

  // 否则就用 ?scene= 或 &scene=
  const joiner = base.includes("?") ? "&" : "?";
  return `${base}${joiner}scene=${encodeURIComponent(scene)}`;
}

export default function QEntryPage() {
  const sp = useSearchParams();

  const mode = (sp.get("mode") || "general").toLowerCase(); // vip / general
  const qrCode = sp.get("qrCode") || "";
  const token = sp.get("token") || qrCode; // 兼容老逻辑：没有 token 就用 qrCode 顶上

  // 给小程序用的 scene（你小程序端拿到 scene 后自己 parse）
  const scene = useMemo(() => {
    const p = new URLSearchParams();
    p.set("mode", mode);
    if (qrCode) p.set("qrCode", qrCode);
    if (token) p.set("token", token);
    return p.toString();
  }, [mode, qrCode, token]);

  useEffect(() => {
    // 1) 微信内 → 跳小程序
    if (isWeChat()) {
      const miniBase = process.env.NEXT_PUBLIC_MINIAPP_URL_LINK || "";
      const miniUrl = buildMiniAppUrl(miniBase, scene);

      if (miniUrl) {
        window.location.replace(miniUrl);
        return;
      }

      // 如果你还没配 NEXT_PUBLIC_MINIAPP_URL_LINK，就先别 404，给个兜底
      // （你一配好 env，再刷新就会跳小程序）
      console.warn("NEXT_PUBLIC_MINIAPP_URL_LINK is missing.");
      return;
    }

    // 2) 非微信（相机 / 浏览器）→ 走 H5
    if (mode === "vip") {
      // 专属码 → /vip-entry
      const p = new URLSearchParams();
      p.set("mode", "vip");
      if (qrCode) p.set("qrCode", qrCode);
      if (token) p.set("token", token);
      window.location.replace(`/vip-entry?${p.toString()}`);
      return;
    }

    // 通用码 → /vip-request
    {
      const p = new URLSearchParams();
      p.set("mode", "general");
      // 通用码如果你还需要透传别的参数，也可以加在这里
      window.location.replace(`/vip-request?${p.toString()}`);
    }
  }, [mode, qrCode, token, scene]);

  // 页面上展示一个“正在跳转”，避免白屏
  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontFamily:
          '-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",Arial',
        padding: 24,
      }}
    >
      <div style={{ textAlign: "center", maxWidth: 420 }}>
        <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>
          正在跳转…
        </div>
        <div style={{ fontSize: 12, opacity: 0.7, lineHeight: 1.5 }}>
          如果你是在微信里打开但没有跳转到小程序，请检查是否已配置：
          <br />
          <code>NEXT_PUBLIC_MINIAPP_URL_LINK</code>
        </div>
      </div>
    </div>
  );
}
