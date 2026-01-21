import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { prisma } from "@/lib/prisma";
import { authOptions } from "@/lib/auth";

function isAdmin(session: any) {
  return session && String((session as any).role) === "ADMIN";
}

export async function GET() {
  try {
    const session = await getServerSession(authOptions as any);
    if (!isAdmin(session)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const convos = await prisma.conversation.findMany({
      orderBy: { updatedAt: "desc" },
      select: {
        id: true,
        userEmail: true,
        updatedAt: true,
        adminLastReadAt: true,
        messages: {
          take: 1,
          orderBy: { createdAt: "desc" },
          select: {
            text: true,
            imageUrl: true,
            createdAt: true,
            senderRole: true,
          },
        },
      },
    });

    const items = await Promise.all(
      convos.map(async (c) => {
        const last = c.messages?.[0] || null;

        // Unread para admin = mensajes USER después de adminLastReadAt
        const unreadCountForConvo = await prisma.message.count({
          where: {
            conversationId: c.id,
            senderRole: "USER",
            createdAt: { gt: c.adminLastReadAt ?? new Date(0) },
          },
        });

        return {
          id: c.id,
          userEmail: c.userEmail,
          unread: unreadCountForConvo > 0, // ✅ boolean como espera tu UI
          updatedAt: c.updatedAt.toISOString(),
          lastMessage: last
            ? {
                text: last.text || "",
                hasImage: !!last.imageUrl,
                createdAt: new Date(last.createdAt).toISOString(),
                senderRole: String(last.senderRole || ""),
              }
            : null,
        };
      })
    );

    const unreadCount = items.reduce((acc, it) => acc + (it.unread ? 1 : 0), 0);

    // ✅ esto es lo que tu RightToolbar espera:
    // data.items + data.unreadCount
    return NextResponse.json({ items, unreadCount });
  } catch (e: any) {
    console.error("admin/conversations error:", e);
    return NextResponse.json({ error: e?.message || "Server error" }, { status: 500 });
  }
}
