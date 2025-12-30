import { Conversation, Message, GuestProfile } from '@/types';

// 统一时间基准
const NOW = Date.now();
const DAY = 24 * 60 * 60 * 1000;
const HOUR = 60 * 60 * 1000;

export const mockConversations: Conversation[] = [
  {
    id: '1',
    channel: 'whatsapp', // 原来是 wechat，改成非 wechat 渠道
    displayName: 'Jayvion Simon',
    lastMessagePreview: 'No preference, please recommend...',
    lastMessageAtLabel: '3 days',
    unreadCount: 1,
    vip: true,
    online: true,
    room: '304',
    vipTier: 'Diamond',
  },
  {
    id: '2',
    channel: 'whatsapp',
    displayName: 'Reece Chung',
    lastMessagePreview: 'I would like to extend my stay for two more nights.',
    lastMessageAtLabel: '10 hours',
    unreadCount: 0,
    vip: false,
    online: false,
    room: '512',
    vipTier: 'Gold',
  },
  {
    id: '3',
    channel: 'line',
    displayName: 'Lucian Obrien',
    lastMessagePreview:
      'Good morning! Absolutely, I will send housekeeping to your room right away.',
    lastMessageAtLabel: '1 hours',
    unreadCount: 0,
    vip: false,
    online: true,
    room: '210',
    vipTier: 'Platinum',
  },
  {
    id: '4',
    channel: 'webchat',
    displayName: 'Deja Brady',
    lastMessagePreview:
      'Hello! Breakfast is served from 6:30 AM to 10:30 AM in our main dining room.',
    lastMessageAtLabel: '10 hours',
    unreadCount: 0,
    vip: false,
    online: false,
    room: '405',
    vipTier: 'Red',
  },
  {
    id: '5',
    channel: 'email',
    displayName: 'Harrison Stein',
    lastMessagePreview:
      'Yes, our spa is open from 9 AM to 8 PM. Would you like me to book a treatment for you?',
    lastMessageAtLabel: '3 days',
    unreadCount: 1,
    vip: false,
    online: false,
    room: '128',
    vipTier: 'Black',
  },
  {
    id: '6',
    channel: 'phone',
    displayName: 'Cristopher Cardenas',
    lastMessagePreview:
      'Certainly! We have an excellent Italian restaurant just 5 minutes away. I can make a reservation for you.',
    lastMessageAtLabel: '10 hours',
    unreadCount: 0,
    vip: true,
    online: true,
    room: '901',
    vipTier: 'Chairman',
  },
  {
    id: '7',
    channel: 'webchat', // 原来是 wechat，改掉
    displayName: 'Melanie Noble',
    lastMessagePreview:
      'I apologize for the inconvenience. The current password is: HotelGuest2021. Please try that.',
    lastMessageAtLabel: '10 hours',
    unreadCount: 0,
    vip: false,
    online: true,
    room: '322',
    vipTier: 'Platinum',
  },
  {
    id: '8',
    channel: 'whatsapp',
    displayName: 'Shawn Manning',
    lastMessagePreview:
      'Let me check availability for you. Yes, we can accommodate a late checkout until 2 PM.',
    lastMessageAtLabel: '10 hours',
    unreadCount: 0,
    vip: false,
    online: false,
    room: '618',
    vipTier: 'Gold',
  },
  {
    id: '9',
    channel: 'line',
    displayName: 'Soren Durham',
    lastMessagePreview:
      'Yes! Our fitness center is on the 3rd floor and is open 24/7 for all guests.',
    lastMessageAtLabel: '10 hours',
    unreadCount: 0,
    vip: false,
    online: true,
    room: '735',
    vipTier: 'Diamond',
  },
];

export const mockMessages: Record<string, Message[]> = {
  '1': [
    {
      id: 'm1',
      conversationId: '1',
      direction: 'in',
      text:
        'Hi, can you help me arrange a car pickup at 8:10 PM and a dinner reservation for 2 at 8:30?',
      timeLabel: '4:02 PM',
      dateLabel: new Date(NOW - 3 * DAY).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: '2-digit',
      }),
      timestamp: NOW - 3 * DAY,
    },
    {
      id: 'm2',
      conversationId: '1',
      direction: 'out',
      text: 'Good evening. Absolutely, any restaurant preference, and should we bill everything to your room?',
      timeLabel: '4:02 PM',
      timestamp: NOW - 3 * DAY + 60_000,
    },
    {
      id: 'm3',
      conversationId: '1',
      direction: 'in',
      text: 'No preference, please recommend something upscale and yes, bill to the room.',
      timeLabel: '4:02 PM',
      timestamp: NOW - 3 * DAY + 120_000,
    },
  ],
  '2': [
    {
      id: 'm4',
      conversationId: '2',
      direction: 'in',
      text: 'Hello! I need some help with my room reservation.',
      timeLabel: '9:15 AM',
      dateLabel: new Date(NOW - 10 * HOUR).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: '2-digit',
      }),
      timestamp: NOW - 10 * HOUR,
    },
    {
      id: 'm5',
      conversationId: '2',
      direction: 'out',
      text:
        'Of course! I would be happy to assist you. What do you need help with?',
      timeLabel: '9:16 AM',
      timestamp: NOW - 10 * HOUR + 60_000,
    },
    {
      id: 'm6',
      conversationId: '2',
      direction: 'in',
      text: 'I would like to extend my stay for two more nights.',
      timeLabel: '9:18 AM',
      timestamp: NOW - 10 * HOUR + 180_000,
    },
  ],
  '3': [
    {
      id: 'm7',
      conversationId: '3',
      direction: 'in',
      text: 'Good morning! Can I get extra towels in my room?',
      timeLabel: '8:30 AM',
      dateLabel: new Date(NOW - 1 * HOUR).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: '2-digit',
      }),
      timestamp: NOW - 1 * HOUR,
    },
    {
      id: 'm8',
      conversationId: '3',
      direction: 'out',
      text:
        'Good morning! Absolutely, I will send housekeeping to your room right away.',
      timeLabel: '8:32 AM',
      timestamp: NOW - 1 * HOUR + 120_000,
    },
  ],
  '4': [
    {
      id: 'm9',
      conversationId: '4',
      direction: 'in',
      text: 'Hi there! What time is breakfast served?',
      timeLabel: '7:45 AM',
      dateLabel: new Date(NOW - 10 * HOUR).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: '2-digit',
      }),
      timestamp: NOW - 10 * HOUR,
    },
    {
      id: 'm10',
      conversationId: '4',
      direction: 'out',
      text:
        'Hello! Breakfast is served from 6:30 AM to 10:30 AM in our main dining room.',
      timeLabel: '7:46 AM',
      timestamp: NOW - 10 * HOUR + 60_000,
    },
  ],
  '5': [
    {
      id: 'm11',
      conversationId: '5',
      direction: 'in',
      text:
        'I have a question about the spa services. Are they available today?',
      timeLabel: '2:20 PM',
      dateLabel: new Date(NOW - 3 * DAY).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: '2-digit',
      }),
      timestamp: NOW - 3 * DAY,
    },
    {
      id: 'm12',
      conversationId: '5',
      direction: 'out',
      text:
        'Yes, our spa is open from 9 AM to 8 PM. Would you like me to book a treatment for you?',
      timeLabel: '2:22 PM',
      timestamp: NOW - 3 * DAY + 120_000,
    },
  ],
  '6': [
    {
      id: 'm13',
      conversationId: '6',
      direction: 'in',
      text: 'Book room from Dec 24 - Jan 2',
      timeLabel: '6:10 PM',
      dateLabel: new Date(NOW - 10 * HOUR).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: '2-digit',
      }),
      timestamp: NOW - 10 * HOUR,
    },
    {
      id: 'm14',
      conversationId: '6',
      direction: 'out',
      text:
        'Prepare wine in the room',
      timeLabel: '6:12 PM',
      timestamp: NOW - 10 * HOUR + 120_000,
    },
  ],
  '7': [
    {
      id: 'm15',
      conversationId: '7',
      direction: 'in',
      text: 'The Wi-Fi password is not working in my room.',
      timeLabel: '11:30 AM',
      dateLabel: new Date(NOW - 10 * HOUR).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: '2-digit',
      }),
      timestamp: NOW - 10 * HOUR,
    },
    {
      id: 'm16',
      conversationId: '7',
      direction: 'out',
      text:
        'I apologize for the inconvenience. The current password is: HotelGuest2021. Please try that.',
      timeLabel: '11:32 AM',
      timestamp: NOW - 10 * HOUR + 120_000,
    },
  ],
  '8': [
    {
      id: 'm17',
      conversationId: '8',
      direction: 'in',
      text: 'Can I get a late checkout tomorrow?',
      timeLabel: '5:45 PM',
      dateLabel: new Date(NOW - 10 * HOUR).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: '2-digit',
      }),
      timestamp: NOW - 10 * HOUR,
    },
    {
      id: 'm18',
      conversationId: '8',
      direction: 'out',
      text:
        'Let me check availability for you. Yes, we can accommodate a late checkout until 2 PM.',
      timeLabel: '5:47 PM',
      timestamp: NOW - 10 * HOUR + 120_000,
    },
  ],
  '9': [
    {
      id: 'm19',
      conversationId: '9',
      direction: 'in',
      text: 'Is there a gym in the hotel?',
      timeLabel: '7:00 AM',
      dateLabel: new Date(NOW - 10 * HOUR).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: '2-digit',
      }),
      timestamp: NOW - 10 * HOUR,
    },
    {
      id: 'm20',
      conversationId: '9',
      direction: 'out',
      text:
        'Yes! Our fitness center is on the 3rd floor and is open 24/7 for all guests.',
      timeLabel: '7:02 AM',
      timestamp: NOW - 10 * HOUR + 120_000,
    },
  ],
};

export const mockProfiles: Record<string, GuestProfile> = {
  '1': {
    conversationId: '1',
    name: 'Jayvion Simon',
    room: '304',
    checkInDate: '21 Jan 2021',
    checkOutDate: '23 Jan 2021',
    segment: 'Business',
    statusLabel: 'Check in',
    vipTier: 'Diamond',
    preferredName: 'Jay',
    vipNumber: 'VIP-D-10234',
    notes:
      'Drinks coffee every morning at 7 AM. Prefers non-smoking rooms. Enjoys Cuban cigars - favorite brand is Cohiba.',
  },
  '2': {
    conversationId: '2',
    name: 'Reece Chung',
    room: '512',
    checkInDate: '19 Jan 2021',
    checkOutDate: '25 Jan 2021',
    segment: 'Leisure',
    statusLabel: 'Check in',
    vipTier: 'Gold',
    preferredName: 'Reece',
    vipNumber: 'VIP-G-45821',
    notes:
      'Allergic to feather pillows. Prefers high floor with city view.',
  },
  '3': {
    conversationId: '3',
    name: 'Lucian Obrien',
    room: '210',
    checkInDate: '20 Jan 2021',
    checkOutDate: '22 Jan 2021',
    segment: 'Business',
    statusLabel: 'Check in',
    vipTier: 'Platinum',
    preferredName: 'Lucian',
    vipNumber: 'VIP-P-29384',
    notes:
      'Frequent business traveler. Prefers early check-in when available.',
  },
  '4': {
    conversationId: '4',
    name: 'Deja Brady',
    room: '405',
    checkInDate: '18 Jan 2021',
    checkOutDate: '21 Jan 2021',
    segment: 'Leisure',
    statusLabel: 'Check in',
    vipTier: 'Red',
    preferredName: 'Deja',
    vipNumber: 'VIP-R-77492',
    notes:
      'Traveling with family. Requested extra towels and toiletries.',
  },
  '5': {
    conversationId: '5',
    name: 'Harrison Stein',
    room: '128',
    checkInDate: '17 Jan 2021',
    checkOutDate: '20 Jan 2021',
    segment: 'Business',
    statusLabel: 'Check in',
    vipTier: 'Black',
    preferredName: 'Harry',
    vipNumber: 'VIP-B-19283',
    notes:
      'Regular spa guest. Prefers Swedish massage. Enjoys afternoon tea service.',
  },
  '6': {
    conversationId: '6',
    name: 'Cristopher Cardenas',
    room: '901',
    checkInDate: '18 Jan 2021',
    checkOutDate: '24 Jan 2021',
    segment: 'Leisure',
    statusLabel: 'Check in',
    vipTier: 'Chairman',
    preferredName: 'Chris',
    vipNumber: 'VIP-C-00123',
    notes:
      'VIP Chairman tier. Prefers suite with private butler service. Enjoys fine dining and wine tasting.',
  },
  '7': {
    conversationId: '7',
    name: 'Melanie Noble',
    room: '322',
    checkInDate: '19 Jan 2021',
    checkOutDate: '23 Jan 2021',
    segment: 'Business',
    statusLabel: 'Check in',
    vipTier: 'Platinum',
    preferredName: 'Mel',
    vipNumber: 'VIP-P-55091',
    notes:
      'Prefers quiet rooms away from elevators. Enjoys room service breakfast.',
  },
  '8': {
    conversationId: '8',
    name: 'Shawn Manning',
    room: '618',
    checkInDate: '17 Jan 2021',
    checkOutDate: '21 Jan 2021',
    segment: 'Leisure',
    statusLabel: 'Check in',
    vipTier: 'Gold',
    preferredName: 'Shawn',
    vipNumber: 'VIP-G-33187',
    notes:
      'Gym enthusiast. Requests wake-up calls at 6 AM. Enjoys protein-rich breakfast.',
  },
  '9': {
    conversationId: '9',
    name: 'Soren Durham',
    room: '735',
    checkInDate: '16 Jan 2021',
    checkOutDate: '19 Jan 2021',
    segment: 'Business',
    statusLabel: 'Check in',
    vipTier: 'Diamond',
    preferredName: 'Soren',
    vipNumber: 'VIP-D-88204',
    notes:
      'Tech-savvy guest. Appreciates smart room features. Prefers digital check-in/out.',
  },
};