export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
  const token = await getToken({
    req: req as any,
    secret: process.env.NEXTAUTH_SECRET,
  });

  if (!token?.email || (token as any).role !== "ADMIN") {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const m3uText = String(body?.m3uText || "");

  if (!m3uText.trim()) {
    return NextResponse.json({ error: "m3uText requerido" }, { status: 400 });
  }

  const existing = await prisma.globalPlaylist.findFirst({ select: { id: true } });

  if (!existing) {
    await prisma.globalPlaylist.create({ data: { m3uText } });
  } else {
    await prisma.globalPlaylist.update({
      where: { id: existing.id },
      data: { m3uText },
    });
  }

  return NextResponse.json({ ok: true });
}
