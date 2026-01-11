// lib/slow-reply-auto.ts

// 1 分鐘未回覆時發出的自動回覆文案（H5 + WeCom 共用）
// 如果以後要改文案，只要改這裡一個地方。
export const SLOW_REPLY_AUTO_TEXT =
  "尊敬的贵宾，当前正值服务高峰，請您稍等片刻。";

// 自動回覆延遲（目前 1 分鐘）
export const SLOW_REPLY_DELAY_MS = 60 * 1000;
