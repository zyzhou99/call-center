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
        <div className="flex-1 px-7 pt-10 pb-12 flex flex-col">
          <h1 className="text-[20px] font-semibold text-[#3a3023] mb-2">
            Wynn Palace · VIP Concierge
          </h1>

          <p className="text-[12px] text-[#6e5842] mb-8 leading-relaxed">
            {status === "PENDING"
              ? "Thank you for your patience. Our concierge is verifying your details."
              : "Please wait while we process your request."}
          </p>

          {/* 中間狀態卡片 */}
          <div className="flex-1 flex flex-col items-center justify-center">
            {/* 圓形 spinner / 狀態標誌 */}
            <div
              className={`w-16 h-16 mb-4 rounded-full border-2 ${
                isErrorLike
                  ? "border-[#d3a65b]"
                  : "border-[#d3a65b] border-t-transparent animate-spin"
              }`}
            />

            <p className="text-[13px] text-center text-[#5b4632] px-4 mb-2">
              {message}
            </p>

            {reason && (
              <p className="text-[11px] text-center text-[#9a7a55] px-4 mt-1">
                {reason}
              </p>
            )}

            {/* ⭐ 新增：審批通過但自動跳轉有問題時，給一個手動入口 */}
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

          {/* 底部 action */}
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
    </div>
  );
}
