"use client";

import { Channel } from '@/types';
import { MessageCircle, Phone, Mail, MessageSquare } from 'lucide-react';
import { cn } from '@/lib/utils';

interface LeftChannelRailProps {
  activeChannel: Channel;
  onChannelSelect: (channel: Channel) => void;
  unreadCounts: Record<Channel, number>;
}

const channelConfig: Record<
  Channel,
  { icon: React.ComponentType<{ className?: string }>; label: string }
> = {
  wechat: { icon: MessageCircle, label: 'WeChat' },
  whatsapp: { icon: MessageSquare, label: 'WhatsApp' },
  line: { icon: MessageCircle, label: 'Line' },
  webchat: { icon: MessageSquare, label: 'Web' },
  email: { icon: Mail, label: 'Email' },
  phone: { icon: Phone, label: 'Phone' },
};

export function LeftChannelRail({
  activeChannel,
  onChannelSelect,
  unreadCounts,
}: LeftChannelRailProps) {
  return (
    <div className="w-[72px] bg-[#1f1f1f] flex flex-col items-center py-6 border-r border-black/20">
      <div className="mb-8">
        <div className="text-2xl font-serif text-white tracking-wide">
          Wynn
        </div>
      </div>

      <div className="flex-1 flex flex-col items-center space-y-2 w-full px-2">
        {(Object.keys(channelConfig) as Channel[]).map((channel) => {
          const config = channelConfig[channel];
          return (
            <ChannelIconButton
              key={channel}
              icon={config.icon}
              label={config.label}
              isActive={activeChannel === channel}
              onClick={() => onChannelSelect(channel)}
              unreadCount={unreadCounts[channel]}
            />
          );
        })}
      </div>
    </div>
  );
}

interface ChannelIconButtonProps {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  isActive: boolean;
  onClick: () => void;
  unreadCount?: number;
}

function ChannelIconButton({
  icon: Icon,
  label,
  isActive,
  onClick,
  unreadCount = 0,
}: ChannelIconButtonProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'relative w-full flex flex-col items-center justify-center py-2 transition-all group rounded-lg',
        isActive
          ? 'text-white'
          : 'text-gray-500 hover:bg-white/5 hover:text-gray-300'
      )}
      style={isActive ? { backgroundColor: '#9C7D47' } : {}}
    >
      {unreadCount > 0 && (
        <span className="absolute top-1.5 right-1.5 w-4 h-4 bg-red-500 text-white text-[10px] rounded-full flex items-center justify-center font-medium">
          {unreadCount > 9 ? '9' : unreadCount}
        </span>
      )}
      <Icon className="w-5 h-5 mb-1" />
      <span className="text-[9px] font-medium">{label}</span>
    </button>
  );
}
