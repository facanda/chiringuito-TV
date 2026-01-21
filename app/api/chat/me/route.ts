import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { prisma } from "@/lib/prisma";
import { authOptions } from "@/lib/auth";

export async function GET() {
  const session = (await getServerSession(authOptions as any)) as any;
  const email = session?.user?.email;

  if (!email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = (session.user as any)?.id || email;

  // busca conversación abierta o crea una
  const convo =
    (await prisma.conversation.findFirst({
      where: { userId, status: "OPEN" },
      orderBy: { updatedAt: "desc" },
    })) ??
    (await prisma.conversation.create({
      data: { userId, userEmail: email, status: "OPEN" },
    }));

  return NextResponse.json({ conversationId: convo.id });
}
