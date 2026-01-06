// app/api/chatwoot/callback/route.ts
import { NextResponse } from "next/server";

/**
 * Chatwoot API Channel 回调入口
 *
 * Chatwoot 会在有「要发给外部用户」的消息时 POST 到这个地址。
 * 现在我们还没做真正的「推送」，只是简单打印一下并返回 200，
 * 让 Chatwoot 认为发送成功，这样就不会显示 "Failed to send"。
 */
export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => null);
    console.log("Chatwoot callback payload:", body);

    // TODO: 将来如果要做真正的推送（比如 WebSocket / 其他端），可以在这里处理

    // 一定要返回 2xx，Chatwoot 才会把消息标记为 sent
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("Chatwoot callback error", e);
    // 即使有错，也返回 200，避免前端看到 failed 图标
    return NextResponse.json({ ok: false }, { status: 200 });
  }
}

// 可选：有些 Chatwoot 版本会对 callback 做 GET 健康检查
export async function GET() {
  return NextResponse.json({ ok: true });
}
