export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request) {
  const token = await getToken({
    req: req as any,
    secret: process.env.NEXTAUTH_SECRET,
  });

  if (!token?.email) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const row = await prisma.globalPlaylist.findFirst({
    select: { m3uText: true, updatedAt: true },
    orderBy: { updatedAt: "desc" },
  });

  return NextResponse.json({
    m3uText: row?.m3uText || "",
    updatedAt: row?.updatedAt || null,
  });
}
