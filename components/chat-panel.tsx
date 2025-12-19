"use client";

import { useState, useRef, useEffect } from 'react';
import { Conversation, Message } from '@/types';
import { Phone, Smile, Paperclip, Mic, Send } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useLanguage } from '@/contexts/language-context';

interface ChatPanelProps {
  conversation: Conversation | null;
  messages: Message[];
  onSendMessage: (text: string) => void;
}

export function ChatPanel({ conversation, messages, onSendMessage }: ChatPanelProps) {
  const [messageText, setMessageText] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { t } = useLanguage();

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = () => {
    if (messageText.trim()) {
      onSendMessage(messageText.trim());
      setMessageText('');
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  if (!conversation) {
    return (
      <div className="flex-1 flex items-center justify-center bg-white" style={{ color: 'var(--text-secondary)' }}>
        Select a conversation to start messaging
      </div>
    );
  }

  const initials = conversation.displayName
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  return (
    <div className="flex-1 flex flex-col bg-white">
      <div className="px-6 py-4 flex items-center justify-between" style={{ borderBottom: '1px solid var(--divider)' }}>
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-medium" style={{ backgroundColor: 'var(--avatar-bg)', color: 'var(--accent)' }}>
            {initials}
          </div>
          <div>
            <h2 className="font-medium" style={{ color: 'var(--text-primary)' }}>{conversation.displayName}</h2>
          </div>
        </div>

        <button className="p-2 rounded-full transition-colors hover:bg-gray-100">
          <Phone className="w-5 h-5" style={{ color: 'var(--text-primary)' }} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
        {messages.map((message, index) => {
          const showDateLabel = message.dateLabel && (index === 0 || messages[index - 1].dateLabel !== message.dateLabel);
          return (
            <div key={message.id}>
              {showDateLabel && (
                <div className="flex items-center justify-center my-4">
                  <span className="px-3 py-1 text-xs rounded-full" style={{ backgroundColor: 'var(--bg)', color: 'var(--text-secondary)' }}>
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

      <div className="px-6 py-4" style={{ borderTop: '1px solid var(--divider)' }}>
        <div className="flex items-end space-x-2">
          <button className="p-2 rounded-full transition-colors hover:bg-gray-100">
            <Smile className="w-5 h-5" style={{ color: 'var(--text-secondary)' }} />
          </button>

          <div className="flex-1 rounded-lg shadow-sm" style={{ backgroundColor: 'var(--bg)', border: '1px solid var(--divider)' }}>
            <textarea
              value={messageText}
              onChange={(e) => setMessageText(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder={t('composer.placeholder')}
              rows={1}
              className="w-full px-4 py-3 bg-transparent resize-none focus:outline-none text-sm"
              style={{ color: 'var(--text-primary)' }}
            />
          </div>

          <button className="p-2 rounded-full transition-colors hover:bg-gray-100">
            <Paperclip className="w-5 h-5" style={{ color: 'var(--text-secondary)' }} />
          </button>

          <button className="p-2 rounded-full transition-colors hover:bg-gray-100">
            <Mic className="w-5 h-5" style={{ color: 'var(--text-secondary)' }} />
          </button>

          <button
            onClick={handleSend}
            disabled={!messageText.trim()}
            className="p-3 rounded-full transition-colors disabled:opacity-50"
            style={{ backgroundColor: 'var(--accent)' }}
          >
            <Send className="w-5 h-5 text-white" />
          </button>
        </div>

        <p className="text-xs text-center mt-2" style={{ color: 'var(--text-secondary)' }}>
          {t('composer.helperText')}
        </p>
      </div>
    </div>
  );
}

interface MessageBubbleProps {
  message: Message;
}

function MessageBubble({ message }: MessageBubbleProps) {
  const isInbound = message.direction === 'in';

  return (
    <div className={cn('flex', isInbound ? 'justify-start' : 'justify-end')}>
      <div className="max-w-xl">
        <div
          className={cn(
            'px-4 py-2.5 rounded-2xl text-sm',
            isInbound
              ? 'rounded-tl-none shadow-sm'
              : 'rounded-tr-none'
          )}
          style={
            isInbound
              ? { backgroundColor: 'white', border: '1px solid var(--divider)', color: 'var(--text-primary)' }
              : { backgroundColor: 'var(--note)', color: 'var(--text-primary)' }
          }
        >
          {message.text}
        </div>
        <div className={cn('mt-1 text-xs', isInbound ? 'text-left' : 'text-right')} style={{ color: 'var(--text-secondary)' }}>
          {message.timeLabel}
        </div>
      </div>
    </div>
  );
}
