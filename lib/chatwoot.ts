// lib/chatwoot.ts
import "server-only";

// 先把 env 抽出来做一次校验，再用 as string 固定类型
const rawBaseUrl =
  process.env.NEXT_PUBLIC_CHATWOOT_BASE_URL || process.env.CHATWOOT_BASE_URL;
const rawInboxIdentifier =
  process.env.NEXT_PUBLIC_CHATWOOT_INBOX_IDENTIFIER ||
  process.env.CHATWOOT_INBOX_IDENTIFIER;
const rawToken = process.env.CHATWOOT_API_ACCESS_TOKEN;

if (!rawBaseUrl || !rawInboxIdentifier || !rawToken) {
  throw new Error(
    "CHATWOOT_BASE_URL / CHATWOOT_INBOX_IDENTIFIER / CHATWOOT_API_ACCESS_TOKEN 未配置完整"
  );
}

const BASE_URL = rawBaseUrl as string;
const INBOX_IDENTIFIER = rawInboxIdentifier as string;
const API_ACCESS_TOKEN = rawToken as string;

// ----------------- 类型定义 -----------------

// 创建 / 获取 contact + conversation 的参数
export interface EnsureContactParams {
  vipNumber: string; // 例如 "10001"
  displayName: string; // 例如 "Cathy"
  mode: string; // "wecom" | "h5"
  platform?: string | null; // "wechat-browser" / "mobile-browser" 等
  assigneeId?: number | null; // 把会话指派给哪个 agent（Chatwoot 里的 user id）
}

// Chatwoot Public API 创建 contact 的返回（精简版）
interface ChatwootPublicContact {
  id: number;
  source_id?: string | null;
  identifier?: string | null;
  name?: string | null;
  email?: string | null;
}

// Chatwoot Public API 创建 conversation 的返回（精简版）
interface ChatwootPublicConversation {
  id?: number;
  conversation_id?: number;
}

// Public Messages API 的原始结构（只列出我们会用到的字段）
interface ChatwootPublicMessage {
  id: string | number;
  content: string | null;
  created_at?: string | number | null;

  // 一些不同版本里可能出现的字段
  message_type?: string | number | null; // "incoming" / "outgoing" 或 0 / 1
  sender_type?: string | null; // "contact" / "user" / "AgentBot"...
  sender?: {
    type?: string;
  } | null;
}

// 给前端用的统一格式
export interface H5ChatMessage {
  id: string;
  content: string;
  createdAt: string;
  from: "vip" | "agent";
}

// ----------------- Contact & Conversation -----------------

/**
 * 确保在 Chatwoot 里有一个 contact + conversation
 * 返回：
 *   contactIdentifier: 用于 public client API（contact_identifier / source_id）
 *   conversationId:    会话 ID
 */
export async function ensureChatwootContactAndConversation(
  params: EnsureContactParams
): Promise<{ contactIdentifier: string; conversationId: number }> {
  const { vipNumber, displayName, mode, platform, assigneeId } = params;

  // 1）创建 / 获取 contact
  const contactRes = await fetch(
    `${BASE_URL}/public/api/v1/inboxes/${encodeURIComponent(
      INBOX_IDENTIFIER
    )}/contacts`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        api_access_token: API_ACCESS_TOKEN,
      },
      body: JSON.stringify({
        identifier: vipNumber, // 用 vipNumber 做 identifier
        name: displayName,
        custom_attributes: {
          vipNumber,
          vipMode: mode,
          vipPlatform: platform ?? "",
        },
      }),
    }
  );

  if (!contactRes.ok) {
    const text = await contactRes.text();
    throw new Error(
      `Chatwoot create contact failed: ${contactRes.status} ${text}`
    );
  }

  const contactJson = (await contactRes.json()) as ChatwootPublicContact;

  // source_id 是 public client API 推荐用的 contact_identifier
  const contactIdentifier =
    contactJson.source_id ??
    contactJson.identifier ??
    contactJson.id.toString();

  // 2）创建 conversation
  const convRes = await fetch(
    `${BASE_URL}/public/api/v1/inboxes/${encodeURIComponent(
      INBOX_IDENTIFIER
    )}/contacts/${encodeURIComponent(contactIdentifier)}/conversations`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        api_access_token: API_ACCESS_TOKEN,
      },
      body: JSON.stringify({
        source_id: contactIdentifier,
        // 把对话指派给审批这个 VIP 的客服
        assignee_id: assigneeId ?? undefined,
      }),
    }
  );

  if (!convRes.ok) {
    const text = await convRes.text();
    throw new Error(
      `Chatwoot create conversation failed: ${convRes.status} ${text}`
    );
  }

  const convJson = (await convRes.json()) as ChatwootPublicConversation;
  const conversationId =
    (convJson as any).id ?? (convJson as any).conversation_id;

  if (typeof conversationId !== "number") {
    throw new Error("Invalid conversation id from Chatwoot");
  }

  return { contactIdentifier, conversationId };
}

// ----------------- 消息方向判断 & 映射 -----------------

function resolveFrom(msg: ChatwootPublicMessage): "vip" | "agent" {
  const mt = msg.message_type;
  const senderType = msg.sender_type ?? msg.sender?.type;

  // 1) 新版：message_type 为字符串
  if (mt === "incoming") return "vip";
  if (mt === "outgoing") return "agent";

  // 2) 有些版本用数字：0=incoming, 1=outgoing
  if (mt === 0 || mt === "0") return "vip";
  if (mt === 1 || mt === "1") return "agent";

  // 3) 再兜底：sender_type / sender.type 为 contact 时，认为是 VIP
  if (senderType && senderType.toLowerCase() === "contact") {
    return "vip";
  }

  // 默认：当成客服消息
  return "agent";
}

// 把 Chatwoot 的 message 映射成我们自己的 H5ChatMessage
function mapPublicMessageToH5(msg: ChatwootPublicMessage): H5ChatMessage {
  const from = resolveFrom(msg);

  let createdAt = "";
  if (typeof msg.created_at === "number") {
    // 有些接口返回的是 Unix 时间戳（秒）
    createdAt = new Date(msg.created_at * 1000).toISOString();
  } else if (typeof msg.created_at === "string") {
    createdAt = new Date(msg.created_at).toISOString();
  } else {
    createdAt = new Date().toISOString();
  }

  return {
    id: String(msg.id),
    content: msg.content ?? "",
    createdAt,
    from,
  };
}

// ----------------- H5 消息收发（Public Messages API） -----------------

/**
 * 拉取某个 contact / conversation 的所有消息
 */
export async function getChatwootMessages(
  contactIdentifier: string,
  conversationId: number
): Promise<H5ChatMessage[]> {
  const res = await fetch(
    `${BASE_URL}/public/api/v1/inboxes/${encodeURIComponent(
      INBOX_IDENTIFIER
    )}/contacts/${encodeURIComponent(
      contactIdentifier
    )}/conversations/${conversationId}/messages`,
    {
      method: "GET",
      headers: {
        api_access_token: API_ACCESS_TOKEN,
      },
      cache: "no-store",
    }
  );

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Chatwoot get messages failed: ${res.status} ${text}`);
  }

  const raw = (await res.json()) as ChatwootPublicMessage[];

  // 如果后面方向还是不对，可以临时打开这一行看看原始结构：
  // console.debug("Chatwoot raw messages:", raw);

  return raw.map(mapPublicMessageToH5);
}

/**
 * 发送一条新消息（从 VIP 客人发出）
 */
export async function sendChatwootMessage(
  contactIdentifier: string,
  conversationId: number,
  content: string
): Promise<H5ChatMessage> {
  const res = await fetch(
    `${BASE_URL}/public/api/v1/inboxes/${encodeURIComponent(
      INBOX_IDENTIFIER
    )}/contacts/${encodeURIComponent(
      contactIdentifier
    )}/conversations/${conversationId}/messages`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        api_access_token: API_ACCESS_TOKEN,
      },
      body: JSON.stringify({
        content,
      }),
    }
  );

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Chatwoot send message failed: ${res.status} ${text}`);
  }

  const raw = (await res.json()) as ChatwootPublicMessage;
  return mapPublicMessageToH5(raw);
}
