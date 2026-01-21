import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { prisma } from "@/lib/prisma";
import { authOptions } from "@/lib/auth";

export async function POST() {
  const session = (await getServerSession(authOptions as any)) as any;
  if (!session?.user?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const role = String((session as any).role || "USER");
  if (role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  await prisma.globalNotice.updateMany({
    where: { isActive: true },
    data: { isActive: false },
  });

  return NextResponse.json({ ok: true });
}
