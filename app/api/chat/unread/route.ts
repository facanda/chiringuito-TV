// app/api/chat/unread/route.ts
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { prisma } from "@/lib/prisma";
import { authOptions } from "@/lib/auth";

export async function GET() {
  const session = await getServerSession(authOptions as any);
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = (session.user as any).id || session.user.email;
  const role = String((session as any).role || "USER");

  // Este endpoint es para el USER (mensajes del ADMIN no leídos)
  if (role === "ADMIN") {
    return NextResponse.json({ unreadCount: 0, unread: 0 });
  }

  // 1) busca conversación abierta del user
  const convo = await prisma.conversation.findFirst({
    where: { userId: String(userId), status: "OPEN" },
    orderBy: { updatedAt: "desc" },
    select: { id: true, userLastReadAt: true },
  });

  if (!convo) return NextResponse.json({ unreadCount: 0, unread: 0 });

  // 2) cuenta mensajes del ADMIN después de la última lectura del user
  const since = convo.userLastReadAt ?? new Date(0);

  const unreadCount = await prisma.message.count({
    where: {
      conversationId: convo.id,
      senderRole: "ADMIN",
      createdAt: { gt: since },
    },
  });

  return NextResponse.json({ unreadCount, unread: unreadCount });
}
