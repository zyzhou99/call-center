"use client";

import { useState, useMemo, useEffect, useRef } from "react";
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
  const [mockConvs, setMockConvs] = useState<Conversation[]>(mockConversations);

  // 真实 wechat 会话
  const [wecomConversations, setWecomConversations] = useState<Conversation[]>(
    []
  );

  // 所有 channel 的消息（wechat + mock）
  const [messagesState, setMessagesState] =
    useState<Record<string, Message[]>>(mockMessages);

  const [activeConversationId, setActiveConversationId] =
    useState<string | null>(mockConversations[0]?.id || null);

  // 记录：服务器返回的「总未读数」快照 & 本地「已读基线」
  const wecomServerUnreadsRef = useRef<Record<string, number>>({});
  const wecomUnreadBaseRef = useRef<Record<string, number>>({});

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

  // 加载 + 轮询企业微信会话列表
  useEffect(() => {
    let timer: ReturnType<typeof setInterval> | null = null;
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
            // 这里的 unreadCount 是「服务器记录的总未读数」
            unreadCount: Number(c.unreadCount || 0),
          })
        );

        // 计算服务器未读快照 & 本地基线
        const serverUnreads: Record<string, number> = {};
        const base: Record<string, number> = {
          ...wecomUnreadBaseRef.current,
        };

        serverConvs.forEach((conv) => {
          const rawUnread = conv.unreadCount || 0;
          serverUnreads[conv.id] = rawUnread;

          if (conv.id === activeConversationId) {
            // 当前正在看的会话：认为这些都已读
            base[conv.id] = rawUnread;
          } else if (!(conv.id in base)) {
            // 第一次看到这个会话：默认认为历史消息都已读
            base[conv.id] = rawUnread;
          }
        });

        wecomServerUnreadsRef.current = serverUnreads;
        wecomUnreadBaseRef.current = base;

        // 计算「真正要显示的小红点数量」= 总未读 - 基线
        const convList: Conversation[] = serverConvs.map((conv) => {
          const rawUnread = serverUnreads[conv.id] || 0;
          const baseUnread = base[conv.id] || 0;
          const effectiveUnread = Math.max(0, rawUnread - baseUnread);

          const unreadCount =
            activeConversationId && conv.id === activeConversationId
              ? 0
              : effectiveUnread;

          return {
            ...conv,
            unreadCount,
          };
        });

        setWecomConversations(convList);

        // 没有选中会话时，默认选第一个 wechat 会话
        setActiveConversationId((prev) => prev || convList[0]?.id || prev);
      } catch (e) {
        console.error("load wecom sessions failed:", e);
      }
    };

    // 初始化先拉一次
    fetchSessions();

    // 只要左侧包含微信（all / wechat），就轮询更新会话列表
    if (activeChannel === "wechat" || activeChannel === "all") {
      timer = setInterval(fetchSessions, 5000); // 每 5 秒拉一次
    }

    return () => {
      stopped = true;
      if (timer) clearInterval(timer);
    };
  }, [activeChannel, activeConversationId]);

  // 当前要展示的会话源
  const sourceConversations = useMemo(() => {
    if (activeChannel === "wechat") return wecomConversations;
    if (activeChannel === "all")
      return [...wecomConversations, ...mockConvs];
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

        // 标记为已读：更新本地已读基线 + 立即把 UI 未读清零
        const serverUnreads = wecomServerUnreadsRef.current;
        wecomUnreadBaseRef.current = {
          ...wecomUnreadBaseRef.current,
          [conversationId]: serverUnreads[conversationId] || 0,
        };

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
        // 真正写入 DB 后，轮询会把当前会话的最新消息再覆盖一遍
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
