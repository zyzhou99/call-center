"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import vipLogin from "@/assets/vip-login1.png";

interface VerifyResponse {
  ok: boolean;
  error?: string;
  vipGuest?: {
    vipNumber: string;
    preferredName: string | null;
    fullName: string | null;
    room: string | null;
    vipTier: string | null;
    notes: string | null;
  };
  kfUrl?: string | null;
  sessionId?: string | null;
}

// 10 分钟复用窗口
const REUSE_WINDOW_MS = 10 * 60 * 1000;

// 把跳转逻辑挪到组件外，方便 useEffect 里也能复用
function redirectToChat(data: VerifyResponse) {
  if (data.kfUrl) {
    window.location.href = data.kfUrl;
    return;
  }

  if (data.sessionId) {
    window.location.href = `/inbox?sessionId=${encodeURIComponent(
      data.sessionId
    )}`;
    return;
  }

  // 兜底
  window.location.href = "/inbox";
}

export default function VipAccessPage() {
  const [vipNumber, setVipNumber] = useState("");
  const [preferredName, setPreferredName] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<VerifyResponse | null>(null);

  // ✅ 页面加载时，检查 10 分钟内是否有成功记录，有的话直接跳转
  useEffect(() => {
    if (typeof window === "undefined") return;

    try {
      const raw = window.localStorage.getItem("vip_access_last_success");
      if (!raw) return;

      const saved = JSON.parse(raw) as {
        data: VerifyResponse;
        vipNumber: string;
        preferredName: string | null;
        ts: number;
      };

      if (!saved?.data?.ok || !saved.ts) return;

      const now = Date.now();
      if (now - saved.ts > REUSE_WINDOW_MS) {
        // 超过 10 分钟，清掉记录
        window.localStorage.removeItem("vip_access_last_success");
        return;
      }

      // 10 分钟内：直接用上次的结果跳转到对话
      redirectToChat(saved.data);
    } catch (e) {
      console.error("Failed to auto-redirect from saved VIP access", e);
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setResult(null);

    try {
      const cleanedVip = vipNumber.trim();
      const cleanedPreferred = preferredName.trim() || null;

      const res = await fetch("/api/vip/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          vipNumber: cleanedVip,
          preferredName: cleanedPreferred,
        }),
      });

      const data: VerifyResponse = await res.json();

      if (!data.ok) {
        // 验证失败：只显示错误，不跳转，也不写入本地记录
        setResult(data);
        setLoading(false);
        return;
      }

      // ✅ 验证成功：先把这次成功记录下来（含时间戳）
      if (typeof window !== "undefined") {
        try {
          window.localStorage.setItem(
            "vip_access_last_success",
            JSON.stringify({
              data,
              vipNumber: cleanedVip,
              preferredName: cleanedPreferred,
              ts: Date.now(),
            })
          );
        } catch (e) {
          console.error("Failed to save vip_access_last_success", e);
        }
      }

      // 再关 loading + 跳转客服
      setLoading(false);
      redirectToChat(data);
    } catch (err) {
      console.error(err);
      setResult({
        ok: false,
        error: "SERVER_ERROR",
      });
      setLoading(false);
    }
  };

  const showError = result && !result.ok;

  return (
    <div className="min-h-screen bg-[#fbf3e7] flex justify-center">
      {/* 限制宽度，模拟手机屏幕 */}
      <div className="w-full max-w-md flex flex-col bg-[#fbf3e7]">
        {/* 顶部头图 */}
        <div className="relative w-full">
          <div className="relative w-full h-[300px] overflow-hidden">
            <Image
              src={vipLogin}
              alt="VIP guest access"
              fill
              priority
              className="object-cover object-bottom"
            />
          </div>
        </div>

        {/* 表单区域 */}
        <div className="flex-1 px-7 pt-12 pb-12">
          <form className="space-y-7" onSubmit={handleSubmit}>
            {/* VIP CARD NUMBER */}
            <div className="space-y-2">
              <label className="block text-[12px] font-semibold tracking-[0.18em] text-[#c79b4a] uppercase">
                VIP CARD NUMBER
              </label>
              <input
                value={vipNumber}
                onChange={(e) => setVipNumber(e.target.value)}
                placeholder="10001"
                className="w-full px-5 py-3.5 rounded-[8px] border border-[#d3a65b] bg-[#fffaf2] text-[16px] text-[#32261c] shadow-sm focus:outline-none focus:ring-2 focus:ring-[#d3a65b] focus:border-transparent"
                required
              />
            </div>

            {/* PREFERRED NAME */}
            <div className="space-y-2">
              <label className="block text-[12px] font-semibold tracking-[0.18em] text-[#c79b4a] uppercase">
                PREFERRED NAME
              </label>
              <input
                value={preferredName}
                onChange={(e) => setPreferredName(e.target.value)}
                placeholder="Alex"
                className="w-full px-5 py-3.5 rounded-[8px] border border-[#d3a65b] bg-[#fffaf2] text-[16px] text-[#32261c] shadow-sm focus:outline-none focus:ring-2 focus:ring-[#d3a65b] focus:border-transparent"
              />
            </div>

            {/* Connect 按钮 */}
            <button
              type="submit"
              disabled={loading || !vipNumber.trim()}
              className="mt-4 w-full py-3.5 rounded-[8px] text-[16px] font-semibold tracking-[0.18em] uppercase disabled:opacity-50 disabled:cursor-not-allowed"
              style={{
                background:
                  "linear-gradient(91deg, #F3DBAB 3.63%, #D6BB87 100%)",
                color: "#3a3023",
              }}
            >
              {loading ? "VERIFYING..." : "Connect"}
            </button>

            {/* 错误提示（只在 VIP 号错 / 服务器错的时候显示） */}
            {showError && (
              <div className="mt-4 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-[11px] text-red-700">
                {result?.error === "NOT_FOUND" && (
                  <span>
                    We could not find this VIP card number. Please check and try
                    again.
                  </span>
                )}
                {result?.error === "MISSING_VIP" && (
                  <span>Please enter your VIP card number.</span>
                )}
                {result?.error === "SERVER_ERROR" && (
                  <span>
                    Service is temporarily unavailable. Please try again later.
                  </span>
                )}
                {!["NOT_FOUND", "MISSING_VIP", "SERVER_ERROR"].includes(
                  result?.error || ""
                ) && <span>Verification failed. Please try again.</span>}
              </div>
            )}
          </form>
        </div>
      </div>
    </div>
  );
}
