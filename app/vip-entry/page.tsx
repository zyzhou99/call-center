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
    <div className="vip-entry-page">
      <div className="verification-container">
        {/* 金色 VIP 卡片 */}
        <div className="vip-card">
          {isProcessing && <div className="scan-line" />}

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

        {/* 状态区 */}
        <div className="status-container">
          <div className="status-text">
            {statusLine}
            {isProcessing && <span className="loading-dots" />}
          </div>
          <span className="sub-text">{subStatusLine}</span>

          <p className="message-text">
            {message || "正在为您连接专属礼宾，请稍候…"}
          </p>
        </div>

        {/* 错误提示保持原有文案，只是换个样式 */}
        {status === "error" && (
          <div className="error-box">
            如果多次扫码仍无法进入，请联系酒店礼宾团队协助处理。
          </div>
        )}

        <div className="footer-tip">
          为了您的隐私安全，请勿将此页面分享给他人。
        </div>
      </div>

      {/* 本组件私有样式，基于你给的参考 HTML 精简适配 */}
      <style jsx>{`
        .vip-entry-page {
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 32px 16px;
          background-color: #fff9f0;
        }

        .verification-container {
          position: relative;
          width: 100%;
          max-width: 360px;
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
          margin-top: 40px;
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
          color: #4b3a2b;
          line-height: 1.6;
        }

        .error-box {
          margin-top: 14px;
          width: 100%;
          font-size: 12px;
          color: #b91c1c;
          background-color: #fef2f2;
          border: 1px solid #fecaca;
          border-radius: 8px;
          padding: 8px 10px;
        }

        .footer-tip {
          margin-top: 20px;
          font-size: 11px;
          color: #9b8773;
          text-align: center;
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
