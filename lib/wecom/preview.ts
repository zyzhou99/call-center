export function extractPreview(msg: any): string {
  const t = msg?.msgtype;
  if (t === "text") return msg?.text?.content || "[text]";
  if (t === "image") return "[image]";
  if (t === "voice") return "[voice]";
  if (t === "video") return "[video]";
  if (t === "file") return "[file]";
  if (t === "location") return "[location]";
  if (t === "link") return msg?.link?.title ? `[link] ${msg.link.title}` : "[link]";
  if (t === "event") return "[event]";
  return `[${t || "unknown"}]`;
}

