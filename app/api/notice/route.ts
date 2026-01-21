import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const notice = await prisma.systemNotice.findFirst({
      where: { active: true },
      orderBy: { createdAt: "desc" },
      select: { text: true, createdAt: true, active: true },
    });

    return NextResponse.json({ notice: notice || null });
  } catch (e: any) {
    console.error("system notice error:", e);
    return NextResponse.json({ notice: null });
  }
}
