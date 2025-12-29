"use client";

import { useState } from "react";

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

export default function VipAccessPage() {
  const [vipNumber, setVipNumber] = useState("");
  const [preferredName, setPreferredName] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<VerifyResponse | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setResult(null);

    try {
      const res = await fetch("/api/vip/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          vipNumber: vipNumber.trim(),
          preferredName: preferredName.trim() || null,
        }),
      });

      const data: VerifyResponse = await res.json();
      setResult(data);
    } catch (err) {
      console.error(err);
      setResult({
        ok: false,
        error: "SERVER_ERROR",
      });
    } finally {
      setLoading(false);
    }
  };

  const showSuccess = result?.ok;
  const showError = result && !result.ok;

  const successName =
    result?.vipGuest?.preferredName ||
    result?.vipGuest?.fullName ||
    preferredName ||
    "";

  const handleGoToChat = () => {
    if (result?.kfUrl) {
      window.location.href = result.kfUrl;
    } else if (result?.sessionId) {
      // 本地：带着 sessionId 跳转到 inbox
      window.location.href = `/inbox?sessionId=${encodeURIComponent(
        result.sessionId
      )}`;
    } else {
      // fallback：没有 sessionId 就普通跳
      window.location.href = "/inbox";
    }
  };

  return (
    <div className="min-h-screen bg-[#f7f3ea] flex justify-center">
      {/* 限制宽度，模拟手机屏幕 */}
      <div className="w-full max-w-md flex flex-col bg-[#f7f3ea]">
        {/* 顶部金色背景 + Logo 区 */}
        <div className="h-56 bg-gradient-to-b from-[#d3b272] to-[#f4e0b8] rounded-b-[32px] flex flex-col items-center justify-end pb-6">
          {/* 这里可以换成你自己的 logo 图片 */}
          <div className="text-center text-[#8b6a33]">
            <div className="text-[11px] tracking-[0.35em] uppercase mb-1">
              WYNN PALACE
            </div>
            <div className="text-[10px] tracking-[0.3em]">
              永利皇宫 · COTAI
            </div>
          </div>
        </div>

        {/* 下半部分白色内容区域 */}
        <div className="-mt-6 px-6 pb-10 flex-1">
          <div className="bg-[#fdfaf5] rounded-3xl shadow-sm px-6 pt-8 pb-6 space-y-6">
            {/* 标题区域 */}
            <div>
              <h1 className="text-[20px] font-semibold tracking-[0.14em] uppercase">
                <span className="text-[#c79b4a] mr-1">VIP</span>
                <span className="text-[#3b2d22]">GUEST ACCESS</span>
              </h1>
              <p className="text-[12px] text-[#9b8d7c] mt-2">
                Connect to our customer service system
              </p>
            </div>

            {/* 表单 */}
            <form className="space-y-5" onSubmit={handleSubmit}>
              <div className="space-y-1.5">
                <label className="block text-[11px] font-semibold tracking-[0.16em] text-[#c79b4a] uppercase">
                  VIP CARD NUMBER
                </label>
                <input
                  value={vipNumber}
                  onChange={(e) => setVipNumber(e.target.value)}
                  placeholder="e.g. VIP-D-10234"
                  className="w-full px-3.5 py-3 rounded-xl border border-[#e1d4bf] bg-white/90 text-[14px] focus:outline-none focus:ring-2 focus:ring-[#c79b4a] focus:border-transparent"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <label className="block text-[11px] font-semibold tracking-[0.16em] text-[#c79b4a] uppercase">
                  PREFERRED NAME
                </label>
                <input
                  value={preferredName}
                  onChange={(e) => setPreferredName(e.target.value)}
                  placeholder="e.g. Dou dou"
                  className="w-full px-3.5 py-3 rounded-xl border border-[#e1d4bf] bg-white/90 text-[14px] focus:outline-none focus:ring-2 focus:ring-[#c79b4a] focus:border-transparent"
                />
              </div>

              <button
                type="submit"
                disabled={loading || !vipNumber.trim()}
                className="mt-2 w-full py-3 rounded-2xl text-[14px] font-semibold tracking-[0.12em] uppercase disabled:opacity-50 disabled:cursor-not-allowed"
                style={{
                  backgroundImage:
                    "linear-gradient(90deg, #d3b272 0%, #f1d493 100%)",
                  color: "#3b2d22",
                }}
              >
                {loading ? "VERIFYING..." : "LOGIN"}
              </button>
            </form>

            {/* 提示信息区域 */}
            <div className="space-y-3 pt-1">
              {showError && (
                <div className="rounded-xl border border-red-100 bg-red-50 px-3 py-2 text-[11px] text-red-700">
                  {result?.error === "NOT_FOUND" && (
                    <span>
                      We could not find this VIP card number. Please check and
                      try again.
                    </span>
                  )}
                  {result?.error === "MISSING_VIP" && (
                    <span>Please enter your VIP card number.</span>
                  )}
                  {result?.error === "SERVER_ERROR" && (
                    <span>
                      Service is temporarily unavailable. Please try again
                      later.
                    </span>
                  )}
                  {!["NOT_FOUND", "MISSING_VIP", "SERVER_ERROR"].includes(
                    result?.error || ""
                  ) && <span>Verification failed. Please try again.</span>}
                </div>
              )}

              {showSuccess && (
                <div className="space-y-3">
                  <div className="rounded-xl border border-emerald-100 bg-emerald-50 px-3 py-2 text-[11px] text-emerald-800">
                    <div className="font-semibold mb-1">
                      Welcome{" "}
                      {successName ? (
                        <span>{successName}</span>
                      ) : (
                        "dear VIP guest"
                      )}
                      .
                    </div>
                    {result?.vipGuest?.room && (
                      <div>Room: {result.vipGuest.room}</div>
                    )}
                    {result?.vipGuest?.vipTier && (
                      <div>Tier: {result.vipGuest.vipTier}</div>
                    )}
                  </div>

                  <button
                    onClick={handleGoToChat}
                    className="w-full py-2.5 rounded-2xl text-[13px] font-semibold tracking-[0.12em] uppercase text-white"
                    style={{ backgroundColor: "#34302a" }}
                  >
                    GO TO CUSTOMER SERVICE
                  </button>

                  {!result?.kfUrl && (
                    <p className="text-[10px] text-[#a89a88] text-center">
                      In development environment this will redirect to{" "}
                      <code>/inbox</code>. On production it will open the WeChat
                      customer service chat.
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
