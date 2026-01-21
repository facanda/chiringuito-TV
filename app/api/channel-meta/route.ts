import { NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request) {
  const token = await getToken({
    req: req as any,
    secret: process.env.NEXTAUTH_SECRET,
  });

  if (!token?.sub) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const rows = await prisma.channelMeta.findMany({
    where: { userId: token.sub },
    select: { key: true, group: true },
  });

  const map: Record<string, string> = {};
  for (const r of rows) map[r.key] = r.group;

  return NextResponse.json({ map });
}

export async function POST(req: Request) {
  const token = await getToken({
    req: req as any,
    secret: process.env.NEXTAUTH_SECRET,
  });

  if (!token?.sub) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const body = await req.json();
  const key = String(body?.key || "").trim();
  const group = String(body?.group || "").trim();

  if (!key) return NextResponse.json({ error: "key requerido" }, { status: 400 });
  if (!group) return NextResponse.json({ error: "group requerido" }, { status: 400 });

  await prisma.channelMeta.upsert({
    where: { userId_key: { userId: token.sub, key } },
    create: { userId: token.sub, key, group },
    update: { group },
  });

  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request) {
  const token = await getToken({
    req: req as any,
    secret: process.env.NEXTAUTH_SECRET,
  });

  if (!token?.sub) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const key = String(body?.key || "").trim();

  if (key) {
    await prisma.channelMeta.deleteMany({ where: { userId: token.sub, key } });
    return NextResponse.json({ ok: true, deleted: "one" });
  }

  await prisma.channelMeta.deleteMany({ where: { userId: token.sub } });
  return NextResponse.json({ ok: true, deleted: "all" });
}
