"use client";

import { useEffect, useRef, useState, FormEvent, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { ArrowLeft, Send } from "lucide-react";

interface ChatMessage {
  id: string;
  from: "vip" | "concierge" | "system";
  text: string;
  createdAt: number;
}

const CONCIERGE_NAME = "Joye Duan";

// 敏感詞列表
const SENSITIVE_WORDS = ["赌博", "下注"];

// 30 秒未回覆自動回覆
const AUTO_REPLY_TIMEOUT_MS = 30_000;

function formatTime(ts: number) {
  const d = new Date(ts);
  return d.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatDate(ts: number) {
  const d = new Date(ts);
  return d.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export default function VipChatPage() {
  const searchParams = useSearchParams();
  const sessionId = searchParams.get("sessionId");

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [showSensitiveWarning, setShowSensitiveWarning] = useState(false);

  const listRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const warningTimerRef = useRef<any>(null);

  // ⭐ 30 秒自動回覆相關：記錄最近一條 VIP 消息時間 & 定時器
  const autoReplyTimerRef = useRef<any>(null);
  const lastVipMessageAtRef = useRef<number | null>(null);
  const messagesRef = useRef<ChatMessage[]>([]);

  // ⭐ 進入 vip-chat 時，把本次會話的 sessionId 記到 localStorage
  useEffect(() => {
    if (!sessionId || typeof window === "undefined") return;
    try {
      window.localStorage.setItem("vip_last_session_id", sessionId);
    } catch (e) {
      console.error("Failed to save vip_last_session_id:", e);
    }
  }, [sessionId]);

  // 從 H5 接口拉消息 + 輪詢
  useEffect(() => {
    if (!sessionId) return;

    let stopped = false;

    const fetchMessages = async () => {
      try {
        const resp = await fetch(
          `/api/h5/sessions/${encodeURIComponent(
            sessionId
          )}/messages?take=100`
        );
        const data = await resp.json();

        if (!data?.ok || !Array.isArray(data.messages) || stopped) return;

        const normalized: ChatMessage[] = data.messages.map((m: any) => ({
          id: m.id,
          from: m.direction === "out" ? "concierge" : "vip",
          text: m.text || "",
          createdAt:
            typeof m.timestamp === "number"
              ? m.timestamp
              : new Date(m.timestamp || Date.now()).getTime(),
        }));

        setMessages(normalized);
      } catch (e) {
        console.error("load h5 chat messages failed:", e);
      }
    };

    fetchMessages();
    const timer = setInterval(fetchMessages, 4000);

    return () => {
      stopped = true;
      clearInterval(timer);
    };
  }, [sessionId]);

  // 滾動到底部
  useEffect(() => {
    if (!listRef.current) return;
    listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [messages]);

  // 同步最新 messages 到 ref，並在禮賓已回覆時清掉 30 秒自動回覆定時器
  useEffect(() => {
    messagesRef.current = messages;

    if (!autoReplyTimerRef.current || !lastVipMessageAtRef.current) return;

    const lastVipAt = lastVipMessageAtRef.current;
    const hasConciergeReply = messages.some(
      (m) => m.from === "concierge" && m.createdAt > lastVipAt
    );

    if (hasConciergeReply) {
      clearTimeout(autoReplyTimerRef.current);
      autoReplyTimerRef.current = null;
      lastVipMessageAtRef.current = null;
    }
  }, [messages]);

  // 卸載時清理所有定時器
  useEffect(() => {
    return () => {
      if (warningTimerRef.current) {
        clearTimeout(warningTimerRef.current);
      }
      if (autoReplyTimerRef.current) {
        clearTimeout(autoReplyTimerRef.current);
      }
    };
  }, []);

  // 根據關鍵詞決定要不要立刻自動回覆
  const getKeywordAutoReplyText = (text: string): string | null => {
    const trimmed = text.trim();
    if (!trimmed) return null;

    // b) 包含「急需」
    if (trimmed.includes("急需")) {
      return "收到，您的需求已加急处理！";
    }

    // a) 包含「送」「给」「帮」「幫」
    const arrangeKeywords = ["送", "给", "帮", "幫", "我想", "需要"];
    if (arrangeKeywords.some((k) => trimmed.includes(k))) {
      return "好的，马上为您安排，请您稍等！";
    }

    return null;
  };

  // 統一發一條「禮賓端」自動回覆
  const sendAutoReply = async (text: string) => {
    if (!sessionId) return;
    try {
      await fetch(
        `/api/h5/sessions/${encodeURIComponent(sessionId)}/messages`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text, from: "agent" }),
        }
      );
    } catch (err) {
      console.error("auto reply failed:", err);
    }
  };

  // 啟動 30 秒未回覆自動回覆定時器
  const scheduleTimeoutAutoReply = () => {
    if (!sessionId) return;

    const now = Date.now();
    lastVipMessageAtRef.current = now;

    if (autoReplyTimerRef.current) {
      clearTimeout(autoReplyTimerRef.current);
    }

    autoReplyTimerRef.current = setTimeout(() => {
      const lastVipAt = lastVipMessageAtRef.current;
      if (!lastVipAt) return;

      const msgs = messagesRef.current;
      const hasConciergeReply = msgs.some(
        (m) => m.from === "concierge" && m.createdAt > lastVipAt
      );
      if (hasConciergeReply) {
        return;
      }

      void sendAutoReply(
        "您好，这里是永利皇宫 VIP 礼宾团队，我们已经收到您的信息，将尽快为您安排专人回复。"
      );

      autoReplyTimerRef.current = null;
      lastVipMessageAtRef.current = null;
    }, AUTO_REPLY_TIMEOUT_MS);
  };

  const handleSend = async (e: FormEvent) => {
    e.preventDefault();
    const text = input.trim();
    if (!text || !sessionId) return;

    // 敏感詞檢查
    const hasSensitive = SENSITIVE_WORDS.some((w) => text.includes(w));
    if (hasSensitive) {
      setShowSensitiveWarning(true);

      if (warningTimerRef.current) {
        clearTimeout(warningTimerRef.current);
      }

      warningTimerRef.current = setTimeout(() => {
        setShowSensitiveWarning(false);
        warningTimerRef.current = null;
      }, 3000);

      // 不發送消息，保留輸入框內容讓用戶自行修改
      return;
    }

    setInput("");

    try {
      await fetch(
        `/api/h5/sessions/${encodeURIComponent(
          sessionId
        )}/messages`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text, from: "vip" }),
        }
      );
      // 不做樂觀更新，交給輪詢去同步最新消息

      // ✅ 先按關鍵詞判斷是否需要立即自動回覆
      const keywordReply = getKeywordAutoReplyText(text);
      if (keywordReply) {
        void sendAutoReply(keywordReply);
        // 命中關鍵詞的情況下，就不再啟動 30 秒兜底自動回覆，避免打擾
        return;
      }

      // ✅ 沒有命中關鍵詞 → 啟動 30 秒未回覆自動回覆
      scheduleTimeoutAutoReply();
    } catch (err) {
      console.error("send h5 message failed:", err);
    }
  };

  // 用來在列表中插入日期分隔
  let lastDateLabel: string | null = null;

  if (!sessionId) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="text-sm text-gray-500">
          Missing session. Please go back and start the chat again.
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-white flex">
      {/* 自适应手機寬度，不再寫死 max-w */}
      <div className="w-full flex flex-col bg-white overflow-hidden relative">
        {/* 頂部導航欄（置頂） */}
        <div className="h-14 px-4 flex items-center border-b border-[#f0ece6] flex-shrink-0">
          <button
            type="button"
            className="mr-3 text-[#b8b0a3]"
            onClick={() => {
              if (typeof window !== "undefined") {
                window.history.back();
              }
            }}
          >
            <ArrowLeft className="w-5 h-5" />
          </button>

          {/* avatar */}
          <div className="w-8 h-8 rounded-full bg-[#f5e9d7] flex items-center justify-center text-sm font-medium text-[#8c6b3c] mr-2">
            J
          </div>

          <div className="flex flex-col">
            <span className="text-[15px] font-semibold text-[#2f261c]">
              {CONCIERGE_NAME}
            </span>
            <span className="text-[11px] text-[#b8b0a3]">
              VIP Concierge · Online
            </span>
          </div>
        </div>

        {/* 敏感詞提示 toast */}
        {showSensitiveWarning && (
          <div className="absolute left-0 right-0 bottom-20 flex justify-center z-20 pointer-events-none">
            <div className="inline-block max-w-[80%] px-4 py-2 rounded-full bg-[#3a3023] text-[12px] text-[#f9f8f6] shadow-md text-center">
              您输入的内容包含敏感词汇无法发送。
            </div>
          </div>
        )}

        {/* 消息列表（中間區域滾動） */}
        <div
          ref={listRef}
          className="flex-1 overflow-y-auto px-4 py-4 space-y-4 bg-white"
        >
          {messages.map((m) => {
            const isSelf = m.from === "vip";
            const dateLabel = formatDate(m.createdAt);
            const showDate =
              !lastDateLabel || lastDateLabel !== dateLabel || undefined;
            lastDateLabel = dateLabel;

            return (
              <div key={m.id}>
                {showDate && (
                  <div className="flex justify-center mb-3">
                    <span className="px-3 py-1 rounded-full bg-[#f9f8f6] text-[11px] text-[#b8b0a3]">
                      {dateLabel}
                    </span>
                  </div>
                )}

                <div
                  className={`flex ${
                    isSelf ? "justify-end" : "justify-start"
                  } mb-1`}
                >
                  <div className="max-w-[80%]">
                    {/* 時間 */}
                    <div
                      className={`mb-1 text-[11px] text-[#b8b0a3] ${
                        isSelf ? "text-right" : "text-left"
                      }`}
                    >
                      {formatTime(m.createdAt)}
                    </div>

                    {/* 氣泡 */}
                    <div
                      className={`rounded-3xl px-4 py-3 text-[15px] leading-relaxed ${
                        isSelf
                          ? "bg-[#F5E0B6] text-[#3a3023]"
                          : "bg-[#F9F8F6] text-[#3a3023]"
                      }`}
                    >
                      {m.text}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* 輸入區（置底） */}
        <form
          onSubmit={handleSend}
          className="border-t border-[#f0ece6] px-3 py-2 flex items-center gap-2 bg-white flex-shrink-0"
        >
          <div className="flex-1">
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Type a message"
              className="w-full px-4 py-3 rounded-2xl bg-[#F9F8F6] text-[16px] text-[#3a3023] focus:outline-none focus:ring-2 focus:ring-[#F5E0B6] focus:border-transparent"
            />
          </div>
          <button
            type="submit"
            disabled={!input.trim()}
            className="w-11 h-11 rounded-2xl flex items-center justify-center disabled:opacity-40 disabled:cursor-not-allowed"
            style={{ backgroundColor: "#F5E0B6" }}
          >
            <Send className="w-4 h-4 text-[#3a3023]" />
          </button>
        </form>
      </div>
    </div>
  );
}
