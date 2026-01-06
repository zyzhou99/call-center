// app/api/h5/messages/route.ts
import { NextResponse } from "next/server";
import {
  getChatwootMessages,
  sendChatwootMessage,
  type H5ChatMessage,
} from "@/lib/chatwoot";

// GET: 拉取消息列表
// /api/h5/messages?contact=...&conversationId=...
export async function GET(req: Request) {
  const url = new URL(req.url);
  const contact = url.searchParams.get("contact");
  const conversationIdStr = url.searchParams.get("conversationId");

  if (!contact || !conversationIdStr) {
    return NextResponse.json(
      { ok: false, error: "MISSING_PARAMS" },
      { status: 400 }
    );
  }

  const conversationId = Number(conversationIdStr);
  if (!Number.isFinite(conversationId)) {
    return NextResponse.json(
      { ok: false, error: "INVALID_CONVERSATION_ID" },
      { status: 400 }
    );
  }

  try {
    const messages: H5ChatMessage[] = await getChatwootMessages(
      contact,
      conversationId
    );
    return NextResponse.json({ ok: true, messages });
  } catch (err) {
    console.error("Error getChatwootMessages:", err);
    return NextResponse.json(
      { ok: false, error: "SERVER_ERROR" },
      { status: 500 }
    );
  }
}

// POST: 发送一条新消息（VIP -> Chatwoot）
export async function POST(req: Request) {
  let body: unknown;

  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { ok: false, error: "INVALID_JSON" },
      { status: 400 }
    );
  }

  const { contact, conversationId, content } = body as {
    contact?: string;
    conversationId?: number;
    content?: string;
  };

  if (!contact || typeof contact !== "string") {
    return NextResponse.json(
      { ok: false, error: "MISSING_CONTACT" },
      { status: 400 }
    );
  }

  if (typeof conversationId !== "number" || !Number.isFinite(conversationId)) {
    return NextResponse.json(
      { ok: false, error: "INVALID_CONVERSATION_ID" },
      { status: 400 }
    );
  }

  const text = (content ?? "").trim();
  if (!text) {
    return NextResponse.json(
      { ok: false, error: "EMPTY_CONTENT" },
      { status: 400 }
    );
  }

  try {
    const message = await sendChatwootMessage(contact, conversationId, text);
    return NextResponse.json({ ok: true, message });
  } catch (err) {
    console.error("Error sendChatwootMessage:", err);
    return NextResponse.json(
      { ok: false, error: "SERVER_ERROR" },
      { status: 500 }
    );
  }
}
