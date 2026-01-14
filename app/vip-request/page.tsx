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
        <div className="flex-1 px-7 pt-10 pb-12 flex flex-col">
          <h1 className="text-[20px] font-semibold text-[#3a3023] mb-2">
            Wynn Palace · VIP Concierge
          </h1>

          <p className="text-[12px] text-[#6e5842] mb-8 leading-relaxed">
            Please wait while we connect you to our concierge team.
          </p>

          <div className="flex-1 flex flex-col items-center justify-center">
            <div
              className={`w-16 h-16 mb-4 rounded-full border-2 ${
                isError
                  ? "border-[#d3a65b]"
                  : "border-[#d3a65b] border-t-transparent animate-spin"
              }`}
            />

            <p className="text-[13px] text-center text-[#5b4632] px-4 mb-2">
              {message}
            </p>
          </div>

          {!isError ? (
            <p className="mt-6 text-[10px] text-center text-[#9a856a]">
              You may keep this page open while we process your request.
            </p>
          ) : (
            <p className="mt-6 text-[10px] text-center text-[#9a856a]">
              If the issue persists, please contact our concierge team on site.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
