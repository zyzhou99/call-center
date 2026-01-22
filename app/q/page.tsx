// app/q/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import Image from "next/image";
import vipLogin from "@/assets/vip-login1.png";

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

  const rawMode = sp.get("mode"); // ✅ 判断URL里是否真的带了 mode
  const mode = (rawMode || "general").toLowerCase();
  const qrCode = sp.get("qrCode") || "";
  const token = sp.get("token") || qrCode; // 兼容老逻辑：没有 token 就用 qrCode 顶上

  const [showHostHint, setShowHostHint] = useState(false);

  // 给小程序用的 scene（你小程序端拿到 scene 后自己 parse）
  const scene = useMemo(() => {
    const p = new URLSearchParams();
    p.set("mode", mode);
    if (qrCode) p.set("qrCode", qrCode);
    if (token) p.set("token", token);
    return p.toString();
  }, [mode, qrCode, token]);

  useEffect(() => {
    // ✅ 10 秒后还没跳转，就提示找 Host
    const t = window.setTimeout(() => setShowHostHint(true), 10000);

    const hasTokenOrQr = Boolean(
      (qrCode && qrCode.trim()) || (token && token.trim())
    );

    // ✅ 规则：
    // - vip：必须有 token/qrCode 才跳
    // - general：只要 URL 明确写了 ?mode=general 就跳（不需要 token）
    // - 裸 /q：rawMode=null 且没 token/qrCode → 不跳
    if (mode === "vip" && !hasTokenOrQr) {
      console.warn("[/q] vip mode but missing qrCode/token, skip redirect.");
      return () => window.clearTimeout(t);
    }
    if (mode !== "vip" && !hasTokenOrQr && rawMode !== "general") {
      console.warn(
        "[/q] missing params and no explicit mode=general, skip redirect."
      );
      return () => window.clearTimeout(t);
    }

    // 1) 微信内 → 跳小程序
    if (isWeChat()) {
      const miniBase = process.env.NEXT_PUBLIC_MINIAPP_URL_LINK || "";
      const miniUrl = buildMiniAppUrl(miniBase, scene);

      if (miniUrl) {
        window.location.replace(miniUrl);
        return () => window.clearTimeout(t);
      }

      console.warn("NEXT_PUBLIC_MINIAPP_URL_LINK is missing.");
      return () => window.clearTimeout(t);
    }

    // 2) 非微信（相机 / 浏览器）→ 走 H5
    if (mode === "vip") {
      // 专属码 → /vip-entry
      const p = new URLSearchParams();
      p.set("mode", "vip");
      if (qrCode) p.set("qrCode", qrCode);
      if (token) p.set("token", token);
      window.location.replace(`/vip-entry?${p.toString()}`);
      return () => window.clearTimeout(t);
    }

    // 通用码 → /vip-request
    {
      const p = new URLSearchParams();
      p.set("mode", "general");
      window.location.replace(`/vip-request?${p.toString()}`);
    }

    return () => window.clearTimeout(t);
  }, [mode, rawMode, qrCode, token, scene]);

  return (
    <div className="min-h-screen flex justify-center bg-[#FFF9F0]">
      <div className="w-full max-w-md flex flex-col bg-[#FFF9F0]">
        {/* 顶部头图 */}
        <div className="relative w-full">
          <div className="relative w-full h-[260px] overflow-hidden">
            <Image
              src={vipLogin}
              alt="VIP"
              fill
              priority
              className="object-cover object-bottom"
            />
          </div>
        </div>

        {/* 中间文字（保持原文案不变） */}
        <div className="flex-1 flex items-center justify-center px-7 pt-8 pb-12">
          <div
            style={{
              textAlign: "center",
              maxWidth: 420,
              fontFamily:
                '-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",Arial',
            }}
          >
            <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>
              正在跳转…
            </div>

            {showHostHint && (
              <div
                style={{
                  marginTop: 10,
                  fontSize: 12,
                  color: "#7b6246",
                  lineHeight: 1.6,
                }}
              >
                未检测到有效的二维码参数。请联系您的接待人员（Host）获取可用的二维码后重新扫码进入。
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
