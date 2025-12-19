"use client";

import { useState, useMemo } from 'react';
import { useParams } from 'next/navigation';
import { ProtectedRoute } from '@/components/protected-route';
import { AppShell, AppHeader } from '@/components/app-shell';
import { LeftChannelRail } from '@/components/left-channel-rail';
import { ConversationListPanel } from '@/components/conversation-list-panel';
import { ChatPanel } from '@/components/chat-panel';
import { GuestProfilePanel } from '@/components/guest-profile-panel';
import { mockConversations, mockMessages, mockProfiles } from '@/lib/mock-data';
import { Channel, Message, Conversation } from '@/types';
import { getLastMessageTimestamp } from '@/lib/conversation-utils';

export default function ConversationPage() {
  return (
    <ProtectedRoute>
      <ConversationContent />
    </ProtectedRoute>
  );
}

function ConversationContent() {
  const params = useParams();
  const conversationId = params.id as string;

  const [activeChannel, setActiveChannel] = useState<Channel | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [messagesState, setMessagesState] = useState<Record<string, Message[]>>(mockMessages);
  const [conversations, setConversations] = useState<Conversation[]>(mockConversations);

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

  const handleSendMessage = (text: string) => {
    if (!conversationId) return;

    const newMessage: Message = {
      id: `m${Date.now()}`,
      conversationId: conversationId,
      direction: 'out',
      text,
      timeLabel: new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }),
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
        onChannelSelect={setActiveChannel}
        unreadCounts={unreadCounts}
      />

      <div className="flex-1 flex overflow-hidden">
        <ConversationListPanel
          conversations={filteredConversations}
          activeConversationId={conversationId}
          onConversationSelect={(id) => window.location.href = `/conversation/${id}`}
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

            <GuestProfilePanel profile={activeProfile} onCloseConversation={handleCloseConversation} />
          </div>
        </div>
      </div>
    </AppShell>
  );
}
