import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { prisma } from "@/lib/prisma";
import { authOptions } from "@/lib/auth";

function isAdmin(session: any) {
  return session && (session as any).role === "ADMIN";
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions as any);
  if (!isAdmin(session)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const conversationId = String(body?.conversationId || "").trim();
  if (!conversationId) return NextResponse.json({ error: "conversationId requerido" }, { status: 400 });

  await prisma.conversation.update({
    where: { id: conversationId },
    data: { status: "CLOSED", updatedAt: new Date() },
  });

  return NextResponse.json({ ok: true });
}
