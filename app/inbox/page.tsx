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
import { VipListView } from "@/components/inbox/vip-list-view";

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

// ⭐ 新增：未讀基線存儲 key
const WECOM_UNREAD_BASE_STORAGE_KEY = "cc_wecom_unread_base";
const H5_UNREAD_BASE_STORAGE_KEY = "cc_h5_unread_base";

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

  // 🟡 仅用于手机端 UI 的状态，不影响任何数据逻辑
  const [isMobile, setIsMobile] = useState(false);
  const [mobileConversationView, setMobileConversationView] =
    useState<"list" | "detail">("list"); // 列表 / 详情
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false); // 左下角菜单是否打开

  useEffect(() => {
    if (typeof window === "undefined") return;
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768); // <768 一律当成手机端
    };
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const [activeChannel, setActiveChannel] =
    useState<InboxChannel>("wechat");
  const [searchQuery, setSearchQuery] = useState("");
  const [vipPendingCount, setVipPendingCount] = useState(0);

  // mock 会话（非微信、非 webchat 实会话）
  const [mockConvs, setMockConvs] =
    useState<Conversation[]>(mockConversations);

  // 真实 wechat 会话（包括真 WeCom + H5 via WeChat）
  const [wecomConversations, setWecomConversations] = useState<
    Conversation[]
  >([]);

  // 真实 H5 / webchat 会话（瀏覽器掃碼的 H5）
  const [h5Conversations, setH5Conversations] = useState<Conversation[]>(
    []
  );

  // 真实 H5 via WeChat 会话（微信內打開但走本地 H5 模式）
  const [h5WeChatConversations, setH5WeChatConversations] = useState<
    Conversation[]
  >([]);

  // 所有 channel 的消息（wechat + webchat + mock）
  const [messagesState, setMessagesState] = useState<
    Record<string, Message[]>
  >(mockMessages);

  const [activeConversationId, setActiveConversationId] = useState<
    string | null
  >(mockConversations[0]?.id || null);

  // 右侧 Guest Profile
  const [activeProfile, setActiveProfile] =
    useState<GuestProfile | null>(null);

  // WeCom 未读快照
  const wecomServerUnreadsRef = useRef<Record<string, number>>({});
  const wecomUnreadBaseRef = useRef<Record<string, number>>({});

  // H5 / webchat 未读快照
  const h5ServerUnreadsRef = useRef<Record<string, number>>({});
  const h5UnreadBaseRef = useRef<Record<string, number>>({});

  // URL 里带进来的 sessionId（来自 /vip-access 跳转，目前用于 wechat）
  const sessionIdFromUrl = searchParams.get("sessionId");

  // ⭐ 初始化：從 localStorage 恢復 wechat / webchat 的未讀基線
  useEffect(() => {
    if (typeof window === "undefined") return;

    try {
      const rawWecom = window.localStorage.getItem(
        WECOM_UNREAD_BASE_STORAGE_KEY
      );
      if (rawWecom) {
        const parsed = JSON.parse(rawWecom);
        if (parsed && typeof parsed === "object") {
          wecomUnreadBaseRef.current = parsed as Record<string, number>;
        }
      }
    } catch (e) {
      console.error("load wecom unread base failed:", e);
    }

    try {
      const rawH5 = window.localStorage.getItem(
        H5_UNREAD_BASE_STORAGE_KEY
      );
      if (rawH5) {
        const parsed = JSON.parse(rawH5);
        if (parsed && typeof parsed === "object") {
          h5UnreadBaseRef.current = parsed as Record<string, number>;
        }
      }
    } catch (e) {
      console.error("load h5 unread base failed:", e);
    }
  }, []);

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
      stored === "vipRequests" ||
      stored === "vipContacts"
    ) {
      setActiveChannel(stored as InboxChannel);
    }
  }, []);

  const handleChannelSelect = (channel: InboxChannel) => {
    setActiveChannel(channel);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(CHANNEL_STORAGE_KEY, String(channel));
    }
    // 手机端切换 channel 时，回到会话列表视图
    if (isMobile) {
      setMobileConversationView("list");
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
          console.warn(
            "Failed to load VIP profile from sessionId:",
            data?.error
          );
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
            lastMessagePreview: (profile as any).notes || "",
            unreadCount: 0,
            lastMessageAtLabel: "",
            vip: false,
            online: false,
          };

          return [...prev, newConv];
        });

        if (isMobile) {
          setMobileConversationView("detail");
        }
      } catch (e) {
        console.error("Error fetching VIP profile for sessionId:", e);
      }
    })();
  }, [sessionIdFromUrl, isMobile]);

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

        const pending = list.filter(
          (r) => r.status === "PENDING"
        ).length;

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
          `/api/wecom/sessions?open_kfid=${encodeURIComponent(
            OPEN_KFID
          )}`,
          {
            headers: { "x-admin-token": ADMIN },
          }
        );
        const data = await resp.json();
        if (!data?.ok || stopped) return;

        const rawList: any[] =
          data.sessions || data.conversations || [];

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
            lastMessagePreview:
              c.lastMsgPreview || c.lastMessagePreview || "",
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

          if (!(conv.id in base)) {
            // 🆕 第一次看到这个会话：把「当前服务器未读」当成已读基线
            // 以后只有 rawUnread 往上长出来的部分才算「新未读」
            base[conv.id] = rawUnread;
          }
        });

        wecomServerUnreadsRef.current = serverUnreads;
        wecomUnreadBaseRef.current = base;

        // 持久化一下基线，刷新页面时还能对得上
        if (typeof window !== "undefined") {
          try {
            window.localStorage.setItem(
              WECOM_UNREAD_BASE_STORAGE_KEY,
              JSON.stringify(base)
            );
          } catch (e) {
            console.error("save wecom unread base (poll) failed:", e);
          }
        }

        const convList: Conversation[] = serverConvs.map((conv) => {
          const rawUnread = serverUnreads[conv.id] || 0;
          const baseUnread = base[conv.id] || 0;
          const effectiveUnread = Math.max(0, rawUnread - baseUnread);

          return {
            ...conv,
            unreadCount: effectiveUnread,
          };
        });

        setWecomConversations(convList);

        setActiveConversationId((prev) => prev || convList[0]?.id || prev);
      } catch (e) {
        console.error("load wecom sessions failed:", e);
      }
    };

    // 始终后台轮询 WeCom 会话
    fetchSessions();
    timer = setInterval(fetchSessions, 5000);

    return () => {
      stopped = true;
      if (timer) clearInterval(timer);
    };
  }, []); // ✅ 不再依赖 activeConversationId

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

        // 拆成兩份：webchat 用於 WebChat tab，wechat(H5) 用於 WeChat tab
        const webchatConvs: Conversation[] = [];
        const wechatH5Convs: Conversation[] = [];

        rawList.forEach((s: any) => {
          const id = s.id as string;
          const rawUnread = Number(s.unreadCount || 0);
          serverUnreads[id] = rawUnread;

          if (!(id in base)) {
            // 第一次看到這個 H5 會話，用 server 未讀作為基線（第一次不亮紅點）
            base[id] = rawUnread;
          }

          const vipGuest = s.vipGuest ?? null;
          const lastMsgAt =
            typeof s.lastMsgAt === "string"
              ? new Date(s.lastMsgAt)
              : new Date();

          const baseUnread = base[id] || 0;
          let effectiveUnread = Math.max(0, rawUnread - baseUnread);

          // 後端帶回的 channel: "wechat" 或 "webchat"
          const ch: Channel =
            s.channel === "wechat" ? "wechat" : "webchat";

          // 正在打開的對話，未讀顯示為 0
          if (activeChannel === ch && id === activeConversationId) {
            effectiveUnread = 0;
          }

          const conv: Conversation = {
            id,
            channel: ch,
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
          (conv as any).isH5 = true; // ✅ 標記：這是一個 H5 來源的會話

          if (ch === "wechat") {
            wechatH5Convs.push(conv);
          } else {
            webchatConvs.push(conv);
          }
        });

        h5ServerUnreadsRef.current = serverUnreads;
        h5UnreadBaseRef.current = base;

        if (typeof window !== "undefined") {
          try {
            window.localStorage.setItem(
              H5_UNREAD_BASE_STORAGE_KEY,
              JSON.stringify(base)
            );
          } catch (e) {
            console.error("save h5 unread base failed:", e);
          }
        }

        // WebChat tab 用
        setH5Conversations(webchatConvs);
        // WeChat tab 裡「H5 via WeChat」用
        setH5WeChatConversations(wechatH5Convs);
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
      // ✅ 真 WeCom + H5 via WeChat 一起顯示
      base = [...wecomConversations, ...h5WeChatConversations];
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
  }, [
    activeChannel,
    wecomConversations,
    h5WeChatConversations,
    h5Conversations,
    mockConvs,
    messagesState,
  ]);

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
      vipContacts: 0,
    };

    // mock
    mockConvs.forEach((conv) => {
      // ❌ webchat 用實際會話，不算 mock
      if (conv.channel === "webchat") return;
      // ❌ wechat 現在也走實際會話，不要再用 mock 的未讀來干擾左側紅點
      if (conv.channel === "wechat") return;

      counts[conv.channel] += conv.unreadCount;
    });

    // 真 WeCom 會話 → Wechat 累加
    wecomConversations.forEach((conv) => {
      counts.wechat += conv.unreadCount;
    });

    // H5 / webchat 會話 → Webchat 累加
    h5Conversations.forEach((conv) => {
      counts.webchat += conv.unreadCount;
    });

    // ✅ H5 via WeChat 會話 → Wechat 也要算！
    h5WeChatConversations.forEach((conv) => {
      counts.wechat += conv.unreadCount;
    });

    return counts;
  }, [
    mockConvs,
    wecomConversations,
    h5Conversations,
    h5WeChatConversations, // ✅ 記得把它也放進依賴
    vipPendingCount,
  ]);

  // 全部会话（用于搜索、activeConversation）
  const allConversations: Conversation[] = useMemo(
    () => [
      ...wecomConversations,
      ...h5WeChatConversations,
      ...h5Conversations,
      ...mockConvs.filter((c) => c.channel !== "webchat"),
    ],
    [wecomConversations, h5WeChatConversations, h5Conversations, mockConvs]
  );

  const activeConversation =
    allConversations.find((c) => c.id === activeConversationId) || null;

  // activeMessages 兜底
  const activeMessages: Message[] = useMemo(() => {
    if (!activeConversationId) return [];

    const conv = allConversations.find(
      (c) => c.id === activeConversationId
    );

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
      const nameMatch = conv.displayName
        ?.toLowerCase()
        .includes(q);
      const previewMatch = (conv.lastMessagePreview || "")
        .toLowerCase()
        .includes(q);

      const fromState = messagesState[conv.id] || [];
      const fromMock =
        conv.channel === "wechat" || conv.channel === "webchat"
          ? []
          : mockMessages[conv.id] || [];
      const msgs =
        fromState.length > 0 ? fromState : fromMock;

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
        (conv as any).isH5 === true ||
        (typeof externalUserId === "string" &&
          (externalUserId.startsWith("h5:") ||
            externalUserId.startsWith("wxh5:")));

      if (isH5WeChat) {
        // ✅ H5 via WeChat：走 H5 API 拉消息
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
                  : new Date(
                      m.timestamp || Date.now()
                    ).getTime(),
            }));

            setMessagesState((prev) => ({
              ...prev,
              [conversationId]: mapped,
            }));
          }

          // ✅ 這裡用「H5 的未讀基線」，而不是 WeCom 的
          const serverUnreads = h5ServerUnreadsRef.current;
          h5UnreadBaseRef.current = {
            ...h5UnreadBaseRef.current,
            [conversationId]: serverUnreads[conversationId] || 0,
          };

          if (typeof window !== "undefined") {
            try {
              window.localStorage.setItem(
                H5_UNREAD_BASE_STORAGE_KEY,
                JSON.stringify(h5UnreadBaseRef.current)
              );
            } catch (e) {
              console.error(
                "save h5 unread base (select h5-wechat) failed:",
                e
              );
            }
          }

          // ⭐ 新增：同步把 WeCom 那邊的未讀基線也設成「當前值」
          const wecomServerUnreads = wecomServerUnreadsRef.current;
          wecomUnreadBaseRef.current = {
            ...wecomUnreadBaseRef.current,
            [conversationId]:
              wecomServerUnreads[conversationId] || 0,
          };

          if (typeof window !== "undefined") {
            try {
              window.localStorage.setItem(
                WECOM_UNREAD_BASE_STORAGE_KEY,
                JSON.stringify(wecomUnreadBaseRef.current)
              );
            } catch (e) {
              console.error(
                "save wecom unread base (select h5-wechat) failed:",
                e
              );
            }
          }

          // ⭐ 新增：把 wecomConversations 裡這條會話的未讀也清零
          setWecomConversations((prev) =>
            prev.map((c) =>
              c.id === conversationId ? { ...c, unreadCount: 0 } : c
            )
          );

          // 把「H5 via WeChat」這條會話的 unreadCount 清零
          setH5WeChatConversations((prev) =>
            prev.map((c) =>
              c.id === conversationId ? { ...c, unreadCount: 0 } : c
            )
          );
        } catch (e) {
          console.error("load h5 (wechat) messages failed:", e);
        }
      } else {
        // ✅ 真 WeCom 會話：走 WeCom API + WeCom 的未讀基線
        try {
          const resp = await fetch(
            `/api/wecom/sessions/${encodeURIComponent(
              externalUserId
            )}/messages?open_kfid=${encodeURIComponent(
              OPEN_KFID
            )}&take=50`,
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

          if (typeof window !== "undefined") {
            try {
              window.localStorage.setItem(
                WECOM_UNREAD_BASE_STORAGE_KEY,
                JSON.stringify(wecomUnreadBaseRef.current)
              );
            } catch (e) {
              console.error(
                "save wecom unread base (select wecom) failed:",
                e
              );
            }
          }

          setWecomConversations((prev) =>
            prev.map((c) =>
              c.id === conversationId ? { ...c, unreadCount: 0 } : c
            )
          );
        } catch (e) {
          console.error("load wecom messages failed:", e);
        }
      }

      // ⭐ 先用會話自帶的 vipGuest 做一個「快速」Profile（先顯示名字）
      const vipGuest = (conv as any).vipGuest;
      if (vipGuest) {
        const profileFromSession: GuestProfile = {
          ...(vipGuest as any),
          name:
            (vipGuest.preferredName as string) ||
            (vipGuest.fullName as string) ||
            (conv.displayName as string) ||
            "",
        };
        setActiveProfile(profileFromSession);
      } else {
        setActiveProfile(null);
      }

      // ⭐ 再調一次後端 Profile，拿到完整的 preference / restriction 等欄位
      try {
        const resp = await fetch(
          `/api/vip/profile/${encodeURIComponent(conversationId)}`
        );
        const data = await resp.json();
        if (data?.ok && data.profile) {
          setActiveProfile(data.profile as GuestProfile);
        }
      } catch (e) {
        console.error("load VIP profile (wechat) failed:", e);
      }

      if (isMobile) {
        setMobileConversationView("detail");
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
                : new Date(
                    m.timestamp || Date.now()
                  ).getTime(),
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

        if (typeof window !== "undefined") {
          try {
            window.localStorage.setItem(
              H5_UNREAD_BASE_STORAGE_KEY,
              JSON.stringify(h5UnreadBaseRef.current)
            );
          } catch (e) {
            console.error(
              "save h5 unread base (select webchat) failed:",
              e
            );
          }
        }

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

      if (isMobile) {
        setMobileConversationView("detail");
      }

      return;
    }

    // 其它渠道（mock）
    setMockConvs((prevConversations) =>
      prevConversations.map((c) =>
        c.id === conversationId ? { ...c, unreadCount: 0 } : c
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

    if (isMobile) {
      setMobileConversationView("detail");
    }
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

    const conv = allConversations.find(
      (c) => c.id === activeConversationId
    );
    if (!conv || conv.channel !== "wechat") return;

    const convId = activeConversationId;
    const externalUserId =
      (conv as any).externalUserId ||
      (conv as any).external_userid ||
      conv.id;

    const isH5WeChat =
      (conv as any).isH5 === true ||
      (typeof externalUserId === "string" &&
        (externalUserId.startsWith("h5:") ||
          externalUserId.startsWith("wxh5:")));

    let stopped = false;

    const fetchMessages = async () => {
      try {
        if (isH5WeChat) {
          // ⭐ H5 via WeChat：走 H5 API
          const resp = await fetch(
            `/api/h5/sessions/${encodeURIComponent(
              convId
            )}/messages?take=100`
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
                  : new Date(
                      m.timestamp || Date.now()
                    ).getTime(),
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
            )}/messages?open_kfid=${encodeURIComponent(
              OPEN_KFID
            )}&take=50`,
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

    const conv = allConversations.find(
      (c) => c.id === activeConversationId
    );
    if (!conv || conv.channel !== "webchat") return;

    const convId = activeConversationId;
    let stopped = false;

    const fetchMessages = async () => {
      try {
        const resp = await fetch(
          `/api/h5/sessions/${encodeURIComponent(
            convId
          )}/messages?take=100`
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
                : new Date(
                    m.timestamp || Date.now()
                  ).getTime(),
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
        (conv as any).isH5 === true ||
        (typeof externalUserId === "string" &&
          (externalUserId.startsWith("h5:") ||
            externalUserId.startsWith("wxh5:")));

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
      [conversationId]: [
        ...(prev[conversationId] || []),
        newMessage,
      ],
    }));
  };

  const handleCloseConversation = () => {
    console.log("Close conversation");
  };

  const chatChannels: InboxChannel[] = [
    "wechat",
    "whatsapp",
    "webchat",
    "line",
  ];

  // 🟡 手机端：列表 / 详情 + 底部输入框 + 左下角悬浮菜单
  if (isMobile) {
    const mobileMenuItems: {
      key: string;
      label: string;
      onClick: () => void;
    }[] = [
      {
        key: "chat",
        label: "Chat",
        onClick: () => {
          if (!chatChannels.includes(activeChannel)) {
            handleChannelSelect("wechat");
          } else {
            handleChannelSelect(activeChannel);
          }
          setMobileMenuOpen(false);
        },
      },
      {
        key: "email",
        label: "E-Mail",
        onClick: () => {
          handleChannelSelect("email");
          setMobileMenuOpen(false);
        },
      },
      {
        key: "mobile",
        label: "Mobile",
        onClick: () => {
          handleChannelSelect("phone");
          setMobileMenuOpen(false);
        },
      },
      {
        key: "contacts",
        label: "Contact",
        onClick: () => {
          handleChannelSelect("vipContacts");
          setMobileMenuOpen(false);
        },
      },
      {
        key: "requests",
        label: "Requests",
        onClick: () => {
          handleChannelSelect("vipRequests");
          setMobileMenuOpen(false);
        },
      },
    ];

    const showChannelTabs =
      chatChannels.includes(activeChannel) &&
      mobileConversationView === "list";

    return (
      <AppShell>
        <div className="flex-1 flex flex-col overflow-hidden">
          <AppHeader />

          {/* 主内容：按 channel 决定是 VIP 视图还是 Chat 视图 */}
          <div className="flex-1 flex flex-col overflow-hidden">
            {activeChannel === "vipRequests" ? (
              <VipRequestsView
                onPendingCountChange={setVipPendingCount}
              />
            ) : activeChannel === "vipContacts" ? (
              <VipListView />
            ) : (
              <>
                {/* Chat 顶部的渠道 tab（只在列表页显示，在对话页隐藏） */}
                {showChannelTabs && (
                  <div
                    className="flex px-4 pt-3 pb-2 border-b"
                    style={{ borderColor: "var(--divider)" }}
                  >
                    {chatChannels.map((ch) => (
                      <button
                        key={ch}
                        type="button"
                        onClick={() => handleChannelSelect(ch)}
                        className="mr-6 pb-1 text-sm font-medium relative"
                        style={{
                          color:
                            activeChannel === ch
                              ? "var(--text-primary)"
                              : "var(--text-secondary)",
                        }}
                      >
                        {ch === "wechat"
                          ? "Wechat"
                          : ch === "whatsapp"
                          ? "WhatsApp"
                          : ch === "webchat"
                          ? "Web"
                          : "Line"}
                        {activeChannel === ch && (
                          <span
                            className="absolute left-0 right-0 -bottom-0.5 h-[2px]"
                            style={{ backgroundColor: "var(--accent)" }}
                          />
                        )}
                      </button>
                    ))}
                  </div>
                )}

                {mobileConversationView === "list" ? (
                  // 会话列表页（占满全屏）
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
                ) : (
                  // 会话详情页：ChatPanel 占满，输入框自然在底部
                  <div className="flex-1 flex flex-col overflow-hidden relative">
                    <ChatPanel
                      conversation={activeConversation}
                      messages={activeMessages}
                      onSendMessage={handleSendMessage}
                      onMobileBack={() => setMobileConversationView("list")}
                    />
                  </div>
                )}
              </>
            )}
          </div>

          {/* 左下角悬浮 hamburger 菜单 */}
          <button
            type="button"
            onClick={() => setMobileMenuOpen(true)}
            className="fixed bottom-16 left-8 z-30 rounded-full shadow-lg p-6 bg-white"
          >
            <div className="flex flex-col gap-[3px]">
              <span
                className="w-4 h-[2px] rounded-full"
                style={{ backgroundColor: "var(--text-primary)" }}
              />
              <span
                className="w-4 h-[2px] rounded-full"
                style={{ backgroundColor: "var(--text-primary)" }}
              />
              <span
                className="w-4 h-[2px] rounded-full"
                style={{ backgroundColor: "var(--text-primary)" }}
              />
            </div>
          </button>

          {/* 抽屉菜单 */}
          {mobileMenuOpen && (
            <div className="fixed inset-0 z-40 flex">
              <div className="w-64 max-w-[75%] h-full bg-white shadow-xl flex flex-col">
                <div
                  className="px-4 py-4 border-b flex items-center justify-between"
                  style={{ borderColor: "var(--divider)" }}
                >
                  <span
                    className="text-sm font-semibold"
                    style={{ color: "var(--text-primary)" }}
                  >
                    Menu
                  </span>
                  <button
                    type="button"
                    className="text-xl"
                    style={{ color: "var(--text-secondary)" }}
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    ×
                  </button>
                </div>

                <nav className="flex-1 py-2">
                  {mobileMenuItems.map((item) => (
                    <button
                      key={item.key}
                      type="button"
                      onClick={item.onClick}
                      className="w-full flex items-center px-5 py-3 text-left text-sm"
                      style={{ color: "var(--text-primary)" }}
                    >
                      {item.label}
                    </button>
                  ))}
                </nav>
              </div>

              <button
                type="button"
                className="flex-1 bg-black/30"
                onClick={() => setMobileMenuOpen(false)}
              />
            </div>
          )}
        </div>
      </AppShell>
    );
  }

  // 🟢 PC 端：保持你之前的三栏布局完全不变
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
            // 左侧选中「VIP Requests」：走审批视图
            <VipRequestsView onPendingCountChange={setVipPendingCount} />
          ) : activeChannel === "vipContacts" ? (
            // 左侧选中「VIP Contacts」：走 VIP 通讯录视图
            <VipListView />
          ) : (
            // 其它渠道：会话列表 + 聊天 + Profile
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
