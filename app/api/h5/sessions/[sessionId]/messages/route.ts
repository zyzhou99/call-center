// app/api/h5/sessions/[sessionId]/messages/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(
  _req: Request,
  { params }: { params: { sessionId: string } }
) {
  try {
    const { sessionId } = params;

    // 确认 Session 存在（防止乱传）
    const session = await prisma.session.findUnique({
      where: { id: sessionId },
    });

    if (!session) {
      return NextResponse.json(
        { ok: false, error: "SESSION_NOT_FOUND" },
        { status: 404 }
      );
    }

    const messages = await prisma.message.findMany({
      where: { sessionId },
      orderBy: { sendTime: "asc" },
    });

    return NextResponse.json({
      ok: true,
      messages,
    });
  } catch (err) {
    console.error("GET /api/h5/sessions/[sessionId]/messages error", err);
    return NextResponse.json(
      { ok: false, error: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}
