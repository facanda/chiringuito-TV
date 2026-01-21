export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const n = await prisma.systemNotice.findFirst({
    where: { active: true },
    orderBy: { createdAt: "desc" },
    select: { text: true, createdAt: true },
  });

  return NextResponse.json({ ok: true, notice: n });
}
