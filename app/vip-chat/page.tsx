"use client";

import { useEffect, useMemo, useRef, useState, FormEvent } from "react";
import { useSearchParams } from "next/navigation";
import { ArrowLeft, Send } from "lucide-react";

interface ChatMessage {
  id: string;
  from: "vip" | "concierge" | "system";
  text: string;
  createdAt: number;
}

const CONCIERGE_NAME = "Joye Duan";

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

  const pendingId = searchParams.get("pendingId");
  const sessionId = searchParams.get("sessionId");

  // 用 pendingId 或 sessionId 做本地聊天 key
  const chatKey = useMemo(() => {
    if (pendingId) return `vip_chat_${pendingId}`;
    if (sessionId) return `vip_chat_${sessionId}`;
    return "vip_chat_demo";
  }, [pendingId, sessionId]);

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isHydrated, setIsHydrated] = useState(false);

  const listRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  // 初始化：從 localStorage 還原消息，沒有的話塞一條歡迎語
  useEffect(() => {
    if (typeof window === "undefined") return;

    try {
      const raw = window.localStorage.getItem(chatKey);
      if (raw) {
        const parsed = JSON.parse(raw) as ChatMessage[];
        if (Array.isArray(parsed) && parsed.length > 0) {
          setMessages(parsed);
          setIsHydrated(true);
          return;
        }
      }

      const now = Date.now();
      const initial: ChatMessage[] = [
        {
          id: "init-welcome",
          from: "concierge",
          text: "Hello, this is your Wynn Palace VIP concierge. How may I assist you today?",
          createdAt: now,
        },
      ];
      setMessages(initial);
      setIsHydrated(true);
    } catch (e) {
      console.error("Failed to restore vip chat messages", e);
      setIsHydrated(true);
    }
  }, [chatKey]);

  // 每次消息變動時保存到 localStorage
  useEffect(() => {
    if (!isHydrated) return;
    if (typeof window === "undefined") return;

    try {
      window.localStorage.setItem(chatKey, JSON.stringify(messages));
    } catch (e) {
      console.error("Failed to persist vip chat messages", e);
    }
  }, [messages, chatKey, isHydrated]);

  // 滾動到底部
  useEffect(() => {
    if (!listRef.current) return;
    listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [messages]);

  const handleSend = (e: FormEvent) => {
    e.preventDefault();
    const text = input.trim();
    if (!text) return;

    const now = Date.now();
    const msg: ChatMessage = {
      id: `vip-${now}`,
      from: "vip",
      text,
      createdAt: now,
    };

    setMessages((prev) => [...prev, msg]);
    setInput("");
  };

  // 用來在列表中插入日期分隔
  let lastDateLabel: string | null = null;

  return (
    <div className="min-h-screen bg-white flex justify-center">
      {/* 模擬手機寬度 */}
      <div className="w-full max-w-md flex flex-col bg-white">
        {/* 頂部導航欄 */}
        <div className="h-14 px-4 flex items-center border-b border-[#f0ece6]">
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

        {/* 消息列表 */}
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

        {/* 輸入區：iOS / Android 點擊輸入框會自動喚起系統鍵盤（瀏覽器默認行為） */}
        <form
          onSubmit={handleSend}
          className="border-t border-[#f0ece6] px-3 py-2 flex items-center gap-2 bg-white"
        >
          <div className="flex-1">
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Type a message"
              className="w-full px-4 py-3 rounded-2xl bg-[#F9F8F6] text-[15px] text-[#3a3023] focus:outline-none focus:ring-2 focus:ring-[#F5E0B6] focus:border-transparent"
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
