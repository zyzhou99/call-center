"use client";

import { useState, useMemo, useEffect, useRef } from "react";
import { useSearchParams } from "next/navigation";
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
import type { GuestProfile } from "@/types";
import { getLastMessageTimestamp } from "@/lib/conversation-utils";
import { VipRequestsView } from "@/components/inbox/vip-requests-view";

type VipRequestStatus = "PENDING" | "APPROVED" | "REJECTED" | "EXPIRED";

interface VipRequestApi {
  status: VipRequestStatus;
}

interface VipRequestsResponse {
  ok: boolean;
  items?: VipRequestApi[];
  approvals?: VipRequestApi[];
  error?: string;
}

const OPEN_KFID = "wkF2d-UgAAEh3wgchi7suzX_aSxSTynw";
const ADMIN = "sync123";
const CHANNEL_STORAGE_KEY = "cc_active_channel";

// Channel 类型里已经包含了 "vipRequests"
type InboxChannel = Channel;

export default function InboxPage() {
  return (
    <ProtectedRoute>
      <InboxContent />
    </ProtectedRoute>
  );
}

function InboxContent() {
  const searchParams = useSearchParams();

  // 只支持具体渠道（含 vipRequests），不再有 "all"
  const [activeChannel, setActiveChannel] = useState<InboxChannel>("wechat");
  const [searchQuery, setSearchQuery] = useState("");
  const [vipPendingCount, setVipPendingCount] = useState(0);

  // mock 会话（非微信）
  const [mockConvs, setMockConvs] = useState<Conversation[]>(mockConversations);

  // 真实 wechat 会话
  const [wecomConversations, setWecomConversations] = useState<Conversation[]>(
    []
  );

  // ✅ H5 / webchat 會話列表（從 Session 表來）
  const [h5Conversations, setH5Conversations] = useState<Conversation[]>([]);

  // 所有 channel 的消息（wechat + mock）
  const [messagesState, setMessagesState] =
    useState<Record<string, Message[]>>(mockMessages);

  const [activeConversationId, setActiveConversationId] = useState<string | null>(
    mockConversations[0]?.id || null
  );

  // 右侧 Guest Profile
  const [activeProfile, setActiveProfile] = useState<GuestProfile | null>(null);

  // 记录：服务器返回的「总未读数」快照 & 本地「已读基线」
  const wecomServerUnreadsRef = useRef<Record<string, number>>({});
  const wecomUnreadBaseRef = useRef<Record<string, number>>({});

  // URL 里带进来的 sessionId（来自 /vip-access 跳转）
  const sessionIdFromUrl = searchParams.get("sessionId");

  // 初始化：从 localStorage 恢复上次的 channel（只恢复普通渠道，不强行跳 vipRequests）
  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = window.localStorage.getItem(CHANNEL_STORAGE_KEY);
    if (
      stored === "wechat" ||
      stored === "whatsapp" ||
      stored === "line" ||
      stored === "webchat" ||
      stored === "email" ||
      stored === "phone" ||
      stored === "vipRequests"
    ) {
      setActiveChannel(stored as InboxChannel);
    }
  }, []);

  const handleChannelSelect = (channel: InboxChannel) => {
    setActiveChannel(channel);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(CHANNEL_STORAGE_KEY, String(channel));
    }
  };

  // 如果从 /vip-access 带了 sessionId 上来：优先用它初始化当前会话 + 右侧 profile
  useEffect(() => {
    if (!sessionIdFromUrl) return;

    const sessionId = sessionIdFromUrl;

    // 切到 wechat 渠道
    setActiveChannel("wechat");
    setActiveConversationId(sessionId);

    (async () => {
      try {
        const resp = await fetch(
          `/api/vip/profile/${encodeURIComponent(sessionId)}`
        );
        const data = await resp.json();

        if (!data?.ok || !data.profile) {
          console.warn("Failed to load VIP profile from sessionId:", data?.error);
          return;
        }

        const profile = data.profile as GuestProfile;
        setActiveProfile(profile);

        // 确保 wecomConversations 里至少有这一条会话
        setWecomConversations((prev) => {
          if (prev.some((c) => c.id === sessionId)) return prev;

          const newConv: Conversation = {
            id: sessionId,
            channel: "wechat",
            displayName: profile.name,
            lastMessagePreview: profile.notes || "",
            unreadCount: 0,
            lastMessageAtLabel: "",
            vip: false,
            online: false,
          };

          return [...prev, newConv];
        });
      } catch (e) {
        console.error("Error fetching VIP profile for sessionId:", e);
      }
    })();
  }, [sessionIdFromUrl]);

  // 🔔 全局輪詢 Pending 數，驅動左側 VIP Requests 小紅點
  useEffect(() => {
    let timer: ReturnType<typeof setInterval> | null = null;
    let stopped = false;

    const fetchPendingCount = async () => {
      try {
        const res = await fetch("/api/vip/approvals");
        const data: VipRequestsResponse = await res.json();

        if (!data?.ok || stopped) return;

        const list: VipRequestApi[] =
          (Array.isArray(data.items) ? data.items : data.approvals) ?? [];

        const pending = list.filter((r) => r.status === "PENDING").length;

        console.log("[pending-poll] raw list length =", list.length);
        console.log("[pending-poll] pending count =", pending);

        setVipPendingCount(pending);
      } catch (e) {
        console.error("fetch vip pending count failed:", e);
      }
    };

    fetchPendingCount();
    timer = setInterval(fetchPendingCount, 5000);

    return () => {
      stopped = true;
      if (timer) clearInterval(timer);
    };
  }, []);

  // ✅ 轮询 H5 / webchat 会话列表（從 Session 表來）
  useEffect(() => {
    let timer: ReturnType<typeof setInterval> | null = null;
    let stopped = false;

    const fetchH5Sessions = async () => {
      try {
        const resp = await fetch("/api/h5/sessions");
        const data = await resp.json();
        if (!data?.ok || stopped) return;

        const rawList: any[] = data.sessions || [];

        const convs: Conversation[] = rawList.map((s: any) => {
          const displayName =
            s.displayName ||
            (s.vipGuest &&
              ((s.vipGuest.preferredName as string) ||
                (s.vipGuest.fullName as string))) ||
            (s.vipNumber ? `VIP ${s.vipNumber}` : "") ||
            s.id;

          const conv: Conversation = {
            id: s.id,
            channel: "webchat",
            displayName,
            lastMessagePreview: s.lastMsgPreview || "",
            unreadCount: 0, // 先不做未讀計算，後面可以再加
            lastMessageAtLabel: "",
            vip: false,
            online: false,
          };

          (conv as any).vipGuest = s.vipGuest ?? null;

          return conv;
        });

        setH5Conversations(convs);
      } catch (e) {
        console.error("load h5 sessions failed:", e);
      }
    };

    fetchH5Sessions();
    timer = setInterval(fetchH5Sessions, 5000);

    return () => {
      stopped = true;
      if (timer) clearInterval(timer);
    };
  }, []);

  // 加载 +（在 wechat channel 下）轮询企业微信会话列表
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

        // 新版接口返回 { ok, sessions: [...] }，旧版可能是 conversations，做个兼容
        const rawList: any[] = data.sessions || data.conversations || [];

        const serverConvs: Conversation[] = rawList.map((c: any) => {
          const conv: Conversation = {
            id: c.id,
            channel: "wechat",
            displayName:
              (c.vipGuest &&
                ((c.vipGuest.preferredName as string) ||
                  (c.vipGuest.fullName as string))) ||
              c.displayName ||
              c.externalUserId ||
              c.id,
            lastMessagePreview: c.lastMsgPreview || c.lastMessagePreview || "",
            unreadCount: Number(c.unreadCount || 0),
            lastMessageAtLabel: "",
            vip: false,
            online: false,
          };

          (conv as any).externalUserId = c.externalUserId || c.id;
          (conv as any).vipGuest = c.vipGuest ?? null;

          return conv;
        });

        // 计算服务器未读快照 & 本地基线
        const serverUnreads: Record<string, number> = {};
        const base: Record<string, number> = {
          ...wecomUnreadBaseRef.current,
        };

        serverConvs.forEach((conv) => {
          const rawUnread = conv.unreadCount || 0;
          serverUnreads[conv.id] = rawUnread;

          if (conv.id === activeConversationId) {
            base[conv.id] = rawUnread;
          } else if (!(conv.id in base)) {
            base[conv.id] = rawUnread;
          }
        });

        wecomServerUnreadsRef.current = serverUnreads;
        wecomUnreadBaseRef.current = base;

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

        setActiveConversationId((prev) => prev || convList[0]?.id || prev);
      } catch (e) {
        console.error("load wecom sessions failed:", e);
      }
    };

    // 初始化先拉一次
    fetchSessions();

    // 只有在微信渠道下才轮询更新会话列表
    if (activeChannel === "wechat") {
      timer = setInterval(fetchSessions, 5000);
    }

    return () => {
      stopped = true;
      if (timer) clearInterval(timer);
    };
  }, [activeChannel, activeConversationId]);

  // 当前要展示的会话源：按照当前 channel 拆分（vipRequests 在这里不会进来）
  const visibleConversations = useMemo(() => {
    let base: Conversation[];

    if (activeChannel === "wechat") {
      base = wecomConversations;
    } else if (activeChannel === "webchat") {
      // ✅ webchat 用 H5 會話列表
      base = h5Conversations;
    } else {
      base = mockConvs.filter((c) => c.channel === activeChannel);
    }

    return [...base].sort((a, b) => {
      const aMsgs = messagesState[a.id] || mockMessages[a.id] || [];
      const bMsgs = messagesState[b.id] || mockMessages[b.id] || [];
      const aTimestamp = getLastMessageTimestamp(aMsgs);
      const bTimestamp = getLastMessageTimestamp(bMsgs);
      return bTimestamp - aTimestamp;
    });
  }, [activeChannel, wecomConversations, h5Conversations, mockConvs, messagesState]);

  // 左侧栏未读数（包含 vipRequests）
  const unreadCounts = useMemo(() => {
    const counts: Record<InboxChannel, number> = {
      wechat: 0,
      whatsapp: 0,
      line: 0,
      webchat: 0,
      email: 0,
      phone: 0,
      vipRequests: vipPendingCount,
    };

    mockConvs.forEach((conv) => {
      counts[conv.channel] += conv.unreadCount;
    });

    wecomConversations.forEach((conv) => {
      counts.wechat += conv.unreadCount;
    });

    // ✅ 把 H5/webchat 的未讀數也算進來（目前都是 0，後面可以做真正未讀）
    h5Conversations.forEach((conv) => {
      counts.webchat += conv.unreadCount;
    });

    return counts;
  }, [mockConvs, wecomConversations, h5Conversations, vipPendingCount]);

  // 全部会话（用于搜索、activeConversation、选会话）
  const allConversations: Conversation[] = useMemo(
    () => [...wecomConversations, ...h5Conversations, ...mockConvs],
    [wecomConversations, h5Conversations, mockConvs]
  );

  const activeConversation =
    allConversations.find((c) => c.id === activeConversationId) || null;

  // activeMessages 兜底
  const activeMessages: Message[] = useMemo(() => {
    if (!activeConversationId) return [];

    const conv = allConversations.find((c) => c.id === activeConversationId);

    const fromState = messagesState[activeConversationId];
    if (fromState && fromState.length > 0) {
      return fromState;
    }

    if (conv && conv.channel !== "wechat") {
      return mockMessages[activeConversationId] || [];
    }

    return [];
  }, [activeConversationId, allConversations, messagesState]);

  // 搜索结果
  const searchResults = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return [];

    const byId: Record<string, Conversation> = {};

    allConversations.forEach((conv) => {
      const nameMatch = conv.displayName?.toLowerCase().includes(q);
      const previewMatch = (conv.lastMessagePreview || "")
        .toLowerCase()
        .includes(q);

      const fromState = messagesState[conv.id] || [];
      const fromMock =
        conv.channel === "wechat" ? [] : mockMessages[conv.id] || [];
      const msgs = fromState.length > 0 ? fromState : fromMock;

      const messagesMatch = msgs.some((m) =>
        (m.text || "").toLowerCase().includes(q)
      );

      if (nameMatch || previewMatch || messagesMatch) {
        byId[conv.id] = conv;
      }
    });

    return Object.values(byId).sort((a, b) => {
      const msgsA = messagesState[a.id] || mockMessages[a.id] || [];
      const msgsB = messagesState[b.id] || mockMessages[b.id] || [];
      const aTimestamp = getLastMessageTimestamp(msgsA);
      const bTimestamp = getLastMessageTimestamp(msgsB);
      return bTimestamp - aTimestamp;
    });
  }, [searchQuery, allConversations, messagesState]);

  // 选会话
    // 选会话
  const handleConversationSelect = async (conversationId: string) => {
    setActiveConversationId(conversationId);

    const conv = allConversations.find((c) => c.id === conversationId);

    // ✅ 微信渠道：從後端拉消息 + 清未讀 + 拉 VIP Profile（保持不變）
    if (conv?.channel === "wechat") {
      const externalUserId =
        (conv as any).externalUserId ||
        (conv as any).external_userid ||
        conv.id;

      try {
        const resp = await fetch(
          `/api/wecom/sessions/${encodeURIComponent(
            externalUserId
          )}/messages?open_kfid=${encodeURIComponent(OPEN_KFID)}&take=50`,
          { headers: { "x-admin-token": ADMIN } }
        );
        const data = await resp.json();

        if (data?.ok && Array.isArray(data.messages)) {
          setMessagesState((prev) => ({
            ...prev,
            [conversationId]: data.messages,
          }));
        }

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

      try {
        const resp = await fetch(
          `/api/vip/profile/${encodeURIComponent(conversationId)}`
        );
        const data = await resp.json();
        if (data?.ok && data.profile) {
          setActiveProfile(data.profile as GuestProfile);
        } else {
          setActiveProfile(null);
        }
      } catch (e) {
        console.error("load VIP profile failed:", e);
        setActiveProfile(null);
      }

      return;
    }

    // ✅ H5 / webchat 渠道：從 Message 表拉消息 + 用同一個 VIP profile API
    if (conv?.channel === "webchat") {
      try {
        const resp = await fetch(
          `/api/h5/sessions/${encodeURIComponent(
            conversationId
          )}/messages?take=50`
        );
        const data = await resp.json();
        if (data?.ok && Array.isArray(data.messages)) {
          setMessagesState((prev) => ({
            ...prev,
            [conversationId]: data.messages,
          }));
        }
      } catch (e) {
        console.error("load h5/webchat messages failed:", e);
      }

      try {
        const resp = await fetch(
          `/api/vip/profile/${encodeURIComponent(conversationId)}`
        );
        const data = await resp.json();
        if (data?.ok && data.profile) {
          setActiveProfile(data.profile as GuestProfile);
        } else {
          setActiveProfile(null);
        }
      } catch (e) {
        console.error("load VIP profile (webchat) failed:", e);
        setActiveProfile(null);
      }

      return;
    }

    // 其它渠道（whatsapp / line / mock），保持你原來的 mock 行為
    setMockConvs((prevConversations) =>
      prevConversations.map((conv) =>
        conv.id === conversationId ? { ...conv, unreadCount: 0 } : conv
      )
    );

    setMessagesState((prev) => {
      const existing = prev[conversationId];
      if (existing && existing.length > 0) return prev;

      const mock = mockMessages[conversationId];
      if (!mock || mock.length === 0) return prev;

      return {
        ...prev,
        [conversationId]: mock,
      };
    });

    setActiveProfile(mockProfiles[conversationId] || null);
  };


  // 搜索结果点击
  const handleSearchResultSelect = (id: string) => {
    const conv = allConversations.find((c) => c.id === id);
    if (conv && conv.channel !== activeChannel) {
      setActiveChannel(conv.channel as InboxChannel);
      if (typeof window !== "undefined") {
        window.localStorage.setItem(CHANNEL_STORAGE_KEY, conv.channel);
      }
    }

    setSearchQuery("");
    void handleConversationSelect(id);
  };

  // 轮询当前微信会话的消息
  useEffect(() => {
    if (activeChannel !== "wechat") return;
    if (!activeConversationId) return;

    const conv = allConversations.find((c) => c.id === activeConversationId);
    if (!conv || conv.channel !== "wechat") return;

    const convId = activeConversationId;
    const externalUserId =
      (conv as any).externalUserId ||
      (conv as any).external_userid ||
      conv.id;

    let stopped = false;

    const fetchMessages = async () => {
      try {
        const resp = await fetch(
          `/api/wecom/sessions/${encodeURIComponent(
            externalUserId
          )}/messages?open_kfid=${encodeURIComponent(OPEN_KFID)}&take=50`,
          { headers: { "x-admin-token": ADMIN } }
        );
        const data = await resp.json();
        if (!stopped && data?.ok && Array.isArray(data.messages)) {
          setMessagesState((prev) => ({
            ...prev,
            [convId]: data.messages,
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
  }, [activeChannel, activeConversationId, allConversations]);

  // 发消息
    // 发消息
  const handleSendMessage = async (text: string) => {
    if (!activeConversationId) return;
    const conversationId = activeConversationId;

    const conv = allConversations.find((c) => c.id === conversationId);

    // ✅ 微信渠道：用企業微信發送（保持原邏輯）
    if (conv?.channel === "wechat") {
      const externalUserId =
        (conv as any).externalUserId ||
        (conv as any).external_userid ||
        conv.id;

      try {
        await fetch("/api/wecom/kf/send", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            open_kfid: OPEN_KFID,
            touser: externalUserId,
            content: text,
          }),
        });
      } catch (e) {
        console.error("send wecom message failed:", e);
      }
      return;
    }

    // ✅ webchat 渠道：寫入 H5 Message 表，讓 /vip-chat 也能看到
    if (conv?.channel === "webchat") {
      try {
        const resp = await fetch(
          `/api/h5/sessions/${encodeURIComponent(
            conversationId
          )}/messages`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ text, from: "agent" }),
          }
        );
        const data = await resp.json();

        if (data?.ok && data.message) {
          const m = data.message as any;

          const newMessage: Message = {
            id: m.id,
            conversationId: m.conversationId,
            direction: m.direction === "out" ? "out" : "in",
            text: m.text || "",
            timeLabel: m.timeLabel,
            timestamp: m.timestamp,
          };

          setMessagesState((prev) => ({
            ...prev,
            [conversationId]: [...(prev[conversationId] || []), newMessage],
          }));
        }
      } catch (e) {
        console.error("send webchat message failed:", e);
      }
      return;
    }

    // 其它渠道（whatsapp / line / email / phone 仍用 mock）
    const now = Date.now();
    const newMessage: Message = {
      id: `m${now}`,
      conversationId,
      direction: "out",
      text,
      timeLabel: new Date(now).toLocaleTimeString("en-US", {
        hour: "numeric",
        minute: "2-digit",
      }),
      timestamp: now,
    };

    setMessagesState((prev) => ({
      ...prev,
      [conversationId]: [...(prev[conversationId] || []), newMessage],
    }));
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

      {/* 右側主區域：上面是 Header，下面根據 channel 切換內容 */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <AppHeader />

        <div className="flex-1 flex overflow-hidden">
          {activeChannel === "vipRequests" ? (
            // 👉 VIP Requests 審批視圖
            <VipRequestsView onPendingCountChange={setVipPendingCount} />
          ) : (
            // 👉 普通渠道：會話列表 + 聊天 + Profile
            <>
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
            </>
          )}
        </div>
      </div>
    </AppShell>
  );
}
