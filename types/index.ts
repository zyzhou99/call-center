export type Channel = 'wechat' | 'whatsapp' | 'line' | 'webchat' | 'email' | 'phone' | 'vipRequests' | 'vipContacts';

export interface Conversation {
  id: string;
  channel: Channel;
  displayName: string;
  lastMessagePreview: string;
  lastMessageAtLabel: string;
  unreadCount: number;
  vip: boolean;
  online: boolean;
  room?: string;
  vipTier?: VIPTier;
}

export interface Message {
  id: string;
  conversationId: string;
  direction: 'in' | 'out';
  text: string;
  timeLabel: string;
  dateLabel?: string;
  timestamp?: number;
}

export type VIPTier = 'Red' | 'Platinum' | 'Black' | 'Gold' | 'Diamond' | 'Chairman';

export interface GuestProfile {
  conversationId: string;
  name: string;
  room: string;
  checkInDate: string;
  checkOutDate: string;
  segment: string;
  statusLabel: string;
  vipTier: VIPTier;
  preferredName: string;
  vipNumber: string;
  notes: string;
  remark?: string;
  preference?: string;
  restriction?: string;
}

export interface User {
  email: string;
  name: string;
}
