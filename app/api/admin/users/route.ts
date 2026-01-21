export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { prisma } from "@/lib/prisma";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";

function isAdmin(session: any) {
  return String(session?.role || "USER") === "ADMIN";
}

export async function GET() {
  const session = (await getServerSession(authOptions as any)) as any;

  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!isAdmin(session)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const users = await prisma.user.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      isBlocked: true,
      lastLoginAt: true,
      createdAt: true
    }
  });

  return NextResponse.json({ ok: true, users });
}
