// lib/chatwoot.ts
const BASE_URL = process.env.CHATWOOT_BASE_URL;
const INBOX_IDENTIFIER = process.env.CHATWOOT_INBOX_IDENTIFIER;
const API_ACCESS_TOKEN = process.env.CHATWOOT_API_ACCESS_TOKEN;

if (!BASE_URL || !INBOX_IDENTIFIER || !API_ACCESS_TOKEN) {
  throw new Error(
    "CHATWOOT_BASE_URL / CHATWOOT_INBOX_IDENTIFIER / CHATWOOT_API_ACCESS_TOKEN 未配置完整"
  );
}

// 调用参数：用 VIP number + 显示名 去创建/获取 contact + conversation
interface EnsureContactParams {
  vipNumber: string;      // 例如 "10001"
  displayName: string;    // 例如 "Cathy"
  mode: string;           // "wecom" | "h5"
  platform?: string | null; // "wechat-browser" / "mobile-browser" 等
}

// Chatwoot Public API 创建 contact 的返回（精简版）
interface ChatwootPublicContact {
  id: number;
  source_id: string;        // 这个就是后面所有 client API 要用的 contact_identifier
  name?: string | null;
  email?: string | null;
}

// Chatwoot Public API 创建 conversation 的返回（我们只关心 id）
interface ChatwootPublicConversation {
  id?: number;
  conversation_id?: number;
}

/**
 * 确保在 Chatwoot 里有一个 contact + conversation
 * 返回：
 *   contactIdentifier: 用于后续所有 H5 聊天（相当于 contact_identifier / source_id）
 *   conversationId:    会话 ID，用于发消息、拉取消息
 */
export async function ensureChatwootContactAndConversation(
  params: EnsureContactParams
): Promise<{ contactIdentifier: string; conversationId: number }> {
  const { vipNumber, displayName, mode, platform } = params;

  // 1）创建 / 获取 contact
  //    Public API: POST /public/api/v1/inboxes/:inbox_identifier/contacts
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
        // 这里用 vipNumber 做 identifier，确保和你 dev.db 里是一致的（现在都是 "10001" 这种纯数字）
        identifier: vipNumber,
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

  // Public API 返回的 contact 标准字段是 source_id（后续 client API 用这个当 contact_identifier）:contentReference[oaicite:0]{index=0}
  const contactIdentifier =
    (contactJson as any).source_id ??
    (contactJson as any).identifier ??
    contactJson.id.toString();

  // 2）创建 conversation
  //   Public API: POST /public/api/v1/inboxes/:inbox_identifier/contacts/:contact_identifier/conversations:contentReference[oaicite:1]{index=1}
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
        // 官方示例里 body 里也传 source_id（= contact_identifier）:contentReference[oaicite:2]{index=2}
        source_id: contactIdentifier,
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
