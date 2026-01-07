"use client";

import { useState, useEffect, FormEvent, useMemo } from "react";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import vipLogin from "@/assets/vip-login1.png";

// 10 分钟复用窗口
const REUSE_WINDOW_MS = 10 * 60 * 1000;

type VersionType = "hybrid" | "h5";
type EntryMode = "wecom" | "h5";
type ScanChannel = "wechat" | "browser";
type Language = "en" | "zh-Hant";

interface SubmitResponse {
  ok: boolean;
  pendingId?: string;
  error?: string;
}

interface SavedPendingState {
  pendingId: string;
  vipNumber: string;
  preferredName: string | null;
  birthdayMd: string;
  ts: number;
  version: VersionType;
  entryMode: EntryMode;
  scanChannel: ScanChannel;
}

const TEXTS: Record<
  Language,
  {
    title: string;
    subtitle: string;
    vipLabel: string;
    vipPlaceholder: string;
    nameLabel: string;
    namePlaceholder: string;
    birthdayLabel: string;
    birthdayHint: string;
    birthdayPlaceholder: string;
    buttonIdle: string;
    buttonLoading: string;
    errorMissingFields: string;
    errorInfoMismatch: string;
    errorServer: string;
    errorNetwork: string;
    genericError: string;
    modeLabel: string;
    langToggleLeft: string;
    langToggleRight: string;
  }
> = {
  en: {
    title: "Wynn Palace · VIP Concierge",
    subtitle:
      "For your account security, please enter your VIP card number and birthday so that our concierge can verify your identity.",
    vipLabel: "VIP CARD NUMBER",
    vipPlaceholder: "10001",
    nameLabel: "PREFERRED NAME",
    namePlaceholder: "Alex",
    birthdayLabel: "BIRTHDAY (MMDD)",
    birthdayHint: "For verification only, e.g. 0323",
    birthdayPlaceholder: "0323",
    buttonIdle: "Connect",
    buttonLoading: "VERIFYING...",
    errorMissingFields:
      "Please fill in both your VIP card number and birthday.",
    errorInfoMismatch:
      "The VIP card number or birthday does not match our records. Please check and try again.",
    errorServer: "Service is temporarily unavailable. Please try again later.",
    errorNetwork: "Network error. Please try again.",
    genericError: "Request failed. Please try again.",
    modeLabel: "Current mode",
    langToggleLeft: "EN",
    langToggleRight: "繁體",
  },
  "zh-Hant": {
    title: "永利皇宮 · VIP 禮賓服務",
    subtitle:
      "為確保您的帳戶安全，請輸入您的 VIP 卡號與生日，以便禮賓為您核實身份。",
    vipLabel: "VIP 卡號",
    vipPlaceholder: "10001",
    nameLabel: "稱呼（選填）",
    namePlaceholder: "Alex / 張先生",
    birthdayLabel: "生日（MMDD）",
    birthdayHint: "僅用於核驗，例如：0323",
    birthdayPlaceholder: "0323",
    buttonIdle: "連接專屬禮賓",
    buttonLoading: "驗證中...",
    errorMissingFields: "請填寫完整的 VIP 卡號與生日。",
    errorInfoMismatch: "您輸入的 VIP 卡號或生日與系統不符，請檢查後重新輸入。",
    errorServer: "服務暫時無法使用，請稍後再試。",
    errorNetwork: "網路異常，請稍後再試。",
    genericError: "請求未成功，請稍後再試。",
    modeLabel: "目前入口模式",
    langToggleLeft: "EN",
    langToggleRight: "繁體",
  },
};

export default function VipAccessPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [language, setLanguage] = useState<Language>("en");

  const [vipNumber, setVipNumber] = useState("");
  const [preferredName, setPreferredName] = useState("");
  const [birthdayMd, setBirthdayMd] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [entryMode, setEntryMode] = useState<EntryMode>("h5");
  const [scanChannel, setScanChannel] = useState<ScanChannel>("browser");

  // 从 URL 读 version，默认 hybrid
  const version: VersionType = useMemo(() => {
    const v = searchParams.get("version");
    if (v === "h5") return "h5";
    return "hybrid";
  }, [searchParams]);

  const t = TEXTS[language];

  // 入口模式识别：WeChat / 浏览器 + version
  useEffect(() => {
    if (typeof navigator === "undefined") return;
    const ua = navigator.userAgent || "";
    const isWeChat = /MicroMessenger/i.test(ua);

    setScanChannel(isWeChat ? "wechat" : "browser");

    if (version === "hybrid" && isWeChat) {
      setEntryMode("wecom");
    } else {
      setEntryMode("h5");
    }
  }, [version]);

  // 页面加载时，检查 10 分钟内是否有 pending 记录，有的话直接跳到 /vip-pending
  useEffect(() => {
    if (typeof window === "undefined") return;

    try {
      const raw = window.localStorage.getItem("vip_access_last_pending");
      if (!raw) return;

      const saved = JSON.parse(raw) as SavedPendingState;
      if (!saved?.pendingId || !saved.ts) return;

      const now = Date.now();
      if (now - saved.ts > REUSE_WINDOW_MS) {
        window.localStorage.removeItem("vip_access_last_pending");
        return;
      }

      // 10 分鐘內：直接復用上一次的 pendingId
      router.replace(`/vip-pending?pendingId=${encodeURIComponent(saved.pendingId)}`);
    } catch (e) {
      console.error("Failed to auto-redirect from saved pending", e);
    }
  }, [router]);

  function normalizeBirthdayMd(input: string): string | null {
    if (!input) return null;
    const digits = input.replace(/\D/g, "");
    if (!digits) return null;
    if (digits.length === 4) return digits;
    if (digits.length === 3) return digits.padStart(4, "0");
    if (digits.length === 2) {
      // 像 "323" 輸錯成 "32" 的情況，先不自動糾正，返回 null 讓後端判錯
      return digits;
    }
    return digits;
  }

  function translateError(error?: string): string {
    if (!error) return t.genericError;

    switch (error) {
      case "INVALID_INPUT":
      case "INVALID_BIRTHDAY_FORMAT":
      case "VIP_NOT_FOUND":
      case "VIP_INFO_MISMATCH":
        return t.errorInfoMismatch;
      case "SERVER_ERROR":
        return t.errorServer;
      default:
        return t.genericError;
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setErrorMsg(null);

    if (!vipNumber.trim() || !birthdayMd.trim()) {
      setErrorMsg(t.errorMissingFields);
      return;
    }

    setLoading(true);
    try {
      const normalized = normalizeBirthdayMd(birthdayMd);
      // 這裡先簡單處理，真正格式錯誤後端還會再校驗
      const body = {
        vipNumber: vipNumber.trim(),
        preferredName: preferredName.trim() || undefined,
        birthdayMd: normalized ?? birthdayMd.trim(),
        version,
        entryMode,
        scanChannel,
      };

      const res = await fetch("/api/vip/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const data: SubmitResponse = await res.json();

      if (!data.ok || !data.pendingId) {
        setErrorMsg(translateError(data.error));
        setLoading(false);
        return;
      }

      // ✅ 成功：保存 pending 狀態，用於 10 分鐘內重用
      if (typeof window !== "undefined") {
        try {
          const saved: SavedPendingState = {
            pendingId: data.pendingId,
            vipNumber: vipNumber.trim(),
            preferredName: preferredName.trim() || null,
            birthdayMd: normalized ?? birthdayMd.trim(),
            ts: Date.now(),
            version,
            entryMode,
            scanChannel,
          };
          window.localStorage.setItem(
            "vip_access_last_pending",
            JSON.stringify(saved)
          );
        } catch (e) {
          console.error("Failed to save vip_access_last_pending", e);
        }
      }

      router.push(
        `/vip-pending?pendingId=${encodeURIComponent(data.pendingId)}`
      );
    } catch (err) {
      console.error(err);
      setErrorMsg(t.errorNetwork);
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#fbf3e7] flex justify-center">
      {/* 限制寬度，模擬手機螢幕 */}
      <div className="w-full max-w-md flex flex-col bg-[#fbf3e7] relative">
        {/* 語言切換 */}
        <div className="absolute top-4 right-4 z-10">
          <div className="inline-flex rounded-full border border-[#d3a65b] bg-[#fffaf2] text-[10px] overflow-hidden">
            <button
              type="button"
              className={`px-3 py-1 ${
                language === "en"
                  ? "bg-[#d3a65b] text-[#3a3023]"
                  : "text-[#8b6a2f]"
              }`}
              onClick={() => setLanguage("en")}
            >
              {t.langToggleLeft}
            </button>
            <button
              type="button"
              className={`px-3 py-1 ${
                language === "zh-Hant"
                  ? "bg-[#d3a65b] text-[#3a3023]"
                  : "text-[#8b6a2f]"
              }`}
              onClick={() => setLanguage("zh-Hant")}
            >
              {t.langToggleRight}
            </button>
          </div>
        </div>

        {/* 頂部頭圖 */}
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

        {/* 表單區域 */}
        <div className="flex-1 px-7 pt-10 pb-12">
          <h1 className="text-[20px] font-semibold text-[#3a3023] mb-1">
            {t.title}
          </h1>
          <p className="text-[12px] text-[#6e5842] mb-7 leading-relaxed">
            {t.subtitle}
          </p>

          <form className="space-y-7" onSubmit={handleSubmit}>
            {/* VIP CARD NUMBER */}
            <div className="space-y-2">
              <label className="block text-[11px] font-semibold tracking-[0.18em] text-[#c79b4a] uppercase">
                {t.vipLabel}
              </label>
              <input
                value={vipNumber}
                onChange={(e) => setVipNumber(e.target.value)}
                placeholder={t.vipPlaceholder}
                className="w-full px-5 py-3.5 rounded-[8px] border border-[#d3a65b] bg-[#fffaf2] text-[16px] text-[#32261c] shadow-sm focus:outline-none focus:ring-2 focus:ring-[#d3a65b] focus:border-transparent"
                required
              />
            </div>

            {/* PREFERRED NAME */}
            <div className="space-y-2">
              <label className="block text-[11px] font-semibold tracking-[0.18em] text-[#c79b4a] uppercase">
                {t.nameLabel}
              </label>
              <input
                value={preferredName}
                onChange={(e) => setPreferredName(e.target.value)}
                placeholder={t.namePlaceholder}
                className="w-full px-5 py-3.5 rounded-[8px] border border-[#d3a65b] bg-[#fffaf2] text-[16px] text-[#32261c] shadow-sm focus:outline-none focus:ring-2 focus:ring-[#d3a65b] focus:border-transparent"
              />
            </div>

            {/* BIRTHDAY (MMDD) */}
            <div className="space-y-2">
              <label className="block text-[11px] font-semibold tracking-[0.18em] text-[#c79b4a] uppercase">
                {t.birthdayLabel}
              </label>
              <input
                value={birthdayMd}
                onChange={(e) => setBirthdayMd(e.target.value)}
                placeholder={t.birthdayPlaceholder}
                className="w-full px-5 py-3.5 rounded-[8px] border border-[#d3a65b] bg-[#fffaf2] text-[16px] text-[#32261c] shadow-sm focus:outline-none focus:ring-2 focus:ring-[#d3a65b] focus:border-transparent"
                required
              />
              <p className="text-[11px] text-[#a38b6a]">{t.birthdayHint}</p>
            </div>

            {/* 錯誤提示 */}
            {errorMsg && (
              <div className="mt-2 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-[11px] text-red-700">
                {errorMsg}
              </div>
            )}

            {/* Connect 按鈕 */}
            <button
              type="submit"
              disabled={loading || !vipNumber.trim() || !birthdayMd.trim()}
              className="mt-4 w-full py-3.5 rounded-[8px] text-[14px] font-semibold tracking-[0.18em] uppercase disabled:opacity-50 disabled:cursor-not-allowed"
              style={{
                background:
                  "linear-gradient(91deg, #F3DBAB 3.63%, #D6BB87 100%)",
                color: "#3a3023",
              }}
            >
              {loading ? t.buttonLoading : t.buttonIdle}
            </button>

            {/* 調試：顯示當前模式（之後可以隱藏） */}
            <p className="mt-4 text-[10px] text-[#9a856a]">
              {t.modeLabel}： version=<span className="font-mono">{version}</span>,{" "}
              entryMode=<span className="font-mono">{entryMode}</span>,{" "}
              scanChannel=<span className="font-mono">{scanChannel}</span>
            </p>
          </form>
        </div>
      </div>
    </div>
  );
}
