"use client";

import { useState, useMemo, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
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

// 只返回具体渠道，不再有 "all"
function getInitialChannel(): Channel {
  if (typeof window === "undefined") return "wechat";

  const stored = window.localStorage.getItem(CHANNEL_STORAGE_KEY);
  if (
    stored === "wechat" ||
    stored === "whatsapp" ||
    stored === "line" ||
    stored === "webchat" ||
    stored === "email" ||
    stored === "phone"
  ) {
    return stored as Channel;
  }
  return "wechat";
}

export default function ConversationPage() {
  return (
    <ProtectedRoute>
      <ConversationContent />
    </ProtectedRoute>
  );
}

function ConversationContent() {
  const params = useParams();
  const router = useRouter();
  const routeConversationId = params?.id as string | undefined;

  // 当前渠道（左侧 tab），默认 wechat
  const [activeChannel, setActiveChannel] = useState<Channel>(
    () => getInitialChannel()
  );

  const [searchQuery, setSearchQuery] = useState("");

  // mock 会话（非 wechat）
  const [mockConvs, setMockConvs] =
    useState<Conversation[]>(mockConversations);

  // 真实 wechat 会话
  const [wecomConversations, setWecomConversations] = useState<Conversation[]>(
    []
  );

  // 所有消息（wechat + mock）
  const [messagesState, setMessagesState] =
    useState<Record<string, Message[]>>(mockMessages);

  // 当前打开的会话
  const [activeConversationId, setActiveConversationId] = useState<
    string | null
  >(routeConversationId || mockConversations[0]?.id || null);

  // URL 参数变化时，同步 activeConversationId
  useEffect(() => {
    if (routeConversationId && routeConversationId !== activeConversationId) {
      setActiveConversationId(routeConversationId);
    }
  }, [routeConversationId, activeConversationId]);

  const handleChannelSelect = (channel: Channel) => {
    setActiveChannel(channel);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(CHANNEL_STORAGE_KEY, channel);
    }
  };

  // 拉一次企业微信会话列表
  useEffect(() => {
    let stopped = false;

    const fetchSessions = async () => {
      try {
        const resp = await fetch(
          `/api/wecom/sessions?open_kfid=${encodeURIComponent(OPEN_KFID)}`,
          {
            headers: { "x-admin-token": ADMIN },
          }
        );
        const data = await resp.json();
        if (!data?.ok || stopped) return;

        const serverConvs: Conversation[] = (data.conversations || []).map(
          (c: any) => ({
            id: c.id, // externalUserId
            channel: "wechat",
            displayName: c.displayName || c.id,
            lastMessagePreview: c.lastMessagePreview || "",
            unreadCount: Number(c.unreadCount || 0),
          })
        );

        setWecomConversations(serverConvs);

        // 如果现在还没有 activeConversationId，给一个默认值
        setActiveConversationId((prev) => prev || serverConvs[0]?.id || prev);
      } catch (e) {
        console.error("load wecom sessions failed:", e);
      }
    };

    fetchSessions();

    return () => {
      stopped = true;
    };
  }, []);

  // 所有会话（用于搜索 / activeConversation）
  const allConversations = useMemo(
    () => [...wecomConversations, ...mockConvs],
    [wecomConversations, mockConvs]
  );

  // 左侧列表显示的会话（按 channel 过滤 + 时间排序，不看搜索框）
  const visibleConversations = useMemo(() => {
    let filtered: Conversation[] = [];

    if (activeChannel === "wechat") {
      filtered = wecomConversations;
    } else {
      filtered = mockConvs.filter((c) => c.channel === activeChannel);
    }

    return filtered.sort((a, b) => {
      const aTimestamp = getLastMessageTimestamp(messagesState[a.id] || []);
      const bTimestamp = getLastMessageTimestamp(messagesState[b.id] || []);
      return bTimestamp - aTimestamp;
    });
  }, [activeChannel, wecomConversations, mockConvs, messagesState]);

  // 全局搜索结果（不看 channel，搜所有会话 + 已加载消息）
  const searchResults = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return [];

    const byId: Record<string, Conversation> = {};

    allConversations.forEach((conv) => {
      const nameMatch = conv.displayName?.toLowerCase().includes(q);
      const previewMatch = (conv.lastMessagePreview || "")
        .toLowerCase()
        .includes(q);

      const messages = messagesState[conv.id] || [];
      const messagesMatch = messages.some((m) =>
        (m.text || "").toLowerCase().includes(q)
      );

      if (nameMatch || previewMatch || messagesMatch) {
        byId[conv.id] = conv;
      }
    });

    return Object.values(byId).sort((a, b) => {
      const aTimestamp = getLastMessageTimestamp(messagesState[a.id] || []);
      const bTimestamp = getLastMessageTimestamp(messagesState[b.id] || []);
      return bTimestamp - aTimestamp;
    });
  }, [allConversations, messagesState, searchQuery]);

  // 左侧 channel 未读数
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
    allConversations.find((c) => c.id === activeConversationId) || null;

  const activeMessages = activeConversationId
    ? messagesState[activeConversationId] || []
    : [];

  const activeProfile = activeConversationId
    ? mockProfiles[activeConversationId] || null
    : null;

  // 点击会话：清未读 + 拉消息（wechat）+ 跳路由
  const handleConversationSelect = async (id: string) => {
    setActiveConversationId(id);

    const conv =
      wecomConversations.find((c) => c.id === id) ||
      mockConvs.find((c) => c.id === id);

    if (!conv) {
      router.push(`/conversation/${id}`);
      return;
    }

    if (conv.channel === "wechat") {
      // 切到 wechat tab（可选）
      setActiveChannel("wechat");

      try {
        const resp = await fetch(
          `/api/wecom/sessions/${encodeURIComponent(
            id
          )}/messages?open_kfid=${encodeURIComponent(OPEN_KFID)}&take=50`,
          { headers: { "x-admin-token": ADMIN } }
        );
        const data = await resp.json();
        if (data?.ok) {
          setMessagesState((prev) => ({
            ...prev,
            [id]: data.messages || [],
          }));
        }
      } catch (e) {
        console.error("load wecom messages failed:", e);
      }

      // 清除该会话未读
      setWecomConversations((prev) =>
        prev.map((c) => (c.id === id ? { ...c, unreadCount: 0 } : c))
      );
    } else {
      // mock 渠道：只清未读
      setMockConvs((prev) =>
        prev.map((c) => (c.id === id ? { ...c, unreadCount: 0 } : c))
      );
    }

    router.push(`/conversation/${id}`);
  };

  // 点击搜索结果：清搜索框 + 调用同一套选会话逻辑
  const handleSearchResultSelect = (id: string) => {
    setSearchQuery("");
    void handleConversationSelect(id);
  };

  const handleSendMessage = async (text: string) => {
    if (!activeConversationId) return;
    const conversationId = activeConversationId;

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

    // 乐观更新 UI
    setMessagesState((prev) => ({
      ...prev,
      [conversationId]: [...(prev[conversationId] || []), newMessage],
    }));

    if (activeConversation && activeConversation.channel === "wechat") {
      try {
        await fetch("/api/wecom/kf/send", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            open_kfid: OPEN_KFID,
            touser: conversationId,
            content: text,
          }),
        });
      } catch (e) {
        console.error("send wecom message failed:", e);
      }
    }
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
          conversations={visibleConversations}
          activeConversationId={activeConversationId}
          onConversationSelect={handleConversationSelect}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          messagesState={messagesState}
          searchResults={searchResults}
          onSearchResultSelect={handleSearchResultSelect}
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
