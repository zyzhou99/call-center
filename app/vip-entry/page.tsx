"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

type EntryStatus = "idle" | "processing" | "success" | "error";

interface VipEntryResponse {
  ok: boolean;
  sessionId?: string;
  error?: string;
}

export default function VipEntryPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [status, setStatus] = useState<EntryStatus>("idle");
  const [message, setMessage] = useState<string>("");

  // 防止 StrictMode 下 useEffect 执行两次
  const startedRef = useRef(false);

  // ✅ 支持三种 query 参数：qrCode / token / vipKey（向下兼容）
  const qrCodeParam = searchParams.get("qrCode");
  const tokenParam = searchParams.get("token");
  const vipKeyParam = searchParams.get("vipKey");

  // 用来做「有没有传东西」的统一判断
  const entryKey =
    qrCodeParam ||
    tokenParam ||
    vipKeyParam ||
    "";

  useEffect(() => {
    // 没有任何令牌：直接报错
    if (!entryKey) {
      setStatus("error");
      setMessage("链接缺少 VIP 身份信息，请联系礼宾团队重新获取二维码。");
      return;
    }

    // 防止重复触发
    if (startedRef.current) return;
    startedRef.current = true;

    const run = async () => {
      // 判断是不是微信内打开
      const isWeChat =
        typeof navigator !== "undefined" &&
        /MicroMessenger/i.test(navigator.userAgent);

      const scanChannel = isWeChat ? "wechat" : "browser";

      // H5 通道统一用 browserId 做 channelIdentifier
      let channelIdentifier: string | null = null;

      if (typeof window !== "undefined") {
        const KEY = "vip_browser_id";
        channelIdentifier = window.localStorage.getItem(KEY);
        if (!channelIdentifier) {
          channelIdentifier =
            "browser_" +
            Math.random().toString(36).slice(2) +
            "_" +
            Date.now().toString(36);
          window.localStorage.setItem(KEY, channelIdentifier);
        }
      }

      setStatus("processing");
      setMessage("正在为您连接专属礼宾，请稍候…");

      try {
        // ✅ 按优先级组装请求 body：
        // 1) 有 qrCode 参数 → 作为 qrCode
        // 2) 否则用 token / vipKey → 作为 token（后端用 id / vipNumber 匹配）
        const payload: any = {
          scanChannel,
          channelIdentifier,
        };

        if (qrCodeParam && qrCodeParam.trim().length > 0) {
          payload.qrCode = qrCodeParam.trim();
        } else if (tokenParam && tokenParam.trim().length > 0) {
          payload.token = tokenParam.trim();
        } else if (vipKeyParam && vipKeyParam.trim().length > 0) {
          // 老链接上如果是 vipKey，就当作 token 处理
          payload.token = vipKeyParam.trim();
        }

        const res = await fetch("/api/vip/entry", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

        let data: VipEntryResponse;
        try {
          data = (await res.json()) as VipEntryResponse;
        } catch (e) {
          data = { ok: false, error: "INVALID_JSON" };
        }

        if (!res.ok || !data.ok || !data.sessionId) {
          console.error("vip entry failed:", data);
          setStatus("error");
          setMessage(
            data.error ||
              "暂时无法为您建立会话，请稍后重试或联系现场礼宾人员。"
          );
          return;
        }

        setStatus("success");
        setMessage("已为您连接礼宾，即将进入会话…");

        // 小延迟，让用户看到一下“已连接”
        setTimeout(() => {
          router.replace(`/vip-chat?sessionId=${encodeURIComponent(
            data.sessionId!
          )}`);
        }, 500);
      } catch (e) {
        console.error("vip entry error:", e);
        setStatus("error");
        setMessage("网络异常，请稍后重试或联系现场礼宾人员。");
      }
    };

    void run();
  }, [entryKey, qrCodeParam, tokenParam, vipKeyParam, router]);

  const isProcessing = status === "processing" || status === "idle";

  return (
    <div
      className="min-h-screen flex items-center justify-center"
      style={{ backgroundColor: "#F9F8F6" }}
    >
      <div className="w-full max-w-md mx-4 rounded-2xl shadow-lg border border-[#e6dfd2] bg-white px-8 py-7">
        <div className="mb-4">
          <p
            className="text-[11px] font-semibold tracking-[0.18em] uppercase"
            style={{ color: "#b28a4a" }}
          >
            Wynn Palace · VIP Access
          </p>
        </div>

        <h1 className="text-lg font-semibold text-[#3a3023] mb-2">
          正在为您连接礼宾
        </h1>

        <p className="text-[13px] text-[#6b5b4a] mb-4 leading-relaxed">
          请保持当前页面打开，系统正在识别您的专属二维码并为您建立安全会话。
        </p>

        <div className="flex items-center gap-3 mb-4">
          {isProcessing ? (
            <div className="w-4 h-4 border-2 border-[#d7c19b] border-t-transparent rounded-full animate-spin" />
          ) : null}
          <p className="text-[13px] text-[#4b3a2b]">
            {message ||
              "正在为您连接专属礼宾，请稍候…"}
          </p>
        </div>

        {status === "error" && (
          <div className="mt-3 text-[12px] text-[#b91c1c] bg-[#fef2f2] border border-[#fecaca] rounded-lg px-3 py-2">
            如果多次扫码仍无法进入，请联系酒店礼宾团队协助处理。
          </div>
        )}

        <div className="mt-6 text-[11px] text-[#9b8773]">
          为了您的隐私安全，请勿将此页面分享给他人。
        </div>
      </div>
    </div>
  );
}
