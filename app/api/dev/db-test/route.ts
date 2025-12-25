// app/api/dev/db-test/route.ts
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { Channel, MessageDirection } from '@prisma/client';

// GET /api/dev/db-test
export async function GET() {
  try {
    // 1. 随机造一个 externalUserId，避免唯一索引冲突
    const externalUserId = `test-user-${Date.now()}`;
    const openKfid = 'test-openkf'; // 先用测试值

    // 2. 创建一条 Session（会话）
    const session = await prisma.session.create({
      data: {
        openKfid,
        externalUserId,
        displayName: 'Test Guest',
        channel: Channel.wechat,
        lastMsgPreview: 'Hello from test',
        lastMsgAt: new Date(),
        unreadCount: 1,
        vipNumber: 'VIP0001',
      },
    });

    // 3. 创建一条 Message（消息）
    const message = await prisma.message.create({
      data: {
        msgId: `test-msg-${Date.now()}`,
        openKfid,
        externalUserId,
        origin: 'test',
        msgType: 'text',
        sendTime: new Date(),
        payload: { text: 'Hello from test' },

        direction: MessageDirection.in,
        text: 'Hello from test',

        sessionId: session.id,
      },
    });

    // 4. 再查一遍这个 session + messages 看看
    const fullSession = await prisma.session.findUnique({
      where: { id: session.id },
      include: { messages: true },
    });

    return NextResponse.json(
      {
        ok: true,
        session,
        message,
        fullSession,
      },
      { status: 200 },
    );
  } catch (err: any) {
    console.error('DB test error', err);
    return NextResponse.json(
      {
        ok: false,
        error: err?.message ?? String(err),
      },
      { status: 500 },
    );
  }
}
