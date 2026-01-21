export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import { prisma } from "@/lib/prisma";

function makeKey(name: string, url: string) {
  return `${name}||${url}`;
}

export async function GET(req: Request) {
  const token = await getToken({ req: req as any, secret: process.env.NEXTAUTH_SECRET });
  if (!token?.sub) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const userId = token.sub;

  const rows = await prisma.favorite.findMany({
    where: { userId },
    select: { key: true },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ keys: rows.map((r) => r.key) });
}

export async function POST(req: Request) {
  const token = await getToken({ req: req as any, secret: process.env.NEXTAUTH_SECRET });
  if (!token?.sub) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const userId = token.sub;
  const body = await req.json().catch(() => ({}));
  const key = String(body?.key || "").trim();

  if (!key) return NextResponse.json({ error: "key requerido" }, { status: 400 });

  // toggle
  const existing = await prisma.favorite.findUnique({
    where: { userId_key: { userId, key } },
    select: { id: true },
  });

  if (existing) {
    await prisma.favorite.delete({ where: { id: existing.id } });
    return NextResponse.json({ ok: true, active: false });
  } else {
    await prisma.favorite.create({ data: { userId, key } });
    return NextResponse.json({ ok: true, active: true });
  }
}

export async function DELETE(req: Request) {
  const token = await getToken({ req: req as any, secret: process.env.NEXTAUTH_SECRET });
  if (!token?.sub) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const userId = token.sub;
  await prisma.favorite.deleteMany({ where: { userId } });
  return NextResponse.json({ ok: true });
}
