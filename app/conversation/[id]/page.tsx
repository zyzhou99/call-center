"use client";

import { useState, useMemo, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ProtectedRoute } from '@/components/protected-route';
import { AppShell, AppHeader } from '@/components/app-shell';
import { LeftChannelRail } from '@/components/left-channel-rail';
import { ConversationListPanel } from '@/components/conversation-list-panel';
import { ChatPanel } from '@/components/chat-panel';
import { GuestProfilePanel } from '@/components/guest-profile-panel';
import { mockConversations, mockMessages, mockProfiles } from '@/lib/mock-data';
import { Channel, Message, Conversation } from '@/types';
import { getLastMessageTimestamp } from '@/lib/conversation-utils';

const CHANNEL_STORAGE_KEY = 'cc_active_channel';

function getInitialChannel(): Channel | "all" {
  if (typeof window === "undefined") return "all";

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
    return stored as Channel | "all";
  }
  return "all";
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
  const conversationId = params.id as string;

  // ✅ activeChannel：用 localStorage 记住上一次选择
  const [activeChannel, _setActiveChannel] = useState<Channel | 'all'>(
    () => getInitialChannel()
  );

  const handleChannelSelect = (channel: Channel | 'all') => {
    _setActiveChannel(channel);
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(CHANNEL_STORAGE_KEY, channel);
    }
  };

  const [searchQuery, setSearchQuery] = useState('');

  // 默认用 mock，当成本地假数据
  const [messagesState, setMessagesState] = useState<Record<string, Message[]>>(mockMessages);
  const [conversations, setConversations] = useState<Conversation[]>(mockConversations);

  // 只用真实数据替换「微信」渠道的会话列表
  useEffect(() => {
    async function loadWechatConversations() {
      try {
        const res = await fetch('/api/wecom/sessions');
        if (!res.ok) {
          console.error('Failed to load wecom sessions', await res.text());
          return;
        }
        const data = await res.json();

        const wechatConversations = (data.conversations || []) as Conversation[];

        setConversations((prev) => {
          // 保留非 wechat 渠道的 mock
          const nonWechat = prev.filter((c) => c.channel !== 'wechat');
          // 用真实数据覆盖 wechat 渠道
          return [...nonWechat, ...wechatConversations];
        });
      } catch (e) {
        console.error('Failed to load wecom sessions', e);
      }
    }

    loadWechatConversations();
  }, []);

  // 当切到某个会话时，如果是微信渠道 & 本地没有消息，就去拉一次真实消息
  useEffect(() => {
    if (!conversationId) return;

    const conv = conversations.find((c) => c.id === conversationId);
    if (!conv) return;

    // 只针对 wechat 渠道，其他渠道继续用 mock
    if (conv.channel !== 'wechat') return;

    // 已经有消息了就不再请求
    if (messagesState[conversationId] && messagesState[conversationId].length > 0) {
      return;
    }

    async function loadWechatMessages() {
      try {
        const res = await fetch(`/api/wecom/sessions/${conversationId}/messages`);
        if (!res.ok) {
          console.error('Failed to load wecom messages', await res.text());
          return;
        }
        const data = await res.json();
        const wechatMessages = (data.messages || []) as Message[];

        setMessagesState((prev) => ({
          ...prev,
          [conversationId]: wechatMessages,
        }));
      } catch (e) {
        console.error('Failed to load wecom messages', e);
      }
    }

    loadWechatMessages();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversationId, conversations]);

  const filteredConversations = useMemo(() => {
    let filtered = conversations;

    if (activeChannel !== 'all') {
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
  }, [conversations, activeChannel, searchQuery, messagesState]);

  const unreadCounts = useMemo(() => {
    const counts: Record<Channel, number> = {
      wechat: 0,
      whatsapp: 0,
      line: 0,
      webchat: 0,
      email: 0,
      phone: 0,
    };

    conversations.forEach((conv) => {
      counts[conv.channel] += conv.unreadCount;
    });

    return counts;
  }, [conversations]);

  const activeConversation = conversations.find((c) => c.id === conversationId) || null;
  const activeMessages = conversationId ? messagesState[conversationId] || [] : [];
  const activeProfile = conversationId ? mockProfiles[conversationId] || null : null;

  // 选中会话：
  // 1. 清除该会话未读
  // 2. router.push 切到新的 id（但 activeChannel 会通过 localStorage 记住）
  const handleConversationSelect = (id: string) => {
    setConversations((prev) =>
      prev.map((c) => (c.id === id ? { ...c, unreadCount: 0 } : c))
    );

    router.push(`/conversation/${id}`);
  };

  const handleSendMessage = (text: string) => {
    if (!conversationId) return;

    const newMessage: Message = {
      id: `m${Date.now()}`,
      conversationId: conversationId,
      direction: 'out',
      text,
      timeLabel: new Date().toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
      }),
      timestamp: Date.now(),
    };

    setMessagesState((prev) => ({
      ...prev,
      [conversationId]: [...(prev[conversationId] || []), newMessage],
    }));
  };

  const handleCloseConversation = () => {
    console.log('Close conversation');
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
          activeConversationId={conversationId}
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
