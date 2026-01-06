"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import type { H5ChatMessage } from "@/lib/chatwoot";

type Phase = "loading" | "chat" | "error";

interface PendingStatusResponse {
  ok: boolean;
  status: "PENDING" | "APPROVED" | "REJECTED";
  vipNumber: string;
  preferredName: string | null;
  reason: string | null;
  contactIdentifier: string | null;
  conversationId: number | null;
  mode?: string | null;
}

export default function VipChatPage() {
  const searchParams = useSearchParams();

  const pendingId = searchParams.get("pendingId");
  const urlContact = searchParams.get("contact");
  const urlConversationId = searchParams.get("conversationId");
  const urlMode = searchParams.get("mode") ?? "h5";

  const [phase, setPhase] = useState<Phase>("loading");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [vipName, setVipName] = useState<string>("VIP Guest");
  const [contactIdentifier, setContactIdentifier] = useState<string | null>(
    urlContact
  );
  const [conversationId, setConversationId] = useState<number | null>(
    urlConversationId ? Number(urlConversationId) : null
  );
  const [mode] = useState<string>(urlMode);

  const [messages, setMessages] = useState<H5ChatMessage[]>([]);
  const [sending, setSending] = useState(false);
  const [input, setInput] = useState("");

  const bottomRef = useRef<HTMLDivElement | null>(null);

  // ---- Step 1: 校验 pendingId + 拿到 contact / conversationId ----
  useEffect(() => {
    if (!pendingId) {
      setPhase("error");
      setErrorMsg("缺少会话参数，请返回上一页重新进入。");
      return;
    }

    let cancelled = false;

    async function init() {
      try {
        const res = await fetch(`/api/vip/pending/${pendingId}`);
        const data = (await res.json()) as PendingStatusResponse;

        if (!data.ok) {
          if (!cancelled) {
            setPhase("error");
            setErrorMsg("无法获取会话信息，请返回入口页面重新验证。");
          }
          return;
        }

        if (data.status !== "APPROVED") {
          if (!cancelled) {
            setPhase("error");
            setErrorMsg("您的身份尚未完成确认，请返回入口页面重新扫码。");
          }
          return;
        }

        const contact = urlContact || data.contactIdentifier || null;
        const convId =
          urlConversationId != null
            ? Number(urlConversationId)
            : data.conversationId ?? null;

        if (!contact || !convId || !Number.isFinite(convId)) {
          if (!cancelled) {
            setPhase("error");
            setErrorMsg("会话尚未正确建立，请稍后重新尝试。");
          }
          return;
        }

        if (cancelled) return;

        setVipName(data.preferredName || data.vipNumber || "VIP Guest");
        setContactIdentifier(contact);
        setConversationId(convId);
        setPhase("chat");
      } catch (err) {
        console.error("Error init vip-chat:", err);
        if (!cancelled) {
          setPhase("error");
          setErrorMsg("网络异常，请稍后重试。");
        }
      }
    }

    init();

    return () => {
      cancelled = true;
    };
  }, [pendingId, urlContact, urlConversationId]);

  // ---- Step 2: 拉取 & 轮询消息 ----
  useEffect(() => {
    if (phase !== "chat") return;
    if (!contactIdentifier || conversationId == null) return;

    let cancelled = false;
    let timer: ReturnType<typeof setInterval> | undefined;

    const load = async () => {
      try {
        const params = new URLSearchParams();
        params.set("contact", contactIdentifier);
        params.set("conversationId", String(conversationId));

        const res = await fetch(`/api/h5/messages?${params.toString()}`);
        const data = (await res.json()) as {
          ok: boolean;
          messages?: H5ChatMessage[];
        };

        if (!data.ok) {
          console.error("get messages failed", data);
          return;
        }

        if (!cancelled && data.messages) {
          setMessages(data.messages);
        }
      } catch (err) {
        console.error("Error loading messages:", err);
      }
    };

    const start = async () => {
      await load();
      if (!cancelled) {
        timer = setInterval(load, 3000);
      }
    };

    start();

    return () => {
      cancelled = true;
      if (timer) clearInterval(timer);
    };
  }, [phase, contactIdentifier, conversationId]);

  // ---- Step 3: 自动滚动到底部 ----
  useEffect(() => {
    if (bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages.length]);

  // ---- 发送消息 ----
  const handleSend = async () => {
    const text = input.trim();
    if (!text || sending) return;
    if (!contactIdentifier || conversationId == null) return;

    setSending(true);

    try {
      const res = await fetch("/api/h5/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contact: contactIdentifier,
          conversationId,
          content: text,
        }),
      });

      const data = (await res.json()) as {
        ok: boolean;
        message?: H5ChatMessage;
      };

      if (!data.ok) {
        console.error("send failed", data);
      } else if (data.message) {
        // 乐观更新；轮询会再覆盖一次
        setMessages((prev) => [...prev, data.message!]);
        setInput("");
      }
    } catch (err) {
      console.error("Error send message:", err);
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // ---- UI ----
  return (
    <div className="min-h-screen bg-[#fbf3e7] flex justify-center">
      {/* 限制宽度，模拟手机屏幕；PC 端居中显示 */}
      <div className="w-full max-w-md flex flex-col bg-[#fbf3e7]">
        {/* 顶部栏 */}
        <header className="px-5 pt-4 pb-3 border-b border-[#e3cda4] bg-[#fbf3e7]/90 backdrop-blur flex flex-col gap-1">
          <div className="flex items-center justify-between">
            <div className="flex flex-col">
              <span className="text-[11px] tracking-[0.22em] text-[#c79b4a] uppercase">
                Wynn Palace · VIP Service
              </span>
              <span className="mt-1 text-[18px] font-semibold text-[#3a3023]">
                {vipName}
              </span>
            </div>
            <div className="text-right">
              <span className="text-[10px] tracking-[0.18em] uppercase text-[#b89a65]">
                {mode === "h5" ? "H5 CHAT" : "VIP CHAT"}
              </span>
              <div className="mt-1 h-[6px] w-[6px] rounded-full bg-[#45b26b] inline-block mr-1" />
              <span className="text-[11px] text-[#7b6a4e]">
                Online concierge
              </span>
            </div>
          </div>
          <p className="mt-2 text-[11px] text-[#7b6a4e]">
            您好，{vipName}。您现在已连接永利皇宫礼宾团队，我们随时为您服务。
          </p>
        </header>

        {/* 内容区域：消息列表 + 输入框 */}
        <main className="flex-1 flex flex-col px-4">
          {phase === "loading" && (
            <div className="flex-1 flex items-center justify-center text-[13px] text-[#7b6a4e]">
              正在为您建立安全会话…
            </div>
          )}

          {phase === "error" && (
            <div className="flex-1 flex flex-col items-center justify-center gap-3 text-center px-6">
              <div className="text-[13px] text-[#7b6a4e] leading-relaxed">
                {errorMsg || "当前会话不可用，请返回 VIP 入口页面重新开始。"}
              </div>
              <button
                type="button"
                onClick={() => {
                  if (typeof window !== "undefined") {
                    window.location.href = "/vip-access?mode=h5";
                  }
                }}
                className="mt-2 px-4 py-2 rounded-[8px] text-[13px] font-semibold tracking-[0.16em] uppercase"
                style={{
                  background:
                    "linear-gradient(91deg, #F3DBAB 3.63%, #D6BB87 100%)",
                  color: "#3a3023",
                }}
              >
                返回入口
              </button>
            </div>
          )}

          {phase === "chat" && (
            <>
              {/* 消息列表 */}
              <div className="flex-1 overflow-y-auto py-4 space-y-3">
                {messages.length === 0 && (
                  <div className="text-center text-[12px] text-[#9b8b71] mt-4">
                    您可以直接在下方输入讯息与礼宾团队对话。
                  </div>
                )}

                {messages.map((msg) => {
                  const isVip = msg.from === "vip";

                  return (
                    <div
                      key={msg.id}
                      className={`flex ${
                        isVip ? "justify-end" : "justify-start"
                      }`}
                    >
                      <div
                        className={[
                          "max-w-[80%] rounded-2xl px-3.5 py-2.5 text-[14px] leading-relaxed",
                          isVip
                            ? "bg-gradient-to-r from-[#f3dbab] to-[#d6bb87] text-[#3a3023] rounded-br-none shadow-sm"
                            : "bg-white text-[#3a3023] border border-[#ead8b7] rounded-bl-none",
                        ].join(" ")}
                      >
                        {msg.content}
                      </div>
                    </div>
                  );
                })}

                <div ref={bottomRef} />
              </div>

              {/* 输入框 */}
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleSend();
                }}
                className="border-t border-[#e3cda4] bg-[#fbf3e7] -mx-4 px-4 pb-4 pt-2"
              >
                <div className="flex items-end gap-2">
                  <textarea
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    rows={1}
                    className="flex-1 resize-none rounded-[10px] bg-white border border-[#e3cda4] px-3 py-2 text-[14px] text-[#3a3023] placeholder:text-[#b5a58b] focus:outline-none focus:ring-2 focus:ring-[#d3b672] focus:border-transparent"
                    placeholder="输入讯息…"
                  />
                  <button
                    type="submit"
                    disabled={
                      !input.trim() ||
                      sending ||
                      !contactIdentifier ||
                      !conversationId
                    }
                    className="rounded-full px-4 py-2 text-[13px] font-semibold tracking-[0.16em] uppercase disabled:opacity-40 disabled:cursor-not-allowed"
                    style={{
                      background:
                        "linear-gradient(91deg, #F3DBAB 3.63%, #D6BB87 100%)",
                      color: "#3a3023",
                    }}
                  >
                    {sending ? "Sending..." : "Send"}
                  </button>
                </div>
              </form>
            </>
          )}
        </main>
      </div>
    </div>
  );
}
