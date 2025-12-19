import { Message } from '@/types';

export function getLastMessage(messages: Message[]): Message | null {
  if (!messages || messages.length === 0) return null;
  return messages[messages.length - 1];
}

export function getLastMessageTimestamp(messages: Message[]): number {
  const lastMsg = getLastMessage(messages);
  return lastMsg?.timestamp || 0;
}

export function getMessagePreview(message: Message | null): string {
  if (!message) return 'No messages yet';
  const prefix = message.direction === 'out' ? 'You: ' : '';
  const text = message.text;
  const maxLength = 40;
  if (text.length > maxLength) {
    return prefix + text.substring(0, maxLength) + '...';
  }
  return prefix + text;
}

export function getTimeLabel(timestamp: number): string {
  if (!timestamp) return '';

  const now = Date.now();
  const diff = now - timestamp;

  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) {
    return `${days} day${days === 1 ? '' : 's'}`;
  } else if (hours > 0) {
    return `${hours} hour${hours === 1 ? '' : 's'}`;
  } else if (minutes > 0) {
    return `${minutes} min${minutes === 1 ? '' : 's'}`;
  } else {
    return 'just now';
  }
}
