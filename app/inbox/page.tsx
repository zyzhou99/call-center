"use client";

import { useState, useMemo, useEffect } from "react";
import { ProtectedRoute } from "@/components/protected-route";
import { AppShell, AppHeader } from "@/components/app-shell";
import { LeftChannelRail } from "@/components/left-channel-rail";
import { ConversationListPanel } from "@/components/conversation-list-panel";
import { ChatPanel } from "@/components/chat-panel";
import { GuestProfilePanel } from "@/components/guest-profile-panel";
import {
  mockConversations,
  mockMessages,
  mockProfiles,
} from "@/lib/mock-data";
import { Channel, Message, Conversation } from "@/types";
import { getLastMessageTimestamp } from "@/lib/conversation-utils";

const OPEN_KFID = "wkF2d-UgAAEh3wgchi7suzX_aSxSTynw";
const ADMIN = "sync123";
const CHANNEL_STORAGE_KEY = "cc_active_channel";

export default function InboxPage() {
  return (
    <ProtectedRoute>
      <InboxContent />
    </ProtectedRoute>
  );
}

function InboxContent() {
  const [activeChannel, setActiveChannel] = useState<Channel | "all">("all");
  const [searchQuery, setSearchQuery] = useState("");

  // mock 会话
  const [mockConvs, setMockConvs] =
    useState<Conversation[]>(mockConversations);

  // 真实 wechat 会话
  const [wecomConversations, setWecomConversations] = useState<Conversation[]>(
    []
  );

  // 所有 channel 的消息（wechat + mock）
  const [messagesState, setMessagesState] =
    useState<Record<string, Message[]>>(mockMessages);

  const [activeConversationId, setActiveConversationId] = useState<string | null>(
    mockConversations[0]?.id || null
  );

  // 初始化：从 localStorage 恢复上次的 channel
  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = window.localStorage.getItem(CHANNEL_STORAGE_KEY);
    if (
      stored === "all" ||
      stored === "wechat" ||
      stored === "whatsapp" ||
      stored === "line" ||
      stored === "webchat" ||
      stored === "email" ||
      stored === "phone"
    ) {
      setActiveChannel(stored as Channel | "all");
    }
  }, []);

  const handleChannelSelect = (channel: Channel | "all") => {
    setActiveChannel(channel);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(CHANNEL_STORAGE_KEY, channel);
    }
  };

  // 加载企业微信会话列表（页面加载时跑一次）
  useEffect(() => {
    (async () => {
      try {
        const resp = await fetch(
          `/api/wecom/sessions?open_kfid=${encodeURIComponent(OPEN_KFID)}`,
          {
            headers: { "x-admin-token": ADMIN },
          }
        );
        const data = await resp.json();

        if (data?.ok) {
          const convs: Conversation[] = (data.conversations || []).map(
            (c: any) => ({
              id: c.id, // external_userid
              channel: "wechat",
              displayName: c.displayName || c.id,
              lastMessagePreview: c.lastMessagePreview || "",
              unreadCount: Number(c.unreadCount || 0),
            })
          );
          setWecomConversations(convs);

          // 如果当前没有 activeConversationId，就默认选第一个微信会话
          setActiveConversationId((prev) => prev || convs[0]?.id || prev);
        }
      } catch (e) {
        console.error("load wecom sessions failed:", e);
      }
    })();
  }, []);

  // 当前要展示的会话源
  const sourceConversations = useMemo(() => {
    if (activeChannel === "wechat") return wecomConversations;
    if (activeChannel === "all") return [...wecomConversations, ...mockConvs];
    return mockConvs;
  }, [activeChannel, wecomConversations, mockConvs]);

  // 过滤 + 排序
  const filteredConversations = useMemo(() => {
    let filtered = sourceConversations;

    if (activeChannel !== "all") {
      filtered = filtered.filter((c) => c.channel === activeChannel);
    }

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (c) =>
          c.displayName.toLowerCase().includes(query) ||
          c.lastMessagePreview.toLowerCase().includes(query)
      );
    }

    return filtered.sort((a, b) => {
      const aTimestamp = getLastMessageTimestamp(messagesState[a.id] || []);
      const bTimestamp = getLastMessageTimestamp(messagesState[b.id] || []);
      return bTimestamp - aTimestamp;
    });
  }, [sourceConversations, activeChannel, searchQuery, messagesState]);

  // 左侧栏未读数
  const unreadCounts = useMemo(() => {
    const counts: Record<Channel, number> = {
      wechat: 0,
      whatsapp: 0,
      line: 0,
      webchat: 0,
      email: 0,
      phone: 0,
    };

    mockConvs.forEach((conv) => {
      counts[conv.channel] += conv.unreadCount;
    });

    wecomConversations.forEach((conv) => {
      counts.wechat += conv.unreadCount;
    });

    return counts;
  }, [mockConvs, wecomConversations]);

  const activeConversation =
    filteredConversations.find((c) => c.id === activeConversationId) || null;
  const activeMessages = activeConversationId
    ? messagesState[activeConversationId] || []
    : [];
  const activeProfile = activeConversationId
    ? mockProfiles[activeConversationId] || null
    : null;

  // 选会话
  const handleConversationSelect = async (conversationId: string) => {
    setActiveConversationId(conversationId);

    if (activeChannel === "wechat") {
      try {
        const resp = await fetch(
          `/api/wecom/sessions/${encodeURIComponent(
            conversationId
          )}/messages?open_kfid=${encodeURIComponent(OPEN_KFID)}&take=50`,
          { headers: { "x-admin-token": ADMIN } }
        );
        const data = await resp.json();

        if (data?.ok) {
          setMessagesState((prev) => ({
            ...prev,
            [conversationId]: data.messages || [],
          }));
        }

        // 把未读清 0（只改前端）
        setWecomConversations((prev) =>
          prev.map((c) =>
            c.id === conversationId ? { ...c, unreadCount: 0 } : c
          )
        );
      } catch (e) {
        console.error("load wecom messages failed:", e);
      }
      return;
    }

    // 非 wechat：沿用你原来的 mock 逻辑
    setMockConvs((prevConversations) =>
      prevConversations.map((conv) =>
        conv.id === conversationId ? { ...conv, unreadCount: 0 } : conv
      )
    );
  };

  // ✅ 轮询当前微信会话的消息（保证手机端新消息能自动出现在 PC）
  useEffect(() => {
    if (activeChannel !== "wechat") return;
    if (!activeConversationId) return;

    const convId = activeConversationId; // 固定住当前会话
    let stopped = false;

    const fetchMessages = async () => {
      try {
        const resp = await fetch(
          `/api/wecom/sessions/${encodeURIComponent(
            convId
          )}/messages?open_kfid=${encodeURIComponent(OPEN_KFID)}&take=50`,
          { headers: { "x-admin-token": ADMIN } }
        );
        const data = await resp.json();
        if (!stopped && data?.ok) {
          setMessagesState((prev) => ({
            ...prev,
            [convId]: data.messages || [],
          }));
        }
      } catch (e) {
        console.error("poll wecom messages failed:", e);
      }
    };

    // 先拉一次
    fetchMessages();
    // 然后每 4 秒拉一次
    const timer = setInterval(fetchMessages, 4000);

    return () => {
      stopped = true;
      clearInterval(timer);
    };
  }, [activeChannel, activeConversationId]);

  // 发消息
  const handleSendMessage = async (text: string) => {
    if (!activeConversationId) return;

    const conversationId = activeConversationId;

    // 先乐观更新 UI
    const newMessage: Message = {
      id: `m${Date.now()}`,
      conversationId,
      direction: "out",
      text,
      timeLabel: new Date().toLocaleTimeString("en-US", {
        hour: "numeric",
        minute: "2-digit",
      }),
      timestamp: Date.now(),
    };

    setMessagesState((prev) => ({
      ...prev,
      [conversationId]: [...(prev[conversationId] || []), newMessage],
    }));

    if (activeChannel === "wechat") {
      try {
        await fetch("/api/wecom/kf/send", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            open_kfid: OPEN_KFID,
            touser: conversationId, // external_userid
            content: text,
          }),
        });
        // 真正写入 DB 后，轮询会把当前会话的最新消息再覆盖一遍，
        // 这里不需要额外处理
      } catch (e) {
        console.error("send wecom message failed:", e);
      }
      return;
    }

    // 其它渠道沿用原来的 mock 逻辑
  };

  const handleCloseConversation = () => {
    console.log("Close conversation");
  };

  return (
    <AppShell>
      <LeftChannelRail
        activeChannel={activeChannel}
        onChannelSelect={handleChannelSelect}
        unreadCounts={unreadCounts}
      />

      <div className="flex-1 flex overflow-hidden">
        <ConversationListPanel
          conversations={filteredConversations}
          activeConversationId={activeConversationId}
          onConversationSelect={handleConversationSelect}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          messagesState={messagesState}
        />

        <div className="flex-1 flex flex-col overflow-hidden">
          <AppHeader />

          <div className="flex-1 flex overflow-hidden">
            <ChatPanel
              conversation={activeConversation}
              messages={activeMessages}
              onSendMessage={handleSendMessage}
            />

            <GuestProfilePanel
              profile={activeProfile}
              onCloseConversation={handleCloseConversation}
            />
          </div>
        </div>
      </div>
    </AppShell>
  );
}
