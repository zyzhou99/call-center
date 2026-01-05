// app/api/vip/entry/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

interface EntryBody {
  vipNumber: string;
  preferredName?: string;
  birthday: string;   // 前端传 YYYY-MM-DD
  mode?: string;      // "wecom" | "h5"
  browserId?: string; // 前端生成的 uuid（可选）
}

// 小工具：把 YYYY-MM-DD 转成 Date，只看日期就好（UTC 00:00:00）
function parseBirthday(dateStr: string): Date | null {
  if (!dateStr) return null;
  const [yearStr, monthStr, dayStr] = dateStr.split("-");
  const year = Number(yearStr);
  const month = Number(monthStr);
  const day = Number(dayStr);
  if (!year || !month || !day) return null;
  return new Date(Date.UTC(year, month - 1, day));
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as EntryBody;
    const { vipNumber, preferredName, birthday, mode, browserId } = body;

    if (!vipNumber || !birthday) {
      return NextResponse.json(
        { ok: false, error: "MISSING_FIELDS" },
        { status: 400 }
      );
    }

    // 入口模式：默认用 "h5"
    const entryMode = mode === "wecom" ? "wecom" : "h5";

    // 粗略识别平台
    const ua = req.headers.get("user-agent") || "";
    let platform = "desktop-browser";
    if (/MicroMessenger/i.test(ua)) {
      platform = "wechat-browser";
    } else if (/Mobile/i.test(ua)) {
      platform = "mobile-browser";
    }

    // 1) 查 VIP
    const vip = await prisma.vipGuest.findUnique({
      where: { vipNumber },
    });

    if (!vip) {
      return NextResponse.json(
        { ok: false, error: "VIP_NOT_FOUND" },
        { status: 404 }
      );
    }

    // 2) 校验生日
    const inputBirthday = parseBirthday(birthday);
    if (!inputBirthday) {
      return NextResponse.json(
        { ok: false, error: "INVALID_BIRTHDAY" },
        { status: 400 }
      );
    }

    if (!vip.birthday) {
      return NextResponse.json(
        { ok: false, error: "BIRTHDAY_NOT_SET_IN_DB" },
        { status: 403 }
      );
    }

    const db = new Date(vip.birthday);
    const sameDate =
      db.getUTCFullYear() === inputBirthday.getUTCFullYear() &&
      db.getUTCMonth() === inputBirthday.getUTCMonth() &&
      db.getUTCDate() === inputBirthday.getUTCDate();

    if (!sameDate) {
      return NextResponse.json(
        { ok: false, error: "BIRTHDAY_MISMATCH" },
        { status: 403 }
      );
    }

    // 3) 校验姓名（宽松规则：和 fullName 或 preferredName 任意一个相同即可）
    if (preferredName) {
      const inputName = preferredName.trim().toLowerCase();
      const fullName = vip.fullName.trim().toLowerCase();
      const vipPreferred = vip.preferredName?.trim().toLowerCase();

      if (inputName !== fullName && inputName !== vipPreferred) {
        return NextResponse.json(
          { ok: false, error: "NAME_MISMATCH" },
          { status: 403 }
        );
      }
    } else {
      // 业务要求是三项都要填的话，这里可以直接不给过
      return NextResponse.json(
        { ok: false, error: "NAME_REQUIRED" },
        { status: 400 }
      );
    }

    // 4) 创建 PendingApproval
    const pending = await prisma.pendingApproval.create({
      data: {
        mode: entryMode,
        vipGuestId: vip.id,
        vipNumber: vip.vipNumber,
        preferredName: preferredName ?? vip.preferredName ?? vip.fullName,
        birthday: inputBirthday,

        platform,
        userAgent: ua,
        browserId: browserId ?? null,

        status: "PENDING",
      },
    });

    return NextResponse.json({
      ok: true,
      pendingId: pending.id,
      vipDisplayName: pending.preferredName,
    });
  } catch (err) {
    console.error("Error in /api/vip/entry", err);
    return NextResponse.json(
      { ok: false, error: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}
