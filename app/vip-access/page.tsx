// ⚠️ LEGACY FLOW: VIP 自助驗證入口（輸入 VIP 卡號 + 生日）
// 現在需求已改為「每位 VIP 對應一個永久專屬二維碼」，
// 未來會用新的 /vip-entry H5 頁面取代這個表單。
// 目前暫時保留，以免影響已有測試鏈路，但新功能不要再往這裡加。


"use client";

import { useState, useEffect, FormEvent, useMemo } from "react";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import vipLogin from "@/assets/vip-login1.png";

// 10 分鐘復用窗口
const REUSE_WINDOW_MS = 10 * 60 * 1000;

type VersionType = "hybrid" | "h5";
type EntryMode = "wecom" | "h5";
type ScanChannel = "wechat" | "browser";
type Language = "en" | "zh-Hant";

interface SubmitResponse {
  ok: boolean;
  pendingId?: string;
  error?: string;
  // 後端現在還會返回 matchHint（生日是否匹配的提示），這裡先不在 UI 顯示
  matchHint?: string;
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
  channelIdentifier?: string;
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
  const [channelIdentifier, setChannelIdentifier] = useState<string | null>(null);

  // ✅ 從 URL 讀 version / mode，預設 hybrid
  // 優先用 ?version=，沒有就用 ?mode=
  const version: VersionType = useMemo(() => {
    const v = searchParams.get("version") || searchParams.get("mode");
    if (v === "h5") return "h5";
    return "hybrid";
  }, [searchParams]);

  const t = TEXTS[language];

  // 入口模式識別：WeChat / 瀏覽器 + version
  useEffect(() => {
    if (typeof navigator === "undefined") return;
    const ua = navigator.userAgent || "";
    const isWeChat = /MicroMessenger/i.test(ua);

    // 只要是在微信裡打開，就標記 scanChannel = "wechat"
    setScanChannel(isWeChat ? "wechat" : "browser");

    // version = "hybrid" + 微信 → 走企業微信客服（wecom）
    // 其他情況 → 走 H5
    if (version === "hybrid" && isWeChat) {
      setEntryMode("wecom");
    } else {
      setEntryMode("h5");
    }
  }, [version]);

  // 頁面載入時：
  // 1) 先看本地是否有上一個 H5 會話的 sessionId，有就直接進入 /vip-chat
  // 2) 沒有的話，再走原來 10 分鐘內 pending → /vip-pending 的邏輯
  useEffect(() => {
    if (typeof window === "undefined") return;

    try {
      // ⭐ 方案一：前端記住最近一次的 H5 會話
      const lastSessionId = window.localStorage.getItem("vip_last_session_id");
      if (lastSessionId) {
        router.replace(
          `/vip-chat?sessionId=${encodeURIComponent(lastSessionId)}`
        );
        return;
      }

      // 保留原來的 pending 邏輯
      const raw = window.localStorage.getItem("vip_access_last_pending");
      if (!raw) return;

      const saved = JSON.parse(raw) as SavedPendingState;
      if (!saved?.pendingId || !saved.ts) return;

      const now = Date.now();
      if (now - saved.ts > REUSE_WINDOW_MS) {
        window.localStorage.removeItem("vip_access_last_pending");
        return;
      }

      router.replace(
        `/vip-pending?pendingId=${encodeURIComponent(saved.pendingId)}`
      );
    } catch (e) {
      console.error("Failed to auto-redirect from saved state", e);
    }
  }, [router]);

  // 初始化 H5 / Web 渠道的唯一 ID（browserId）
  // 同一個瀏覽器只生成一次，存在 localStorage
  useEffect(() => {
    if (typeof window === "undefined") return;

    const KEY = "vip_browser_id";

    try {
      let id = window.localStorage.getItem(KEY);
      if (!id) {
        if (window.crypto?.randomUUID) {
          id = window.crypto.randomUUID();
        } else {
          id = `b_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
        }
        window.localStorage.setItem(KEY, id);
      }
      setChannelIdentifier(id);
    } catch (e) {
      console.error("Failed to init browserId / channelIdentifier", e);
    }
  }, []);

  // 和後端一樣的 birthday 標準化：輸入 3/23、0323 等都整理成 "MMDD"
  function normalizeBirthdayMd(input: string): string | null {
    if (!input) return null;
    const digits = input.replace(/\D/g, "");
    if (!digits) return null;
    if (digits.length >= 4) return digits.slice(-4);
    if (digits.length === 3) return digits.padStart(4, "0");
    // 其它奇怪長度就原樣丟給後端
    return digits;
  }

  // ✅ 配合新的 /api/vip/submit 錯誤碼
  function translateError(error?: string): string {
    if (!error) return t.genericError;

    switch (error) {
      case "MISSING_VIP_NUMBER":
        return t.errorMissingFields;
      case "VIP_NOT_FOUND":
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

    // 前端仍然要求 VIP + 生日都填寫
    if (!vipNumber.trim() || !birthdayMd.trim()) {
      setErrorMsg(t.errorMissingFields);
      return;
    }

    setLoading(true);
    try {
      const normalized = normalizeBirthdayMd(birthdayMd);

      const body = {
        vipNumber: vipNumber.trim(),
        preferredName: preferredName.trim() || undefined,
        birthdayMd: normalized ?? birthdayMd.trim(),
        version,
        entryMode,
        scanChannel,
        channelIdentifier: channelIdentifier ?? undefined,
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
            channelIdentifier: channelIdentifier ?? undefined,
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
              {t.modeLabel}： version=
              <span className="font-mono">{version}</span>, entryMode=
              <span className="font-mono">{entryMode}</span>, scanChannel=
              <span className="font-mono">{scanChannel}</span>
            </p>
          </form>
        </div>
      </div>
    </div>
  );
}
