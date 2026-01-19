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

  // 文案：上方英文状态 + 下方中文副标题
  const statusLine =
    status === "success"
      ? "Connected to Concierge"
      : status === "error"
      ? "Verification Failed"
      : "Verifying Identity";
  const subStatusLine =
    status === "success"
      ? "已为您连接礼宾，即将进入一对一会话"
      : status === "error"
      ? "如果多次扫码仍无法进入，请联系酒店礼宾团队协助处理"
      : "正在核验尊贵会员身份，请保持当前页面打开";

  return (
    <div
      className="min-h-screen flex items-center justify-center px-4"
      style={{ backgroundColor: "#FFF9F0" }}
    >
      <div className="w-full max-w-[360px] flex flex-col items-center">
        {/* 金色 VIP 卡片 */}
        <div
          className="w-[240px] h-[152px] rounded-[12px] relative p-[18px] overflow-hidden"
          style={{
            background:
              "linear-gradient(135deg,#F9EBBE 0%,#E7D3AC 50%,#D6BB9A 100%)",
            boxShadow:
              "0 15px 30px rgba(168,142,100,0.25)," +
              "0 5px 10px rgba(0,0,0,0.05)," +
              "inset 0 0 0 1px rgba(255,255,255,0.4)",
          }}
        >
          {/* 扫描光效：用 Tailwind 自带的 animate-pulse 代替复杂 keyframe */}
          {isProcessing && (
            <div
              className="absolute -top-1/2 -left-1/3 w-[150%] h-[30px] rotate-[-15deg] animate-pulse"
              style={{
                background:
                  "linear-gradient(to bottom,rgba(255,255,255,0) 0%,rgba(255,255,255,0.6) 50%,rgba(255,255,255,0) 100%)",
                mixBlendMode: "soft-light",
              }}
            />
          )}

          {/* 顶部：芯片 + LOGO */}
          <div className="flex items-center justify-between mb-[15px] relative z-10">
            {/* 芯片 */}
            <div
              className="w-8 h-[22px] rounded-[4px] relative"
              style={{
                background:
                  "linear-gradient(135deg,#d4af37 0%,#feeaa3 50%,#b8860b 100%)",
                border: "1px solid rgba(184,134,11,0.3)",
                boxShadow: "inset 0 1px 2px rgba(255,255,255,0.4)",
              }}
            >
              <div className="absolute inset-0">
                {/* 竖线 */}
                <div
                  className="absolute top-0 bottom-0 left-1/2 w-px"
                  style={{
                    background: "rgba(0,0,0,0.2)",
                    transform: "translateX(-0.5px)",
                  }}
                />
                {/* 横线 */}
                <div
                  className="absolute left-0 right-0 top-1/2 h-px"
                  style={{
                    background: "rgba(0,0,0,0.2)",
                    transform: "translateY(-0.5px)",
                  }}
                />
                {/* 中间小矩形 */}
                <div
                  className="absolute w-[12px] h-[8px] rounded-[2px]"
                  style={{
                    border: "1px solid rgba(0,0,0,0.2)",
                    top: "50%",
                    left: "50%",
                    transform: "translate(-50%,-50%)",
                  }}
                />
              </div>
            </div>

            {/* LOGO 文字 */}
            <div className="text-[10px] font-semibold tracking-[0.1em] text-[#2a2a2a] uppercase">
              WYNN PALACE
            </div>
          </div>

          {/* 中间 VIP 字样 */}
          <div className="text-center mt-[2px] relative z-10">
            <div
              className="text-[32px] font-bold italic tracking-[0.4em]"
              style={{
                background:
                  "linear-gradient(to bottom,#8B5A2B 0%,#CD853F 50%,#8B5A2B 100%)",
                WebkitBackgroundClip: "text",
                backgroundClip: "text",
                color: "transparent",
                filter: "drop-shadow(0 1px 0 rgba(255,255,255,0.6))",
              }}
            >
              VIP
            </div>
          </div>

          {/* 底部 Membership ID */}
          <div className="absolute left-[18px] bottom-[14px] z-10">
            <span className="block text-[8px] uppercase tracking-[0.1em] text-[#4a4a4a] font-bold mb-[1px]">
              Membership ID
            </span>
            <span
              className="text-[15px] tracking-[0.2em] font-bold text-[#111111]"
              style={{
                textShadow: "0 1px 0 rgba(255,255,255,0.4)",
              }}
            >
              ********
            </span>
          </div>
        </div>

        {/* 状态区 */}
        <div className="mt-10 text-center">
          <div className="text-[13px] tracking-[0.2em] font-semibold text-[#333333] uppercase">
            {statusLine}
            {isProcessing && (
              <span className="inline-block ml-1 animate-pulse">...</span>
            )}
          </div>
          <div className="mt-[6px] text-[10px] text-[#999999] tracking-[0.1em]">
            {subStatusLine}
          </div>

          <p className="mt-3 text-[13px] leading-relaxed text-[#4b3a2b]">
            {message || "正在为您连接专属礼宾，请稍候…"}
          </p>
        </div>

        {/* 错误提示：保持原来的意思，只是用 Tailwind 调一下样式 */}
        {status === "error" && (
          <div className="mt-4 w-full text-[12px] text-[#b91c1c] bg-[#fef2f2] border border-[#fecaca] rounded-lg px-3 py-2 text-center">
            如果多次扫码仍无法进入，请联系酒店礼宾团队协助处理。
          </div>
        )}

        <div className="mt-5 text-[11px] text-[#9b8773] text-center">
          为了您的隐私安全，请勿将此页面分享给他人。
        </div>
      </div>
    </div>
  );
}
