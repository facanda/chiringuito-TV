// app/api/chat/admin/close/route.ts
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { prisma } from "@/lib/prisma";
import { authOptions } from "@/lib/auth";

export async function POST(req: Request) {
  const session = (await getServerSession(authOptions as any)) as any;
  if (!session?.user?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const role = String((session as any).role || "USER");
  if (role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json().catch(() => ({} as any));
  const conversationId = String(body?.conversationId || "").trim();
  if (!conversationId) return NextResponse.json({ error: "conversationId requerido" }, { status: 400 });

  const convo = await prisma.conversation.findUnique({
    where: { id: conversationId },
    select: { id: true, status: true },
  });
  if (!convo) return NextResponse.json({ error: "Conversation no existe" }, { status: 404 });

  await prisma.conversation.update({
    where: { id: conversationId },
    data: { status: "CLOSED" },
  });

  return NextResponse.json({ ok: true });
}
