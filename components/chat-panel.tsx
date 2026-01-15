"use client";

import { useState, useRef, useEffect } from "react";
import { Conversation, Message } from "@/types";
import { Phone, Smile, Paperclip, Mic, Send, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/contexts/language-context";

interface ChatPanelProps {
  conversation: Conversation | null;
  messages: Message[];
  onSendMessage: (text: string) => void;
}

export function ChatPanel({
  conversation,
  messages,
  onSendMessage,
}: ChatPanelProps) {
  const [messageText, setMessageText] = useState("");
  const [status, setStatus] = useState<"open" | "resolved">("open");
  const [showStatusMenu, setShowStatusMenu] = useState(false);
  const statusText = status === "open" ? "打开" : "已解决";
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { t } = useLanguage();

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = () => {
    if (messageText.trim()) {
      onSendMessage(messageText.trim());
      setMessageText("");
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  if (!conversation) {
    return (
      <div
        className="flex-1 flex items-center justify-center bg-white"
        style={{ color: "var(--text-secondary)" }}
      >
        Select a conversation to start messaging
      </div>
    );
  }

  // ✅ 统一显示名字：优先用 vipGuest.preferredName，其次 vipGuest.fullName，最后才用原来的 displayName
  const vipPreferredName =
    (conversation as any).vipPreferredName ??
    (conversation as any).vipGuest?.preferredName ??
    null;
  const vipFullName =
    (conversation as any).vipFullName ??
    (conversation as any).vipGuest?.fullName ??
    null;

  const displayName =
    (vipPreferredName && String(vipPreferredName).trim()) ||
    (vipFullName && String(vipFullName).trim()) ||
    conversation.displayName;

  const initials = displayName
    .split(" ")
    .filter(Boolean)
    .map((part: string) => part[0] ?? "")
    .join("")
    .toUpperCase()
    .slice(0, 2);

  const channel = conversation.channel;
  const sortedMessages = [...messages].sort(
    (a, b) => (a.timestamp || 0) - (b.timestamp || 0)
  );

  return (
    <div className="flex-1 flex flex-col bg-white">
      {/* 顶部：头像 + 名字 + 电话按钮 */}
      <div
        className="px-6 py-4 flex items-center justify-between"
        style={{ borderBottom: "1px solid var(--divider)" }}
      >
        <div className="flex items-center space-x-3">
          <div
            className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-medium"
            style={{
              backgroundColor: "var(--avatar-bg)",
              color: "var(--accent)",
            }}
          >
            {initials}
          </div>
          <div>
            <h2
              className="font-medium"
              style={{ color: "var(--text-primary)" }}
            >
              {displayName}
            </h2>
          </div>
        </div>

        {/* 右側：狀態下拉 + 電話按鈕 */}
        <div className="flex items-center space-x-3 relative">
          {/* 狀態按鈕 + 下拉菜單 */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowStatusMenu((v) => !v)}
              className="px-4 py-2 rounded-full border text-sm flex items-center gap-1 hover:bg-[#f7f5f2]"
              style={{
                borderColor: "var(--divider)",
                color: "var(--text-primary)",
                backgroundColor: "#ffffff",
              }}
            >
              <span>{statusText}</span>
              <ChevronDown className="w-4 h-4" />
            </button>

            {showStatusMenu && (
              <div className="absolute right-0 mt-2 w-24 bg-white rounded-xl shadow-lg border text-sm py-1 z-10">
                <button
                  type="button"
                  onClick={() => {
                    setStatus("open");
                    setShowStatusMenu(false);
                  }}
                  className="w-full px-3 py-1.5 text-left hover:bg-[#f7f5f2]"
                >
                  打开
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setStatus("resolved");
                    setShowStatusMenu(false);
                  }}
                  className="w-full px-3 py-1.5 text-left hover:bg-[#f7f5f2]"
                >
                  已解决
                </button>
              </div>
            )}
          </div>

          {/* 電話按鈕（原樣保留，只是向右挪一點） */}
          <button className="p-2 rounded-full transition-colors hover:bg-gray-100">
            <Phone
              className="w-5 h-5"
              style={{ color: "var(--text-primary)" }}
            />
          </button>
        </div>
      </div>

      {/* 中间内容：根据 channel 切换 UI */}
      <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
        {sortedMessages.map((message, index) => {
          // 1) Email：一封封邮件样式 + 虚线分割
          if (channel === "email") {
            return (
              <EmailMessageItem
                key={message.id}
                message={message}
                index={index}
              />
            );
          }

          // 2) Phone：通话记录 + 可选 Summary（只有有 text 才显示）
          if (channel === "phone") {
            return <PhoneCallItem key={message.id} message={message} />;
          }

          // 3) 默认：原来的气泡聊天
          const prev = sortedMessages[index - 1];
          const showDateLabel =
            message.dateLabel &&
            (index === 0 || prev?.dateLabel !== message.dateLabel);

          return (
            <div key={message.id}>
              {showDateLabel && (
                <div className="flex items-center justify-center my-4">
                  <span
                    className="px-3 py-1 text-xs rounded-full"
                    style={{
                      backgroundColor: "var(--bg)",
                      color: "var(--text-secondary)",
                    }}
                  >
                    {message.dateLabel}
                  </span>
                </div>
              )}
              <MessageBubble message={message} />
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      {/* 底部输入框：保持你原来的样式 & 逻辑 */}
      <div
        className="px-6 py-4"
        style={{ borderTop: "1px solid var(--divider)" }}
      >
        <div className="flex items-center gap-3">
          {/* 左侧：输入框 + 表情 + 附件，都在同一个大框里 */}
          <div
            className="flex-1 flex items-center rounded-xl shadow-sm"
            style={{
              backgroundColor: "var(--bg)",
              border: "1px solid var(--divider)",
            }}
          >
            <textarea
              value={messageText}
              onChange={(e) => setMessageText(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder={t("composer.placeholder")}
              rows={1}
              className="flex-1 px-4 py-3 bg-transparent resize-none focus:outline-none text-sm"
              style={{ color: "var(--text-primary)" }}
            />

            {/* 右侧图标区：在大框里面 */}
            <div className="flex items-center gap-1 pr-2">
              <button className="p-2 rounded-full transition-colors hover:bg-gray-100">
                <Smile
                  className="w-5 h-5"
                  style={{ color: "var(--text-secondary)" }}
                />
              </button>

              <button className="p-2 rounded-full transition-colors hover:bg-gray-100">
                <Paperclip
                  className="w-5 h-5"
                  style={{ color: "var(--text-secondary)" }}
                />
              </button>
            </div>
          </div>

          {/* 右侧：发送按钮（在大框外面） */}
          <button
            onClick={handleSend}
            disabled={!messageText.trim()}
            className="p-3 rounded-md transition-colors disabled:opacity-60"
            style={{ backgroundColor: "#F5E0B6" }}
          >
            <Send className="w-5 h-5 text-black" />
          </button>
        </div>

        <p
          className="text-xs text-center mt-2"
          style={{ color: "var(--text-secondary)" }}
        >
          {t("composer.helperText")}
        </p>
      </div>
    </div>
  );
}

/* ---------- 通用小工具 ---------- */

function getTimeLabel(msg: Message) {
  if (msg.timeLabel) return msg.timeLabel;
  if (msg.timestamp) {
    return new Date(msg.timestamp).toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
    });
  }
  return "";
}

function getDateLabel(msg: Message) {
  if (msg.dateLabel) return msg.dateLabel;
  if (msg.timestamp) {
    return new Date(msg.timestamp).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "2-digit",
    });
  }
  return "";
}

/* ---------- 默认气泡聊天 ---------- */

interface MessageBubbleProps {
  message: Message;
}

function MessageBubble({ message }: MessageBubbleProps) {
  const isInbound = message.direction === "in";

  return (
    <div className={cn("flex", isInbound ? "justify-start" : "justify-end")}>
      <div className="max-w-xl">
        <div
          className={cn(
            "px-4 py-2.5 rounded-2xl text-sm",
            isInbound ? "rounded-tl-none shadow-sm" : "rounded-tr-none"
          )}
          style={
            isInbound
              ? {
                  backgroundColor: "#F9F8F6",
                  color: "var(--text-primary)",
                }
              : { backgroundColor: "#F5E0B6", color: "var(--text-primary)" }
          }
        >
          {message.text}
        </div>
        <div
          className={cn(
            "mt-1 text-xs",
            isInbound ? "text-left" : "text-right"
          )}
          style={{ color: "var(--text-secondary)" }}
        >
          {getTimeLabel(message)}
        </div>
      </div>
    </div>
  );
}

/* ---------- Email 渲染 ---------- */

interface EmailMessageItemProps {
  message: Message;
  index: number;
}

function EmailMessageItem({ message, index }: EmailMessageItemProps) {
  const fromLabel =
    message.direction === "in" ? "From VIP" : "From hotel staff";
  const date = getDateLabel(message);
  const time = getTimeLabel(message);

  return (
    <div
      className={cn(
        "pt-4",
        index > 0 ? "mt-4 border-t border-dashed border-[var(--divider)]" : ""
      )}
    >
      <div className="flex items-center justify-between mb-1">
        <div
          className="text-xs font-medium"
          style={{ color: "var(--text-secondary)" }}
        >
          {fromLabel}
        </div>
        <div className="text-xs" style={{ color: "var(--text-secondary)" }}>
          {date} · {time}
        </div>
      </div>
      <div
        className="mt-1 text-sm leading-relaxed whitespace-pre-wrap"
        style={{ color: "var(--text-primary)" }}
      >
        {message.text}
      </div>
    </div>
  );
}

/* ---------- Phone 通话记录 + 可选 Summary ---------- */

interface PhoneCallItemProps {
  message: Message;
}

function PhoneCallItem({ message }: PhoneCallItemProps) {
  const isInbound = message.direction === "in";
  const date = getDateLabel(message);
  const time = getTimeLabel(message);

  return (
    <div className="border border-[var(--divider)] rounded-lg bg-[#FDFBF7] px-4 py-3 space-y-2 shadow-sm">
      {/* 通话记录行 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-black/5">
            <Phone
              className="w-3 h-3"
              style={{ color: "var(--text-primary)" }}
            />
          </span>
          <span
            className="text-sm font-medium"
            style={{ color: "var(--text-primary)" }}
          >
            {isInbound ? "Incoming call" : "Outgoing call"}
          </span>
        </div>
        <span className="text-xs" style={{ color: "var(--text-secondary)" }}>
          {date} · {time}
        </span>
      </div>

      {/* 可选 Summary：只有有文字的时候才显示 */}
      {message.text && message.text.trim().length > 0 && (
        <div
          className="mt-1 rounded-md px-3 py-2 bg-white border border-[var(--divider)]"
          style={{ color: "var(--text-primary)" }}
        >
          <div
            className="text-[11px] font-medium mb-1"
            style={{ color: "var(--text-secondary)" }}
          >
            Summary
          </div>
          <div className="text-sm leading-relaxed whitespace-pre-wrap">
            {message.text}
          </div>
        </div>
      )}
    </div>
  );
}
