import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { prisma } from "@/lib/prisma";
import { authOptions } from "@/lib/auth";

export async function GET(req: Request) {
  const session = await getServerSession(authOptions as any);
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const conversationId = String(searchParams.get("conversationId") || "").trim();
  if (!conversationId) {
    return NextResponse.json({ error: "conversationId requerido" }, { status: 400 });
  }

  const role = String((session as any).role || "USER");
  const sessionUserId = String((session.user as any).id || session.user.email);

  // 1) verifica que exista la conversación
  const convo = await prisma.conversation.findUnique({
    where: { id: conversationId },
    select: { id: true, userId: true },
  });

  if (!convo) {
    return NextResponse.json({ error: "Conversation no existe" }, { status: 404 });
  }

  // 2) permiso: USER solo su propia conversación, ADMIN todas
  if (role !== "ADMIN" && convo.userId !== sessionUserId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // 3) trae mensajes
  const messages = await prisma.message.findMany({
    where: { conversationId },
    orderBy: { createdAt: "asc" },
  });

  return NextResponse.json({ messages });
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions as any);
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({} as any));
  const conversationId = String(body?.conversationId || "").trim();
  const text = String(body?.text || "");
  const imageUrl = body?.imageUrl ? String(body.imageUrl) : null;

  if (!conversationId) {
    return NextResponse.json({ error: "conversationId requerido" }, { status: 400 });
  }
  if (!text.trim() && !imageUrl) {
    return NextResponse.json({ error: "texto o imagen requerida" }, { status: 400 });
  }

  const role = String((session as any).role || "USER");
  const email = String(session.user.email);
  const sessionUserId = String((session.user as any).id || session.user.email);

  // 1) verifica conversación
  const convo = await prisma.conversation.findUnique({
    where: { id: conversationId },
    select: { id: true, userId: true },
  });

  if (!convo) {
    return NextResponse.json({ error: "Conversation no existe" }, { status: 404 });
  }

  // 2) permiso
  if (role !== "ADMIN" && convo.userId !== sessionUserId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // 3) crea mensaje
  const msg = await prisma.message.create({
    data: {
      conversationId,
      senderRole: role === "ADMIN" ? "ADMIN" : "USER",
      senderEmail: email,
      text: text.trim() ? text.trim() : null,
      imageUrl: imageUrl || null,
    },
  });

  return NextResponse.json({ ok: true, msg });
}
