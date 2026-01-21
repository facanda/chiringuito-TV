// app/api/chat/read/route.ts
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { prisma } from "@/lib/prisma";
import { authOptions } from "@/lib/auth";

export async function POST(req: Request) {
  const session = (await getServerSession(authOptions as any)) as any;
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({} as any));
  const conversationId = String(body?.conversationId || "").trim();
  if (!conversationId) {
    return NextResponse.json({ error: "conversationId requerido" }, { status: 400 });
  }

  const role = String((session as any).role || "USER");
  const sessionUserId = String((session.user as any).id || ""); // 👈 usa ID real
  const sessionEmail = String(session.user.email || "");

  const convo = await prisma.conversation.findUnique({
    where: { id: conversationId },
    select: { id: true, userId: true, userEmail: true },
  });

  if (!convo) {
    return NextResponse.json({ error: "Conversation no existe" }, { status: 404 });
  }

  // permisos:
  // - ADMIN: ok
  // - USER: solo si es el dueño (por userId; fallback por email si hiciera falta)
  const isOwner =
    (sessionUserId && convo.userId === sessionUserId) ||
    (!sessionUserId && convo.userEmail === sessionEmail);

  if (role !== "ADMIN" && !isOwner) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await prisma.conversation.update({
    where: { id: conversationId },
    data: role === "ADMIN" ? { adminLastReadAt: new Date() } : { userLastReadAt: new Date() },
  });

  return NextResponse.json({ ok: true });
}
