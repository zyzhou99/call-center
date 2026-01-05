"use client";

import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import Image from "next/image";
import vipLogin from "@/assets/vip-login1.png";

type Phase = "form" | "waiting" | "error";

interface EntryResponse {
  ok: boolean;
  error?: string;
  pendingId?: string;
  vipDisplayName?: string;
}

interface PendingStatusResponse {
  ok: boolean;
  error?: string;
  status?: "PENDING" | "APPROVED" | "REJECTED";
  vipNumber?: string;
  preferredName?: string;
  reason?: string | null;
  contactIdentifier?: string | null;
  conversationId?: number | null;
  mode?: "wecom" | "h5" | string;
}

const POLL_INTERVAL_MS = 4000;

// 为浏览器生成/读取一个本地 ID（后面可以用来做二次登录免输入）
function getOrCreateBrowserId(): string | null {
  if (typeof window === "undefined") return null;
  const key = "vip_browser_id";
  let existing = window.localStorage.getItem(key);
  if (!existing) {
    if (window.crypto && "randomUUID" in window.crypto) {
      existing = window.crypto.randomUUID();
    } else {
      existing = `b_${Date.now()}_${Math.random().toString(16).slice(2)}`;
    }
    window.localStorage.setItem(key, existing);
  }
  return existing;
}

export default function VipAccessPage() {
  const searchParams = useSearchParams();
  const modeParam = searchParams.get("mode");
  const mode: "wecom" | "h5" =
    modeParam === "wecom" || modeParam === "h5" ? (modeParam as any) : "h5";

  const [vipNumber, setVipNumber] = useState("");
  const [preferredName, setPreferredName] = useState("");
  const [birthday, setBirthday] = useState(""); // yyyy-mm-dd

  const [phase, setPhase] = useState<Phase>("form");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [pendingId, setPendingId] = useState<string | null>(null);
  const [waitingName, setWaitingName] = useState<string | null>(null);
  const [pendingStatus, setPendingStatus] =
    useState<PendingStatusResponse | null>(null);

  // 提交表单：调用 /api/vip/entry
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!vipNumber.trim() || !preferredName.trim() || !birthday) {
      setErrorMsg("请完整填写 VIP 卡号、Preferred Name 和生日。");
      return;
    }

    setLoading(true);

    const browserId = getOrCreateBrowserId();

    try {
      const res = await fetch("/api/vip/entry", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          vipNumber: vipNumber.trim(),
          preferredName: preferredName.trim(),
          birthday,
          mode,
          browserId,
        }),
      });

      const data: EntryResponse = await res.json();

      if (!data.ok || !data.pendingId) {
        const code = data.error || "UNKNOWN_ERROR";
        let msg = "无法核验您的信息，请稍后再试。";

        if (code === "VIP_NOT_FOUND") {
          msg = "未找到对应的 VIP 记录，请与礼宾人员确认您的卡号。";
        } else if (code === "BIRTHDAY_MISMATCH") {
          msg = "您填写的生日与系统记录不符，请确认后重试。";
        } else if (code === "NAME_MISMATCH") {
          msg =
            "您填写的姓名与系统记录不符，请确认使用登记时的姓名或常用称呼。";
        } else if (code === "INVALID_BIRTHDAY") {
          msg = "生日格式不正确，请重新选择日期。";
        } else if (code === "NAME_REQUIRED") {
          msg = "请填写您的 Preferred Name。";
        }

        setErrorMsg(msg);
        setPhase("error");
        setLoading(false);
        return;
      }

      setPendingId(data.pendingId);
      setWaitingName(data.vipDisplayName || preferredName.trim());
      setPhase("waiting");
      setLoading(false);
    } catch (err) {
      console.error(err);
      setErrorMsg("服务暂时不可用，请稍后再试。");
      setPhase("error");
      setLoading(false);
    }
  };

  // 轮询 PendingApproval 状态
  useEffect(() => {
    if (phase !== "waiting" || !pendingId) return;

    let timer: ReturnType<typeof setTimeout> | null = null;
    let cancelled = false;

    async function poll() {
      try {
        const res = await fetch(`/api/vip/pending/${pendingId}`);
        const data: PendingStatusResponse = await res.json();

        if (!data.ok) {
          setErrorMsg("系统暂时无法确认您的信息，请稍后重试。");
          setPhase("error");
          return;
        }

        setPendingStatus(data);

        if (data.status === "PENDING") {
          if (!cancelled) {
            timer = setTimeout(poll, POLL_INTERVAL_MS);
          }
          return;
        }

        if (data.status === "REJECTED") {
          setErrorMsg(
            data.reason ||
              "很抱歉，您的信息暂未通过核验，请联系礼宾人员协助。"
          );
          setPhase("error");
          return;
        }

        if (data.status === "APPROVED") {
          // 如果莫名其妙没有 pendingId，就报错并中断
          if (!pendingId) {
            console.error("Missing pendingId when status is APPROVED");
            setErrorMsg("系统繁忙，请稍后重试。");
            setPhase("error");
            return;
          }

          const url = new URL("/vip-chat", window.location.origin);
          url.searchParams.set("pendingId", pendingId);

          if (data.contactIdentifier) {
            url.searchParams.set("contact", data.contactIdentifier);
          }
          if (data.conversationId != null) {
            url.searchParams.set("conversationId", String(data.conversationId));
          }
          if (data.mode) {
            url.searchParams.set("mode", data.mode);
          } else {
            url.searchParams.set("mode", mode);
          }

          window.location.href = url.toString();
        }
      } catch (err) {
        console.error("Error polling pending status:", err);
        setErrorMsg("网络异常，请稍后重试。");
        setPhase("error");
      }
    }

    poll();

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [phase, pendingId, mode]);

  const disableSubmit =
    loading || !vipNumber.trim() || !preferredName.trim() || !birthday;

  const inForm = phase === "form";
  const inWaiting = phase === "waiting";
  const inError = phase === "error";

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

        {/* 表单 / 状态区域 */}
        <div className="flex-1 px-7 pt-12 pb-12">
          {inForm && (
            <form className="space-y-7" onSubmit={handleSubmit}>
              {/* 小提示：当前入口模式 */}
              <div className="text-[11px] text-[#8b6a33] mb-2">
                {mode === "wecom"
                  ? "当前入口：企业微信版（核验通过后，将视打开方式跳转到企业微信对话或 H5 对话）"
                  : "当前入口：H5 对话版（核验通过后，将进入网页对话页面）"}
              </div>

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
                  placeholder="Cathy"
                  className="w-full px-5 py-3.5 rounded-[8px] border border-[#d3a65b] bg-[#fffaf2] text-[16px] text-[#32261c] shadow-sm focus:outline-none focus:ring-2 focus:ring-[#d3a65b] focus:border-transparent"
                />
              </div>

              {/* BIRTHDAY */}
              <div className="space-y-2">
                <label className="block text-[12px] font-semibold tracking-[0.18em] text-[#c79b4a] uppercase">
                  BIRTHDAY
                </label>
                <input
                  type="date"
                  value={birthday}
                  onChange={(e) => setBirthday(e.target.value)}
                  className="w-full px-5 py-3.5 rounded-[8px] border border-[#d3a65b] bg-[#fffaf2] text-[14px] text-[#32261c] shadow-sm focus:outline-none focus:ring-2 focus:ring-[#d3a65b] focus:border-transparent"
                />
              </div>

              {/* 错误提示 */}
              {errorMsg && (
                <div className="mt-2 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-[11px] text-red-700">
                  {errorMsg}
                </div>
              )}

              {/* Connect 按钮 */}
              <button
                type="submit"
                disabled={disableSubmit}
                className="mt-4 w-full py-3.5 rounded-[8px] text-[16px] font-semibold tracking-[0.18em] uppercase disabled:opacity-50 disabled:cursor-not-allowed"
                style={{
                  background:
                    "linear-gradient(91deg, #F3DBAB 3.63%, #D6BB87 100%)",
                  color: "#3a3023",
                }}
              >
                {loading ? "VERIFYING..." : "Connect"}
              </button>

              <p className="text-[11px] text-[#7b6a52] leading-relaxed">
                您提供的资料仅用于本次入住期间的身份核验与礼宾服务，不会用于任何商业推广。
              </p>
            </form>
          )}

          {inWaiting && (
            <div className="space-y-6">
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 rounded-full border-2 border-[#d3a65b] border-t-transparent animate-spin" />
                <div>
                  <div className="text-[14px] text-[#32261c]">
                    正在为您确认 VIP 身份
                    {waitingName ? `，${waitingName} 尊贵的贵宾` : ""}…
                  </div>
                  <div className="mt-1 text-[11px] text-[#7b6a52]">
                    请稍候，礼宾人员正在核对您的信息。您无需关闭此页面，核验通过后我们会自动为您进入对话。
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-[#e4c794] bg-[#fff7ea] px-4 py-3 space-y-2">
                <div className="text-[11px] font-semibold tracking-[0.18em] text-[#c79b4a] uppercase">
                  CURRENT STATUS
                </div>
                <div className="text-[13px] text-[#32261c]">
                  当前状态：{pendingStatus?.status || "PENDING"}
                </div>
                <div className="text-[11px] text-[#7b6a52]">
                  如需协助，您也可以直接联系现场礼宾人员，我们会为您手动完成核验。
                </div>
              </div>
            </div>
          )}

          {inError && (
            <div className="space-y-6">
              {errorMsg && (
                <div className="mt-2 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-[11px] text-red-700">
                  {errorMsg}
                </div>
              )}

              <button
                type="button"
                onClick={() => {
                  setPhase("form");
                  setErrorMsg(null);
                  setPendingId(null);
                  setPendingStatus(null);
                }}
                className="w-full py-3.5 rounded-[8px] text-[16px] font-semibold tracking-[0.18em] uppercase"
                style={{
                  background:
                    "linear-gradient(91deg, #F3DBAB 3.63%, #D6BB87 100%)",
                  color: "#3a3023",
                }}
              >
                Back
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
