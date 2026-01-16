// ⚠️ LEGACY FLOW: VIP 自助驗證入口（輸入 VIP 卡號 + 生日）
// 現在需求已改為「每位 VIP 對應一個永久專屬二維碼」，
// 未來會用新的 /vip-entry H5 頁面取代這個表單。
// 目前暫時保留，以免影響已有測試鏈路，但新功能不要再往這裡加。

"use client";

import { useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Image from "next/image";
import vipLogin from "@/assets/vip-login1.png";

type PendingStatus =
  | "INIT"
  | "PENDING"
  | "APPROVED"
  | "REJECTED"
  | "EXPIRED"
  | "MISSING"
  | "ERROR";

interface ApprovalResponse {
  ok: boolean;
  approval?: {
    id: string;
    status: string;
    reason?: string | null;
    kfUrl?: string | null;
    sessionId?: string | null;
    vipNumber: string;
    vipGuest?: {
      fullName: string;
      preferredName?: string | null;
      tier?: string | null;
    } | null;
  };
  error?: string;
}

const POLL_INTERVAL_MS = 3000;

export default function VipPendingPage() {
  const searchParams = useSearchParams();
  const router = useRouter();

  // 🔑 一定要用 "pendingId"，跟 /vip-access 里保持一致
  const pendingId = searchParams.get("pendingId");
  const redirectKey = pendingId
    ? `vip_pending_redirect_${pendingId}`
    : null;

  const [status, setStatus] = useState<PendingStatus>("INIT");
  const [message, setMessage] = useState<string>("");
  const [reason, setReason] = useState<string | null>(null);
  // ⭐ 新增：保存最新的 approval，方便手動跳轉時使用
  const [approval, setApproval] = useState<
    ApprovalResponse["approval"] | null
  >(null);

  // 回到 /vip-access 前，順手清掉 localStorage
  function clearPendingLocalState() {
    if (typeof window !== "undefined") {
      window.localStorage.removeItem("vip_access_last_pending");
    }
  }

  function handleBackToAccess() {
    clearPendingLocalState();
    router.push("/vip-access");
  }

  // ⭐ 新增：手動進入對話的兜底按鈕
  function handleEnterChat() {
    if (!approval) return;

    // CASE 1：WeCom / hybrid，後端給了企業微信客服鏈接
    if (approval.kfUrl) {
      if (typeof window !== "undefined") {
        window.location.href = approval.kfUrl;
      }
      return;
    }

    // CASE 2：H5 webchat，後端給了 sessionId
    if (approval.sessionId) {
      if (typeof window !== "undefined") {
        window.location.href = `/vip-chat?sessionId=${encodeURIComponent(
          approval.sessionId
        )}`;
      }
      return;
    }

    // 都沒有的極端情況：兜底回到 vip-access
    handleBackToAccess();
  }

  useEffect(() => {
    // 1) URL 裡壓根沒有 pendingId：直接當錯誤處理
    if (!pendingId) {
      setStatus("MISSING");
      setMessage(
        "Missing request id. Please go back and submit your information again."
      );
      clearPendingLocalState();
      return;
    }

    // 看這個 pendingId 是否已經做過一次自動跳轉
    const alreadyRedirected =
      typeof window !== "undefined" &&
      redirectKey &&
      window.sessionStorage.getItem(redirectKey) === "1";

    let stopped = false;
    let timer: ReturnType<typeof setInterval> | null = null;

    async function checkOnce() {
      if (stopped) return;

      try {
        const res = await fetch(
          `/api/vip/approvals/${encodeURIComponent(pendingId!)}`
        );
        const data: ApprovalResponse = await res.json();

        if (stopped) return;

        if (!data.ok || !data.approval) {
          setStatus("ERROR");
          setMessage(
            "We could not find this request. It may have expired. Please submit your information again."
          );
          clearPendingLocalState();
          return;
        }

        const approvalFromApi = data.approval;
        // ⭐ 每次成功拿到 approval，都更新到 state 裡，給手動按鈕用
        setApproval(approvalFromApi);

        const s = approvalFromApi.status;

        if (s === "PENDING") {
          setStatus("PENDING");
          setMessage(
            "Our concierge is reviewing your information. This usually takes just a moment."
          );
          setReason(null);
          return;
        }

        if (s === "APPROVED") {
          clearPendingLocalState();
          setStatus("APPROVED");

          // 如果之前已經為這個 pendingId 自動打開過企業微信了，就不再自動跳轉
          if (alreadyRedirected) {
            setMessage(
              "Your identity has been verified. You may now continue in the concierge chat."
            );
            setReason(null);
            // 不再跳轉，直接停掉輪詢
            stopped = true;
            if (timer) clearInterval(timer);
            return;
          }

          setMessage("Your identity has been verified. Connecting you now...");
          setReason(null);

          // ✅ CASE 1：企業微信客服鏈路（WeCom hybrid）
          if (approvalFromApi.kfUrl) {
            stopped = true;
            if (timer) clearInterval(timer);

            // 做個“已跳轉過”的標記，防止之後再次打開 /vip-pending 一直重定向
            if (
              redirectKey &&
              typeof window !== "undefined"
            ) {
              window.sessionStorage.setItem(redirectKey, "1");
            }

            window.location.href = approvalFromApi.kfUrl;
            return;
          }

          // ✅ CASE 2：H5 webchat 鏈路（/vip-chat）
          if (approvalFromApi.sessionId) {
            stopped = true;
            if (timer) clearInterval(timer);

            if (
              redirectKey &&
              typeof window !== "undefined"
            ) {
              window.sessionStorage.setItem(redirectKey, "1");
            }

            window.location.href = `/vip-chat?sessionId=${encodeURIComponent(
              approvalFromApi.sessionId
            )}`;
            return;
          }

          // APPROVED 但後端沒給 kfUrl / sessionId，當成錯誤處理
          setStatus("ERROR");
          setMessage(
            "Your request was approved, but we could not connect you automatically. Please submit again."
          );
          return;
        }

        if (s === "REJECTED") {
          clearPendingLocalState();
          setStatus("REJECTED");
          setMessage(
            "We are unable to complete your request via this channel."
          );
          setReason(approvalFromApi.reason || null);
          return;
        }

        if (s === "EXPIRED") {
          clearPendingLocalState();
          setStatus("EXPIRED");
          setMessage(
            "This request has expired. Please submit your information again."
          );
          setReason(null);
          return;
        }

        // 兜底：出現未知狀態
        setStatus("ERROR");
        setMessage("Unexpected status. Please try again.");
        clearPendingLocalState();
      } catch (e) {
        if (stopped) return;
        console.error("Error fetching approval:", e);
        setStatus("ERROR");
        setMessage("Network error. Please try again.");
      }
    }

    // 先查一次
    checkOnce();
    // 然後每 3 秒輪詢一次狀態
    timer = setInterval(checkOnce, POLL_INTERVAL_MS);

    return () => {
      stopped = true;
      if (timer) clearInterval(timer);
    };
  }, [pendingId, redirectKey]);

  const isErrorLike =
    status === "MISSING" ||
    status === "ERROR" ||
    status === "REJECTED" ||
    status === "EXPIRED";

  const canManualEnterChat =
    status === "APPROVED" &&
    !!approval &&
    (!!approval.kfUrl || !!approval.sessionId);

  // 👇 下面這幾個都是純 UI 文案，不影響任何邏輯
  const isPendingLike = status === "PENDING" || status === "INIT";

  const statusMainLabel =
    status === "APPROVED"
      ? "Verified"
      : status === "REJECTED"
      ? "Unable to Verify"
      : status === "EXPIRED"
      ? "Request Expired"
      : isErrorLike
      ? "Request Error"
      : "Verifying Identity";

  const statusSubLabel =
    status === "APPROVED"
      ? "身份已验证，请在礼宾对话中继续。"
      : status === "REJECTED"
      ? "当前无法通过此渠道完成您的请求。"
      : status === "EXPIRED"
      ? "此验证链接已失效，请返回重新提交信息。"
      : isErrorLike
      ? "请求出现异常，请稍后重试或重新提交信息。"
      : "正在核验尊贵会员身份";

  const maskedVipNumber =
    approval?.vipNumber && approval.vipNumber.trim() !== ""
      ? approval.vipNumber
      : "********";

  return (
    <div className="min-h-screen bg-[#fbf3e7] flex justify-center">
      <div className="w-full max-w-md flex flex-col bg-[#fbf3e7]">
        {/* 頂部頭圖：先重用 vip-access 的圖 */}
        <div className="relative w-full">
          <div className="relative w-full h-[260px] overflow-hidden">
            <Image
              src={vipLogin}
              alt="VIP verification"
              fill
              priority
              className="object-cover object-bottom"
            />
          </div>
        </div>

        {/* 內容區 */}
        <div className="flex-1 px-7 pt-8 pb-12 flex flex-col">
          <h1 className="text-[20px] font-semibold text-[#3a3023] mb-2">
            Wynn Palace · VIP Concierge
          </h1>

          {/* 上方說明文案：只改文字，不動任何邏輯 */}
          <p className="text-[12px] text-[#6e5842] mb-6 leading-relaxed">
            {status === "PENDING"
              ? "Please stay on this page while we verify your membership details."
              : "Please wait a moment while we process your request."}
          </p>

          {/* 中間狀態卡片區：新的 VIP 卡 + 掃描光效 + 狀態文字 */}
          <div className="flex-1 flex flex-col items-center justify-center">
            <div className="verification-container flex flex-col items-center">
              {/* VIP 卡片 */}
              <div
                className="vip-card-animate relative w-[240px] h-[152px] rounded-xl px-[18px] pt-[18px] pb-[18px] overflow-hidden shadow-[0_15px_30px_rgba(168,142,100,0.25),0_5px_10px_rgba(0,0,0,0.05)]"
                style={{
                  background:
                    "linear-gradient(135deg, #F9EBBE 0%, #E7D3AC 50%, #D6BB9A 100%)",
                }}
              >
                {/* 掃描光 */}
                <div className="vip-scan-line" />

                {/* 卡片頂部：芯片 + Logo */}
                <div className="flex items-center justify-between mb-4 relative z-[2]">
                  {/* 金色芯片 */}
                  <div className="relative w-8 h-[22px] rounded-[4px] border border-[rgba(184,134,11,0.3)] bg-gradient-to-br from-[#d4af37] via-[#feeaa3] to-[#b8860b] shadow-inner">
                    <div className="chip-lines">
                      <div className="chip-rect" />
                    </div>
                  </div>

                  <div className="text-[10px] tracking-[0.16em] font-semibold text-[#2a2a2a] uppercase">
                    WYNN PALACE
                  </div>
                </div>

                {/* 中部 VIP 文案 */}
                <div className="text-center relative z-[2] mt-1">
                  <div className="text-[32px] leading-none tracking-[0.3em] font-semibold italic vip-text-gradient">
                    VIP
                  </div>
                </div>

                {/* 底部會員信息 */}
                <div className="absolute left-[18px] bottom-[14px] z-[2]">
                  <div className="text-[8px] tracking-[0.18em] uppercase text-[#4a4a4a] font-semibold mb-[2px]">
                    Membership ID
                  </div>
                  <div className="text-[15px] tracking-[0.18em] font-semibold text-[#111111]">
                    {maskedVipNumber}
                  </div>
                </div>
              </div>

              {/* 狀態文字區域 */}
              <div className="mt-8 text-center px-4">
                <div className="text-[13px] tracking-[0.22em] uppercase font-semibold text-[#333333]">
                  {statusMainLabel}
                  {isPendingLike && (
                    <span className="inline-flex ml-1 align-middle">
                      <span className="vip-dot vip-dot-1">.</span>
                      <span className="vip-dot vip-dot-2">.</span>
                      <span className="vip-dot vip-dot-3">.</span>
                    </span>
                  )}
                </div>
                <div className="mt-2 text-[11px] text-[#9a7a5c]">
                  {statusSubLabel}
                </div>

                {/* PENDING 狀態不再展示舊文案，其他狀態照常展示 message */}
                {message && !isPendingLike && (
                  <p className="mt-2 text-[11px] text-[#7b6246]">
                    {message}
                  </p>
                )}

                {reason && (
                  <p className="mt-2 text-[11px] text-[#b27745]">
                    {reason}
                  </p>
                )}

                {/* 審批通過但自動跳轉有問題時，給一個手動入口（邏輯不變） */}
                {canManualEnterChat && (
                  <button
                    type="button"
                    onClick={handleEnterChat}
                    className="mt-4 px-6 py-2 rounded-full text-[12px] font-semibold tracking-[0.18em] uppercase"
                    style={{
                      background:
                        "linear-gradient(91deg, #F3DBAB 3.63%, #D6BB87 100%)",
                      color: "#3a3023",
                    }}
                  >
                    Enter Concierge Chat
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* 底部 action（邏輯完全保留） */}
          {isErrorLike ? (
            <button
              type="button"
              onClick={handleBackToAccess}
              className="mt-4 w-full py-3.5 rounded-[8px] text-[13px] font-semibold tracking-[0.18em] uppercase"
              style={{
                background:
                  "linear-gradient(91deg, #F3DBAB 3.63%, #D6BB87 100%)",
                color: "#3a3023",
              }}
            >
              Back to VIP Access
            </button>
          ) : (
            <p className="mt-6 text-[10px] text-center text-[#9a856a]">
              You can safely close this page. Once approved, we will
              automatically connect you to our concierge.
            </p>
          )}
        </div>
      </div>

      {/* 🔧 動效相關樣式：只影響本頁 UI，不改任何邏輯 */}
      <style jsx>{`
        .vip-card-animate {
          box-shadow:
            0 15px 30px rgba(168, 142, 100, 0.25),
            0 5px 10px rgba(0, 0, 0, 0.05),
            inset 0 0 0 1px rgba(255, 255, 255, 0.4);
          animation: vip-card-float 5s ease-in-out infinite;
          transform-style: preserve-3d;
        }

        .vip-scan-line {
          position: absolute;
          top: -60%;
          left: -30%;
          width: 160%;
          height: 32px;
          background: linear-gradient(
            to bottom,
            rgba(255, 255, 255, 0) 0%,
            rgba(255, 255, 255, 0.6) 50%,
            rgba(255, 255, 255, 0) 100%
          );
          mix-blend-mode: soft-light;
          animation: vip-scan-move 2.5s cubic-bezier(0.4, 0, 0.2, 1) infinite;
          pointer-events: none;
          z-index: 3;
        }

        .vip-scan-line::after {
          content: "";
          position: absolute;
          top: 50%;
          left: 0;
          right: 0;
          height: 1px;
          background: rgba(255, 255, 255, 0.5);
          box-shadow: 0 0 2px rgba(255, 255, 255, 0.8);
        }

        .chip-lines {
          position: absolute;
          inset: 0;
        }

        .chip-lines::before,
        .chip-lines::after {
          content: "";
          position: absolute;
          background: rgba(0, 0, 0, 0.2);
        }

        .chip-lines::before {
          top: 0;
          bottom: 0;
          left: 50%;
          width: 1px;
          transform: translateX(-0.5px);
        }

        .chip-lines::after {
          left: 0;
          right: 0;
          top: 50%;
          height: 1px;
          transform: translateY(-0.5px);
        }

        .chip-rect {
          position: absolute;
          top: 50%;
          left: 50%;
          width: 12px;
          height: 8px;
          border-radius: 2px;
          border: 1px solid rgba(0, 0, 0, 0.2);
          transform: translate(-50%, -50%);
        }

        .vip-text-gradient {
          background: linear-gradient(
            to bottom,
            #8b5a2b 0%,
            #cd853f 50%,
            #8b5a2b 100%
          );
          -webkit-background-clip: text;
          background-clip: text;
          color: transparent;
          filter: drop-shadow(0 1px 0 rgba(255, 255, 255, 0.6));
        }

        .vip-dot {
          display: inline-block;
          font-size: 1em;
          line-height: 1;
          animation: vip-dot 1.2s infinite;
        }
        .vip-dot-2 {
          animation-delay: 0.2s;
        }
        .vip-dot-3 {
          animation-delay: 0.4s;
        }

        @keyframes vip-card-float {
          0%,
          100% {
            transform: translateY(0);
          }
          50% {
            transform: translateY(-6px);
          }
        }

        @keyframes vip-scan-move {
          0% {
            top: -60%;
            opacity: 0;
          }
          20% {
            opacity: 1;
          }
          80% {
            opacity: 1;
          }
          100% {
            top: 160%;
            opacity: 0;
          }
        }

        @keyframes vip-dot {
          0%,
          20% {
            opacity: 0;
          }
          40% {
            opacity: 1;
          }
          60%,
          100% {
            opacity: 0;
          }
        }
      `}</style>
    </div>
  );
}
