// app/vip-request/page.tsx
"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import vipLogin from "@/assets/vip-login1.png";

type RequestStatus = "INIT" | "SUBMITTING" | "SUCCESS" | "ERROR";

interface SubmitResponse {
  ok: boolean;
  pendingId?: string;
  error?: string;
}

export default function VipRequestPage() {
  const router = useRouter();

  const [status, setStatus] = useState<RequestStatus>("INIT");
  const [message, setMessage] = useState<string>(
    "Connecting you to our concierge, please wait…"
  );

  // 防止 StrictMode 下 useEffect 執行兩次
  const startedRef = useRef(false);

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;

    const run = async () => {
      // 1) 判斷是不是微信內打開
      const isWeChat =
        typeof navigator !== "undefined" &&
        /MicroMessenger/i.test(navigator.userAgent);

      const scanChannel: "wechat" | "browser" = isWeChat ? "wechat" : "browser";

      // 2) 構造 / 拿到 channelIdentifier（和你之前 H5 一致：瀏覽器一個 id、微信一個 id）
      let channelIdentifier: string | null = null;

      if (typeof window !== "undefined") {
        const KEY = isWeChat ? "vip_h5_wechat_id" : "vip_browser_id";

        channelIdentifier = window.localStorage.getItem(KEY);
        if (!channelIdentifier) {
          channelIdentifier =
            (isWeChat ? "wxh5:" : "browser_") +
            Math.random().toString(36).slice(2) +
            "_" +
            Date.now().toString(36);

          window.localStorage.setItem(KEY, channelIdentifier);
        }
      }

      if (!channelIdentifier) {
        setStatus("ERROR");
        setMessage(
          "We could not identify your device. Please try scanning the QR code again."
        );
        return;
      }

      setStatus("SUBMITTING");
      setMessage("Sending your request to our concierge…");

      try {
        // 3) 呼叫後端：這裡只傳 scanChannel + channelIdentifier
        const res = await fetch("/api/vip/submit", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            scanChannel,
            channelIdentifier,
          }),
        });

        const data: SubmitResponse = await res.json().catch(() => ({
          ok: false,
          error: "INVALID_JSON",
        }));

        if (!res.ok || !data.ok || !data.pendingId) {
          console.error("/api/vip/submit failed:", data);
          setStatus("ERROR");
          setMessage(
            "We were unable to submit your request. Please try again or contact our team."
          );
          return;
        }

        setStatus("SUCCESS");
        setMessage("Your request has been submitted. Connecting you…");

        // 4) 成功後，直接跳到 /vip-pending?pendingId=...
        router.replace(
          `/vip-pending?pendingId=${encodeURIComponent(data.pendingId)}`
        );
      } catch (e) {
        console.error("vip generic submit error:", e);
        setStatus("ERROR");
        setMessage("Network error. Please try again.");
      }
    };

    void run();
  }, [router]);

  const isError = status === "ERROR";
  const isLoading = status === "INIT" || status === "SUBMITTING";

  const statusLine = isError
    ? "Request Failed"
    : status === "SUCCESS"
    ? "Request Submitted"
    : "Sending Request";

  const subStatusLine = isError
    ? "We could not submit your request"
    : status === "SUCCESS"
    ? "Your request has been received, connecting you…"
    : "Connecting you to our concierge team";

  return (
    <div className="min-h-screen bg-[#fbf3e7] flex justify-center">
      <div className="w-full max-w-md flex flex-col bg-[#fbf3e7]">
        {/* 頂部頭圖，重用 vip-login */}
        <div className="relative w-full">
          <div className="relative w-full h-[260px] overflow-hidden">
            <Image
              src={vipLogin}
              alt="VIP access"
              fill
              priority
              className="object-cover object-bottom"
            />
          </div>
        </div>

        {/* 內容區 */}
        <div className="flex-1 px-7 pt-8 pb-10 flex flex-col items-center">
          <h1 className="text-[20px] font-semibold text-[#3a3023] mb-2 w-full">
            Wynn Palace · VIP Concierge
          </h1>

          <p className="text-[12px] text-[#6e5842] mb-6 leading-relaxed w-full">
            Please wait while we connect you to our concierge team.
          </p>

          {/* 中间 VIP 卡片等待 UI */}
          <div className="flex-1 flex flex-col items-center justify-center w-full">
            <div className="verification-container">
              <div className="vip-card">
                {isLoading && <div className="scan-line" />}

                <div className="card-top">
                  <div className="card-chip">
                    <div className="chip-lines">
                      <div className="chip-rect" />
                    </div>
                  </div>
                  <div className="card-logo">WYNN PALACE</div>
                </div>

                <div className="card-center">
                  <div className="vip-text">VIP</div>
                </div>

                <div className="card-bottom">
                  <span className="member-label">Membership ID</span>
                  <span className="card-number">********</span>
                </div>
              </div>

              <div className="status-container">
                <div className="status-text">
                  {statusLine}
                  {isLoading && <span className="loading-dots" />}
                </div>
                <span className="sub-text">{subStatusLine}</span>

                <p className="message-text">{message}</p>
              </div>
            </div>
          </div>

          {/* 底部提示文案保持原来的逻辑，只是放在卡片下面 */}
          {!isError ? (
            <p className="mt-6 text-[10px] text-center text-[#9a856a] w-full">
              You may keep this page open while we process your request.
            </p>
          ) : (
            <p className="mt-6 text-[10px] text-center text-[#9a856a] w-full">
              If the issue persists, please contact our concierge team on site.
            </p>
          )}
        </div>
      </div>

      {/* VIP 卡片樣式，與 vip-entry 保持同一風格 */}
      <style jsx>{`
        .verification-container {
          position: relative;
          width: 100%;
          display: flex;
          flex-direction: column;
          align-items: center;
        }

        .vip-card {
          width: 240px;
          height: 152px;
          background: linear-gradient(
            135deg,
            #f9ebbe 0%,
            #e7d3ac 50%,
            #d6bb9a 100%
          );
          border-radius: 12px;
          position: relative;
          padding: 18px;
          box-shadow: 0 15px 30px rgba(168, 142, 100, 0.25),
            0 5px 10px rgba(0, 0, 0, 0.05),
            inset 0 0 0 1px rgba(255, 255, 255, 0.4);
          animation: cardFloat 5s ease-in-out infinite;
          transform-style: preserve-3d;
          overflow: hidden;
        }

        .card-top {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 15px;
          position: relative;
          z-index: 2;
        }

        .card-chip {
          width: 32px;
          height: 22px;
          background: linear-gradient(
            135deg,
            #d4af37 0%,
            #feeaa3 50%,
            #b8860b 100%
          );
          border-radius: 4px;
          position: relative;
          border: 1px solid rgba(184, 134, 11, 0.3);
          box-shadow: inset 0 1px 2px rgba(255, 255, 255, 0.4);
        }

        .chip-lines {
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          width: 100%;
          height: 100%;
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
          transform: translate(-50%, -50%);
          width: 12px;
          height: 8px;
          border: 1px solid rgba(0, 0, 0, 0.2);
          border-radius: 2px;
        }

        .card-logo {
          font-size: 10px;
          font-weight: 600;
          letter-spacing: 1px;
          color: #2a2a2a;
          text-transform: uppercase;
        }

        .card-center {
          text-align: center;
          margin-top: 5px;
          position: relative;
          z-index: 2;
        }

        .vip-text {
          font-size: 32px;
          font-weight: 700;
          letter-spacing: 4px;
          font-style: italic;
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

        .card-bottom {
          position: absolute;
          bottom: 14px;
          left: 18px;
          z-index: 2;
        }

        .member-label {
          font-size: 8px;
          text-transform: uppercase;
          letter-spacing: 1px;
          color: #4a4a4a;
          display: block;
          margin-bottom: 1px;
          font-weight: 700;
        }

        .card-number {
          font-size: 15px;
          letter-spacing: 2px;
          font-weight: 700;
          color: #111111;
          text-shadow: 0 1px 0 rgba(255, 255, 255, 0.4);
        }

        .scan-line {
          position: absolute;
          top: -60%;
          left: -30%;
          width: 150%;
          height: 30px;
          background: linear-gradient(
            to bottom,
            rgba(255, 255, 255, 0) 0%,
            rgba(255, 255, 255, 0.6) 50%,
            rgba(255, 255, 255, 0) 100%
          );
          mix-blend-mode: soft-light;
          transform: rotate(-15deg);
          animation: scanMove 2.5s cubic-bezier(0.4, 0, 0.2, 1) infinite;
          z-index: 3;
          pointer-events: none;
        }
        .scan-line::after {
          content: "";
          position: absolute;
          top: 50%;
          left: 0;
          right: 0;
          height: 1px;
          background: rgba(255, 255, 255, 0.5);
          box-shadow: 0 0 2px rgba(255, 255, 255, 0.8);
        }

        .status-container {
          margin-top: 32px;
          text-align: center;
        }

        .status-text {
          font-size: 13px;
          letter-spacing: 2px;
          color: #333333;
          font-weight: 700;
          text-transform: uppercase;
        }

        .loading-dots::after {
          content: ".";
          animation: dots 1.5s steps(5, end) infinite;
        }

        .sub-text {
          display: block;
          margin-top: 6px;
          font-size: 10px;
          color: #999999;
          letter-spacing: 1px;
        }

        .message-text {
          margin-top: 10px;
          font-size: 13px;
          color: #5b4632;
          line-height: 1.6;
          padding: 0 8px;
        }

        @keyframes cardFloat {
          0%,
          100% {
            transform: translateY(0);
          }
          50% {
            transform: translateY(-6px);
          }
        }

        @keyframes scanMove {
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

        @keyframes dots {
          0%,
          20% {
            content: ".";
          }
          40% {
            content: "..";
          }
          60% {
            content: "...";
          }
          80%,
          100% {
            content: "";
          }
        }
      `}</style>
    </div>
  );
}
