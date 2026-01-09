"use client";

import { useEffect, useMemo, useRef, useState, FormEvent } from "react";
import { useSearchParams } from "next/navigation";
import { ArrowLeft, Send } from "lucide-react";

interface ChatMessage {
  id: string;
  from: "vip" | "concierge";
  text: string;
  createdAt: number;
}

interface ServerMessage {
  id: string;
  conversationId: string;
  direction: "in" | "out";
  text: string;
  timeLabel?: string;
  timestamp: number;
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

  // 目前真正用的是 sessionId，pendingId 只是保留作備用
  const chatKey = useMemo(() => {
    if (pendingId) return `vip_chat_${pendingId}`;
    if (sessionId) return `vip_chat_${sessionId}`;
    return "vip_chat_demo";
  }, [pendingId, sessionId]);

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const listRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  // 從後端拉取這個 session 的真實聊天記錄
  useEffect(() => {
    if (!sessionId) {
      setError("Missing session id.");
      setLoading(false);
      return;
    }

    let cancelled = false;

    const fetchMessages = async () => {
      try {
        const resp = await fetch(
          `/api/h5/sessions/${encodeURIComponent(
            sessionId
          )}/messages?take=50`
        );
        const data = await resp.json();

        if (cancelled) return;

        if (!data?.ok) {
          console.error("load vip-chat messages failed:", data?.error);
          setError("Failed to load chat history.");
          setLoading(false);
          return;
        }

        const list: ServerMessage[] = Array.isArray(data.messages)
          ? data.messages
          : [];

        const mapped: ChatMessage[] = list.map((m) => ({
          id: m.id,
          from: m.direction === "out" ? "concierge" : "vip",
          text: m.text || "",
          createdAt: m.timestamp,
        }));

        setMessages(mapped);
        setLoading(false);
      } catch (e) {
        if (cancelled) return;
        console.error("Error fetching vip-chat messages:", e);
        setError("Network error. Please try again.");
        setLoading(false);
      }
    };

    fetchMessages();

    return () => {
      cancelled = true;
    };
  }, [sessionId]);

  // 滾動到底部
  useEffect(() => {
    if (!listRef.current) return;
    listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [messages]);

  const handleSend = async (e: FormEvent) => {
    e.preventDefault();
    const text = input.trim();
    if (!text) return;
    if (!sessionId) return;

    setInput("");

    const now = Date.now();

    try {
      const resp = await fetch(
        `/api/h5/sessions/${encodeURIComponent(sessionId)}/messages`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text, from: "vip" }),
        }
      );
      const data = await resp.json();

      if (data?.ok && data.message) {
        const m = data.message as ServerMessage;
        const msg: ChatMessage = {
          id: m.id,
          from: m.direction === "out" ? "concierge" : "vip",
          text: m.text || text,
          createdAt: m.timestamp ?? now,
        };
        setMessages((prev) => [...prev, msg]);
      } else {
        // 後端失敗時，至少本地先顯示一條（PoC）
        const msg: ChatMessage = {
          id: `vip-${now}`,
          from: "vip",
          text,
          createdAt: now,
        };
        setMessages((prev) => [...prev, msg]);
      }
    } catch (err) {
      console.error("send vip-chat message failed:", err);
      const msg: ChatMessage = {
        id: `vip-${now}`,
        from: "vip",
        text,
        createdAt: now,
      };
      setMessages((prev) => [...prev, msg]);
    }
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
          {loading && (
            <div className="flex justify-center py-4 text-[13px] text-[#b8b0a3]">
              Connecting to your concierge...
            </div>
          )}

          {error && !loading && (
            <div className="flex justify-center py-4 text-[13px] text-red-500">
              {error}
            </div>
          )}

          {!loading &&
            !error &&
            messages.map((m) => {
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

        {/* 輸入區 */}
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
            disabled={!input.trim() || !sessionId}
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
