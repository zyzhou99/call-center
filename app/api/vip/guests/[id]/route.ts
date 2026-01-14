// app/api/vip/guests/[id]/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";

interface RouteParams {
  params: { id: string };
}

// PATCH /api/vip/guests/:id
// 用于更新已有 VIP 客户基本信息 + 备注 remark
export async function PATCH(req: Request, { params }: RouteParams) {
  try {
    const id = params.id;

    if (!id) {
      return NextResponse.json(
        { ok: false, error: "MISSING_ID" },
        { status: 400 }
      );
    }

    const body = (await req.json().catch(() => ({}))) as any;

    const vipNumberRaw = body?.vipNumber;
    if (!vipNumberRaw || typeof vipNumberRaw !== "string") {
      return NextResponse.json(
        { ok: false, error: "VIP_NUMBER_REQUIRED" },
        { status: 400 }
      );
    }

    const vipNumber = vipNumberRaw.trim();

    const fullNameRaw = body?.fullName;
    const firstNameRaw = body?.firstName;
    const lastNameRaw = body?.lastName;
    const preferredNameRaw = body?.preferredName;
    const birthdayMdRaw = body?.birthdayMd;
    const contactPhoneRaw = body?.contactPhone;
    const contactEmailRaw = body?.contactEmail;
    const preferenceRaw = body?.preference;
    const restrictionRaw = body?.restriction;
    const remarkRaw = body?.remark;

    const data: any = {
      vipNumber,
      fullName:
        typeof fullNameRaw === "string" && fullNameRaw.trim()
          ? fullNameRaw.trim()
          : null,
      firstName:
        typeof firstNameRaw === "string" && firstNameRaw.trim()
          ? firstNameRaw.trim()
          : null,
      lastName:
        typeof lastNameRaw === "string" && lastNameRaw.trim()
          ? lastNameRaw.trim()
          : null,
      preferredName:
        typeof preferredNameRaw === "string" && preferredNameRaw.trim()
          ? preferredNameRaw.trim()
          : null,
      birthdayMd:
        typeof birthdayMdRaw === "string" && birthdayMdRaw.trim()
          ? birthdayMdRaw.trim()
          : null,
      contactPhone:
        typeof contactPhoneRaw === "string" && contactPhoneRaw.trim()
          ? contactPhoneRaw.trim()
          : null,
      contactEmail:
        typeof contactEmailRaw === "string" && contactEmailRaw.trim()
          ? contactEmailRaw.trim()
          : null,
      preference:
        typeof preferenceRaw === "string" ? preferenceRaw.trim() : "",
      restriction:
        typeof restrictionRaw === "string" ? restrictionRaw.trim() : "",
      remark:
        typeof remarkRaw === "string" ? remarkRaw.trim() : "",
    };

    const guest = await prisma.vipGuest.update({
      where: { id },
      data,
    });

    return NextResponse.json({ ok: true, guest }, { status: 200 });
  } catch (err: any) {
    console.error("Error in PATCH /api/vip/guests/[id]:", err);
    return NextResponse.json(
      { ok: false, error: "SERVER_ERROR" },
      { status: 500 }
    );
  }
}
