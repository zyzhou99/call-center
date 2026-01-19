"use client";

import { Channel } from "@/types";
import { MessageCircle, Phone, Mail, MessageSquare, User } from "lucide-react";
import { cn } from "@/lib/utils";
import Image from "next/image";
import wynnGold from "@/assets/wynn-gold.png";

interface LeftChannelRailProps {
  activeChannel: Channel | "vipContacts";
  onChannelSelect: (channel: Channel | "vipContacts") => void;
  // 左边红点：用 string key 更灵活一点
  unreadCounts: Record<string, number>;
}

// channel 配置：这里放宽成 string key，方便加 vipContacts
const channelConfig: Record<
  string,
  { icon: React.ComponentType<{ className?: string }>; label: string }
> = {
  wechat: { icon: MessageCircle, label: "WeChat" },
  whatsapp: { icon: MessageSquare, label: "WhatsApp" },
  line: { icon: MessageCircle, label: "Line" },
  webchat: { icon: MessageSquare, label: "Web" },
  email: { icon: Mail, label: "Email" },
  phone: { icon: Phone, label: "Phone" },
  vipContacts: { icon: User, label: "Contact" },
  vipRequests: { icon: MessageSquare, label: "Requests" },
};

// 上面一组渠道（和 VIP 区域分开）
const primaryChannels: Channel[] = [
  "wechat",
  "whatsapp",
  "line",
  "webchat",
  "email",
  "phone",
];

export function LeftChannelRail({
  activeChannel,
  onChannelSelect,
  unreadCounts,
}: LeftChannelRailProps) {
  return (
    <div className="w-[72px] bg-[#1f1f1f] flex flex-col items-center py-6 border-r border-black/20">
      {/* Wynn logo */}
      <div className="mb-8 px-2">
        <Image src={wynnGold} alt="Wynn" className="h-8 w-auto" priority />
      </div>

      <div className="flex-1 flex flex-col items-center w-full px-2">
        {/* 上面：普通渠道按钮 */}
        {primaryChannels.map((channel) => {
          const config = channelConfig[channel];
          return (
            <div key={channel} className="w-full mb-2">
              <ChannelIconButton
                icon={config.icon}
                label={config.label}
                isActive={activeChannel === channel}
                onClick={() => onChannelSelect(channel)}
                unreadCount={unreadCounts[channel] || 0}
              />
            </div>
          );
        })}

        {/* 分隔线，把 VIP 区域和上面按钮隔开 */}
        <div className="my-4 h-px w-9 bg-white rounded-full" />

        {/* 下面：VIP Requests + VIP Contacts 两个按钮 */}
        <div className="w-full space-y-2">
          {/* VIP Contacts */}
          <ChannelIconButton
            icon={channelConfig.vipContacts.icon}
            label={channelConfig.vipContacts.label}
            // 这里用 String(...) 避免 TS 抱怨类型不重合
            isActive={String(activeChannel) === "vipContacts"}
            onClick={() => onChannelSelect("vipContacts")}
            unreadCount={unreadCounts.vipContacts || 0}
          />

          {/* VIP Requests */}
          <ChannelIconButton
            icon={channelConfig.vipRequests.icon}
            label={channelConfig.vipRequests.label}
            isActive={activeChannel === "vipRequests"}
            onClick={() => onChannelSelect("vipRequests")}
            unreadCount={unreadCounts.vipRequests || 0}
          />
        </div>
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
  const showBadge = unreadCount > 0;

  return (
    <button
      onClick={onClick}
      className={cn(
        "relative w-full flex flex-col items-center justify-center py-1.5 transition-all group rounded-lg",
        isActive
          ? "text-white"
          : "text-gray-500 hover:bg-white/5 hover:text-gray-300"
      )}
      style={
        isActive
          ? {
              background:
                "linear-gradient(149deg, #F5CB8E 12.13%, #907250 106.89%)",
            }
          : {}
      }
    >
      {/* 小红点：>0 就显示 */}
      {showBadge && (
        <span className="absolute top-1.5 right-1.5 w-4 h-4 bg-red-500 text-white text-[10px] rounded-full flex items-center justify-center font-medium">
          {unreadCount > 9 ? "9" : unreadCount}
        </span>
      )}

      <Icon
        className={cn(
          "w-7 h-7 mb-0.5 [&>path]:stroke-[1.4]",
          isActive
            ? "text-black [&>path]:fill-current"
            : "text-gray-300 group-hover:text-gray-100 [&>path]:fill-none"
        )}
      />
      <span
        className={cn(
          "text-[9px] font-medium",
          isActive ? "text-black" : "text-gray-300 group-hover:text-gray-100"
        )}
      >
        {label}
      </span>
    </button>
  );
}
