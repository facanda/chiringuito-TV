// app/api/system/notice/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const n = await prisma.systemNotice.findFirst({
    where: { active: true },
    orderBy: { updatedAt: "desc" },
    select: { text: true, updatedAt: true },
  });

  return NextResponse.json({ active: !!n, text: n?.text || "" });
}
