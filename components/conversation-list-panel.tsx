"use client";

import type React from "react";

import { Conversation, VIPTier, Message } from "@/types";
import { Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/contexts/language-context";
import {
  getLastMessage,
  getMessagePreview,
  getTimeLabel,
} from "@/lib/conversation-utils";

interface ConversationListPanelProps {
  conversations: Conversation[];
  activeConversationId: string | null;
  onConversationSelect: (conversationId: string) => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  messagesState: Record<string, Message[]>;
  // 🔍 新增：全局搜索结果 & 点击事件
  searchResults: Conversation[];
  onSearchResultSelect: (conversationId: string) => void;
}

export function ConversationListPanel({
  conversations,
  activeConversationId,
  onConversationSelect,
  searchQuery,
  onSearchChange,
  messagesState,
  searchResults,
  onSearchResultSelect,
}: ConversationListPanelProps) {
  const { t } = useLanguage();

  const showDropdown = searchQuery.trim().length > 0;

  return (
    <div
      className="w-96 flex flex-col"
      style={{
        backgroundColor: "#F9F8F6",
        borderRight: "1px solid var(--divider)",
      }}
    >
      <div
        className="p-4"
        style={{
          borderBottom: "1px solid var(--divider)",
          backgroundColor: "#F9F8F6",
        }}
      >
        <div className="relative">
          <Search
            className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4"
            style={{ color: "var(--text-secondary)" }}
          />
          <input
            type="text"
            placeholder={t("search.placeholder")}
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-opacity-20 shadow-sm"
            style={{
              backgroundColor: "#FFFFFF",
              border: "1px solid var(--divider)",
              color: "var(--text-primary)",
              "--tw-ring-color": "var(--accent)",
            } as React.CSSProperties}
          />

          {/* 🔍 搜索结果下拉弹窗 */}
          {showDropdown && (
            <div className="absolute left-0 right-0 mt-2 bg-white rounded-lg shadow-lg border border-[var(--divider)] max-h-80 overflow-y-auto z-20">
              {searchResults.length === 0 ? (
                <div
                  className="px-3 py-2 text-xs"
                  style={{ color: "var(--text-secondary)" }}
                >
                  {t("search.noResults") ?? "No matching conversations"}
                </div>
              ) : (
                searchResults.map((conv) => (
                  <button
                    key={conv.id}
                    type="button"
                    onClick={() => onSearchResultSelect(conv.id)}
                    className="w-full px-3 py-2 flex items-center justify-between text-left hover:bg-black/5"
                  >
                    <span
                      className="truncate text-sm"
                      style={{ color: "var(--text-primary)" }}
                    >
                      {conv.displayName}
                    </span>
                    {conv.lastMessagePreview && (
                      <span
                        className="ml-2 text-xs truncate"
                        style={{ color: "var(--text-secondary)" }}
                      >
                        {conv.lastMessagePreview}
                      </span>
                    )}
                  </button>
                ))
              )}
            </div>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {conversations.map((conversation) => (
          <ConversationRow
            key={conversation.id}
            conversation={conversation}
            isActive={activeConversationId === conversation.id}
            onClick={() => onConversationSelect(conversation.id)}
            messages={messagesState[conversation.id] || []}
          />
        ))}
      </div>
    </div>
  );
}

interface ConversationRowProps {
  conversation: Conversation;
  isActive: boolean;
  onClick: () => void;
  messages: Message[];
}

const getVIPTierColor = (tier?: VIPTier): string => {
  if (!tier) return "";
  const colors: Record<VIPTier, string> = {
    Red: "#B91C1C",
    Platinum: "#9CA3AF",
    Black: "#111827",
    Gold: "#D4AF37",
    Diamond: "#60A5FA",
    Chairman: "#7C3AED",
  };
  return colors[tier];
};

function ConversationRow({
  conversation,
  isActive,
  onClick,
  messages,
}: ConversationRowProps) {
  const initials = conversation.displayName
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  const vipColor = getVIPTierColor(conversation.vipTier);

  const lastMessage = getLastMessage(messages);
  const previewFromMessages = getMessagePreview(lastMessage);

  // ✅ 优先用后端 /api/wecom/sessions 返回的 lastMessagePreview
  const lastMessagePreview =
    typeof (conversation as any).lastMessagePreview === "string"
      ? (conversation as any).lastMessagePreview.trim()
      : "";

  const preview =
    lastMessagePreview.length > 0 ? lastMessagePreview : previewFromMessages;

  const timeLabel = lastMessage?.timestamp
    ? getTimeLabel(lastMessage.timestamp)
    : conversation.lastMessageAtLabel;

  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full px-4 py-3.5 flex items-center space-x-3 transition-colors text-left relative",
        isActive ? "" : "hover:bg-black/5"
      )}
      style={{
        borderBottom: "1px solid var(--divider)",
        backgroundColor: isActive ? "#FFFFFF" : "transparent",
      }}
    >
      {isActive && (
        <div className="absolute left-0 top-0 bottom-0 w-1 bg-[var(--accent)]" />
      )}
      <div className="flex-shrink-0">
        <div
          className="w-12 h-12 rounded-full flex items-center justify-center text-sm font-medium"
          style={{
            backgroundColor: "var(--avatar-bg)",
            color: "var(--accent)",
          }}
        >
          {initials}
        </div>
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center space-x-1.5 flex-1 min-w-0">
            <span
              className="font-medium truncate"
              style={{ color: "var(--text-primary)" }}
            >
              {conversation.displayName}
            </span>
            {vipColor && (
              <div
                className="flex-shrink-0 w-2.5 h-2.5 transform rotate-45"
                style={{ backgroundColor: vipColor }}
              />
            )}
          </div>
          <span
            className="text-xs flex-shrink-0 ml-2"
            style={{ color: "var(--text-secondary)" }}
          >
            {timeLabel}
          </span>
        </div>
        {conversation.room && (
          <div className="mb-1">
            <span
              className="inline-block px-1.5 py-0.5 text-[10px] font-medium rounded"
              style={{
                backgroundColor: "var(--divider)",
                color: "var(--text-secondary)",
              }}
            >
              {conversation.room}
            </span>
          </div>
        )}
        <div className="flex items-center justify-between">
          <p
            className="text-sm truncate"
            style={{ color: "var(--text-secondary)" }}
          >
            {preview}
          </p>
          {conversation.unreadCount > 0 && (
            <span className="flex-shrink-0 ml-2 min-w-[20px] h-5 px-1.5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center font-medium">
              {conversation.unreadCount}
            </span>
          )}
        </div>
      </div>
    </button>
  );
}
