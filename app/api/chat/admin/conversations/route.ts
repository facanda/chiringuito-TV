import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { prisma } from "@/lib/prisma";
import { authOptions } from "@/lib/auth";

export async function GET(req: Request) {
  const session = await getServerSession(authOptions as any);
  if (!session?.user?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const role = String((session as any).role || "USER");
  if (role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const q = String(searchParams.get("q") || "").trim().toLowerCase();

  const convos = await prisma.conversation.findMany({
    where: {
      status: "OPEN",
      ...(q
        ? {
            OR: [
              { userEmail: { contains: q } },
              { userId: { contains: q } },
            ],
          }
        : {}),
    },
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      userId: true,
      userEmail: true,
      updatedAt: true,
      adminLastReadAt: true,
      messages: {
        take: 1,
        orderBy: { createdAt: "desc" },
        select: { text: true, imageUrl: true, senderRole: true, createdAt: true },
      },
    },
    take: 200,
  });

  // unread: mensajes USER posteriores a adminLastReadAt
  const result = await Promise.all(
    convos.map(async (c) => {
      const since = c.adminLastReadAt ?? new Date(0);
      const unread = await prisma.message.count({
        where: {
          conversationId: c.id,
          senderRole: "USER",
          createdAt: { gt: since },
        },
      });

      return {
        id: c.id,
        userId: c.userId,
        userEmail: c.userEmail,
        updatedAt: c.updatedAt,
        unread,
        lastMessage: c.messages[0] || null,
      };
    })
  );

  return NextResponse.json({ conversations: result });
}
