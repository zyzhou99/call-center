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

// ⚠️ 和後端、approvals route 裡保持一致
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

  const [activeChannel, setActiveChannel] = useState<InboxChannel>("wechat");
  const [searchQuery, setSearchQuery] = useState("");
  const [vipPendingCount, setVipPendingCount] = useState(0);

  // mock 会话（非微信、非 webchat 实会话）
  const [mockConvs, setMockConvs] = useState<Conversation[]>(mockConversations);

  // 真实 wechat 会话（包括真 WeCom + H5 via WeChat）
  const [wecomConversations, setWecomConversations] = useState<Conversation[]>(
    []
  );

  // 真实 H5 / webchat 会话（瀏覽器掃碼的 H5）
  const [h5Conversations, setH5Conversations] = useState<Conversation[]>([]);

  // 所有 channel 的消息（wechat + webchat + mock）
  const [messagesState, setMessagesState] =
    useState<Record<string, Message[]>>(mockMessages);

  const [activeConversationId, setActiveConversationId] = useState<string | null>(
    mockConversations[0]?.id || null
  );

  // 右侧 Guest Profile
  const [activeProfile, setActiveProfile] = useState<GuestProfile | null>(null);

  // WeCom 未读快照
  const wecomServerUnreadsRef = useRef<Record<string, number>>({});
  const wecomUnreadBaseRef = useRef<Record<string, number>>({});

  // H5 / webchat 未读快照
  const h5ServerUnreadsRef = useRef<Record<string, number>>({});
  const h5UnreadBaseRef = useRef<Record<string, number>>({});

  // URL 里带进来的 sessionId（来自 /vip-access 跳转，目前用于 wechat）
  const sessionIdFromUrl = searchParams.get("sessionId");

  // 初始化：从 localStorage 恢复上次的 channel
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

  // 如果从 /vip-access 带了 sessionId 上来：视为 wechat 会话（原有逻辑）
  useEffect(() => {
    if (!sessionIdFromUrl) return;

    const sessionId = sessionIdFromUrl;

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

  // 🔔 顶层轮询 VIP Pending 数量，用于左侧 VIP Requests 小红点
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

  // 加载 + 轮询 WeCom 会话列表（包含真 WeCom + H5 via WeChat）
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

  // 加载 + 轮询 H5 / webchat 会话列表（瀏覽器 H5）
  useEffect(() => {
    let timer: ReturnType<typeof setInterval> | null = null;
    let stopped = false;

    const fetchH5Sessions = async () => {
      try {
        const resp = await fetch("/api/h5/sessions");
        const data = await resp.json();
        if (!data?.ok || !Array.isArray(data.sessions) || stopped) return;

        const rawList: any[] = data.sessions;

        const serverUnreads: Record<string, number> = {};
        const base: Record<string, number> = {
          ...h5UnreadBaseRef.current,
        };

        const convList: Conversation[] = rawList.map((s: any) => {
          const id = s.id as string;
          const rawUnread = Number(s.unreadCount || 0);
          serverUnreads[id] = rawUnread;

          if (!(id in base)) {
            base[id] = rawUnread;
          }

          const vipGuest = s.vipGuest ?? null;
          const lastMsgAt =
            typeof s.lastMsgAt === "string"
              ? new Date(s.lastMsgAt)
              : new Date();

          const baseUnread = base[id] || 0;
          let effectiveUnread = Math.max(0, rawUnread - baseUnread);

          if (activeChannel === "webchat" && id === activeConversationId) {
            effectiveUnread = 0;
          }

          const conv: Conversation = {
            id,
            channel: "webchat",
            displayName: s.displayName,
            lastMessagePreview: s.lastMsgPreview || "",
            unreadCount: effectiveUnread,
            lastMessageAtLabel: "",
            vip: false,
            online: false,
          };

          (conv as any).vipGuest = vipGuest;
          (conv as any).vipNumber = s.vipNumber;
          (conv as any).lastMsgAt = lastMsgAt;

          return conv;
        });

        h5ServerUnreadsRef.current = serverUnreads;
        h5UnreadBaseRef.current = base;

        setH5Conversations(convList);
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
  }, [activeChannel, activeConversationId]);

  // 当前要展示的会话源：按照当前 channel 拆分（vipRequests 在这里不会进来）
  const visibleConversations = useMemo(() => {
    let base: Conversation[];

    if (activeChannel === "wechat") {
      base = wecomConversations;
    } else if (activeChannel === "webchat") {
      base = h5Conversations;
    } else {
      base = mockConvs.filter((c) => c.channel === activeChannel);
    }

    return [...base].sort((a, b) => {
      const aMsgs =
        messagesState[a.id] ||
        (a.channel !== "wechat" && a.channel !== "webchat"
          ? mockMessages[a.id] || []
          : []);
      const bMsgs =
        messagesState[b.id] ||
        (b.channel !== "wechat" && b.channel !== "webchat"
          ? mockMessages[b.id] || []
          : []);

      let aTimestamp = getLastMessageTimestamp(aMsgs);
      let bTimestamp = getLastMessageTimestamp(bMsgs);

      if (!aTimestamp && (a as any).lastMsgAt) {
        aTimestamp = new Date((a as any).lastMsgAt).getTime();
      }
      if (!bTimestamp && (b as any).lastMsgAt) {
        bTimestamp = new Date((b as any).lastMsgAt).getTime();
      }

      return bTimestamp - aTimestamp;
    });
  }, [activeChannel, wecomConversations, h5Conversations, mockConvs, messagesState]);

  // 左侧栏未读数（包含 vipRequests + webchat）
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
      if (conv.channel === "webchat") return; // webchat 用實際會話
      counts[conv.channel] += conv.unreadCount;
    });

    wecomConversations.forEach((conv) => {
      counts.wechat += conv.unreadCount;
    });

    h5Conversations.forEach((conv) => {
      counts.webchat += conv.unreadCount;
    });

    return counts;
  }, [mockConvs, wecomConversations, h5Conversations, vipPendingCount]);

  // 全部会话（用于搜索、activeConversation）
  const allConversations: Conversation[] = useMemo(
    () => [
      ...wecomConversations,
      ...h5Conversations,
      ...mockConvs.filter((c) => c.channel !== "webchat"),
    ],
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

    if (conv && conv.channel !== "wechat" && conv.channel !== "webchat") {
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
        conv.channel === "wechat" || conv.channel === "webchat"
          ? []
          : mockMessages[conv.id] || [];
      const msgs = fromState.length > 0 ? fromState : fromMock;

      const messagesMatch = msgs.some((m) =>
        (m.text || "").toLowerCase().includes(q)
      );

      if (nameMatch || previewMatch || messagesMatch) {
        byId[conv.id] = conv;
      }
    });

    return Object.values(byId).sort((a, b) => {
      const msgsA =
        messagesState[a.id] ||
        (a.channel !== "wechat" && a.channel !== "webchat"
          ? mockMessages[a.id] || []
          : []);
      const msgsB =
        messagesState[b.id] ||
        (b.channel !== "wechat" && b.channel !== "webchat"
          ? mockMessages[b.id] || []
          : []);
      const aTimestamp = getLastMessageTimestamp(msgsA);
      const bTimestamp = getLastMessageTimestamp(msgsB);
      return bTimestamp - aTimestamp;
    });
  }, [searchQuery, allConversations, messagesState]);

  // 选会话
  const handleConversationSelect = async (conversationId: string) => {
    setActiveConversationId(conversationId);

    const conv = allConversations.find((c) => c.id === conversationId);

    // 微信渠道：从后端拉消息 + 清未读 + 拉 VIP Profile
    if (conv?.channel === "wechat") {
      const externalUserId =
        (conv as any).externalUserId ||
        (conv as any).external_userid ||
        conv.id;

      const isH5WeChat =
        typeof externalUserId === "string" &&
        externalUserId.startsWith("h5:");

      if (isH5WeChat) {
        // ⭐ H5 via WeChat：用 H5 API 拉消息
        try {
          const resp = await fetch(
            `/api/h5/sessions/${encodeURIComponent(
              conversationId
            )}/messages?take=100`
          );
          const data = await resp.json();
          if (data?.ok && Array.isArray(data.messages)) {
            const mapped: Message[] = data.messages.map((m: any) => ({
              id: m.id,
              conversationId: m.conversationId || conversationId,
              direction: m.direction === "out" ? "out" : "in",
              text: m.text || "",
              timeLabel:
                m.timeLabel ||
                new Date(
                  typeof m.timestamp === "number"
                    ? m.timestamp
                    : m.timestamp || Date.now()
                ).toLocaleTimeString("en-US", {
                  hour: "numeric",
                  minute: "2-digit",
                }),
              timestamp:
                typeof m.timestamp === "number"
                  ? m.timestamp
                  : new Date(m.timestamp || Date.now()).getTime(),
            }));

            setMessagesState((prev) => ({
              ...prev,
              [conversationId]: mapped,
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
          console.error("load h5 (wechat) messages failed:", e);
        }
      } else {
        // ⭐ 真正企業微信客服會話：走 wecom API
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
      }

      // 無論哪一種 wechat 會話，都嘗試拉 VIP Profile
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

    // H5 / webchat 渠道
    if (conv?.channel === "webchat") {
      try {
        const resp = await fetch(
          `/api/h5/sessions/${encodeURIComponent(
            conversationId
          )}/messages?take=100`
        );
        const data = await resp.json();
        if (data?.ok && Array.isArray(data.messages)) {
          const mapped: Message[] = data.messages.map((m: any) => ({
            id: m.id,
            conversationId: m.conversationId || conversationId,
            direction: m.direction === "out" ? "out" : "in",
            text: m.text || "",
            timeLabel:
              m.timeLabel ||
              new Date(
                typeof m.timestamp === "number"
                  ? m.timestamp
                  : m.timestamp || Date.now()
              ).toLocaleTimeString("en-US", {
                hour: "numeric",
                minute: "2-digit",
              }),
            timestamp:
              typeof m.timestamp === "number"
                ? m.timestamp
                : new Date(m.timestamp || Date.now()).getTime(),
          }));

          setMessagesState((prev) => ({
            ...prev,
            [conversationId]: mapped,
          }));
        }

        const serverUnreads = h5ServerUnreadsRef.current;
        h5UnreadBaseRef.current = {
          ...h5UnreadBaseRef.current,
          [conversationId]: serverUnreads[conversationId] || 0,
        };

        setH5Conversations((prev) =>
          prev.map((c) =>
            c.id === conversationId ? { ...c, unreadCount: 0 } : c
          )
        );
      } catch (e) {
        console.error("load h5 messages failed:", e);
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
        console.error("load VIP profile (H5) failed:", e);
        setActiveProfile(null);
      }

      return;
    }

    // 其它渠道（mock）
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

    const isH5WeChat =
      typeof externalUserId === "string" &&
      externalUserId.startsWith("h5:");

    let stopped = false;

    const fetchMessages = async () => {
      try {
        if (isH5WeChat) {
          // ⭐ H5 via WeChat：走 H5 API
          const resp = await fetch(
            `/api/h5/sessions/${encodeURIComponent(convId)}/messages?take=100`
          );
          const data = await resp.json();
          if (!stopped && data?.ok && Array.isArray(data.messages)) {
            const mapped: Message[] = data.messages.map((m: any) => ({
              id: m.id,
              conversationId: m.conversationId || convId,
              direction: m.direction === "out" ? "out" : "in",
              text: m.text || "",
              timeLabel:
                m.timeLabel ||
                new Date(
                  typeof m.timestamp === "number"
                    ? m.timestamp
                    : m.timestamp || Date.now()
                ).toLocaleTimeString("en-US", {
                  hour: "numeric",
                  minute: "2-digit",
                }),
              timestamp:
                typeof m.timestamp === "number"
                  ? m.timestamp
                  : new Date(m.timestamp || Date.now()).getTime(),
            }));

            setMessagesState((prev) => ({
              ...prev,
              [convId]: mapped,
            }));
          }
        } else {
          // ⭐ 真 WeCom 會話：走 wecom API
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
        }
      } catch (e) {
        console.error(
          isH5WeChat
            ? "poll h5 (wechat) messages failed:"
            : "poll wecom messages failed:",
          e
        );
      }
    };

    fetchMessages();
    const timer = setInterval(fetchMessages, 4000);

    return () => {
      stopped = true;
      clearInterval(timer);
    };
  }, [activeChannel, activeConversationId, allConversations]);

  // 轮询当前 webchat 会话的消息（H5 浏览器）
  useEffect(() => {
    if (activeChannel !== "webchat") return;
    if (!activeConversationId) return;

    const conv = allConversations.find((c) => c.id === activeConversationId);
    if (!conv || conv.channel !== "webchat") return;

    const convId = activeConversationId;
    let stopped = false;

    const fetchMessages = async () => {
      try {
        const resp = await fetch(
          `/api/h5/sessions/${encodeURIComponent(convId)}/messages?take=100`
        );
        const data = await resp.json();
        if (!stopped && data?.ok && Array.isArray(data.messages)) {
          const mapped: Message[] = data.messages.map((m: any) => ({
            id: m.id,
            conversationId: m.conversationId || convId,
            direction: m.direction === "out" ? "out" : "in",
            text: m.text || "",
            timeLabel:
              m.timeLabel ||
              new Date(
                typeof m.timestamp === "number"
                  ? m.timestamp
                  : m.timestamp || Date.now()
              ).toLocaleTimeString("en-US", {
                hour: "numeric",
                minute: "2-digit",
              }),
            timestamp:
              typeof m.timestamp === "number"
                ? m.timestamp
                : new Date(m.timestamp || Date.now()).getTime(),
          }));

          setMessagesState((prev) => ({
            ...prev,
            [convId]: mapped,
          }));
        }
      } catch (e) {
        console.error("poll h5 messages failed:", e);
      }
    };

    fetchMessages();
    const timer = setInterval(fetchMessages, 4000);

    return () => {
      stopped = true;
      clearInterval(timer);
    };
  }, [activeChannel, activeConversationId, allConversations]);

  // 发消息
  const handleSendMessage = async (text: string) => {
    if (!activeConversationId) return;
    const conversationId = activeConversationId;

    const conv = allConversations.find((c) => c.id === conversationId);

    // 微信渠道：分 H5 via WeChat & 真 WeCom 兩種
    if (conv?.channel === "wechat") {
      const externalUserId =
        (conv as any).externalUserId ||
        (conv as any).external_userid ||
        conv.id;

      const isH5WeChat =
        typeof externalUserId === "string" &&
        externalUserId.startsWith("h5:");

      if (isH5WeChat) {
        // ⭐ H5 via WeChat：走 H5 發送，讓 /vip-chat 也能看到
        try {
          await fetch(
            `/api/h5/sessions/${encodeURIComponent(
              conversationId
            )}/messages`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ text, from: "agent" }),
            }
          );
        } catch (e) {
          console.error("send h5 (wechat) message failed:", e);
        }
      } else {
        // ⭐ 真 WeCom：走企業微信客服發送
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
      }

      // wechat 模式下不做樂觀更新，等輪詢把真實消息拉回來
      return;
    }

    // H5 / webchat 渠道：走自己的 API，交給輪詢更新
    if (conv?.channel === "webchat") {
      try {
        await fetch(
          `/api/h5/sessions/${encodeURIComponent(
            conversationId
          )}/messages`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ text, from: "agent" }),
          }
        );
      } catch (e) {
        console.error("send h5 message failed:", e);
      }
      return;
    }

    // 其它渠道（mock）
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
