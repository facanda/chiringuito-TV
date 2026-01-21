import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { prisma } from "@/lib/prisma";
import { authOptions } from "@/lib/auth";

export async function POST(req: Request) {
  const session = await getServerSession(authOptions as any);
  if (!session?.user?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const role = String((session as any).role || "USER");
  if (role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json().catch(() => ({} as any));
  const text = String(body?.text || "").trim();
  const imageUrl = body?.imageUrl ? String(body.imageUrl) : null;

  if (!text && !imageUrl) {
    return NextResponse.json({ error: "Mensaje vacío" }, { status: 400 });
  }

  const convos = await prisma.conversation.findMany({
    where: { status: "OPEN" },
    select: { id: true, userEmail: true },
  });

  if (!convos.length) return NextResponse.json({ ok: true, sent: 0 });

  // crea un mensaje por conversación
  await prisma.$transaction(
    convos.map((c) =>
      prisma.message.create({
        data: {
          conversationId: c.id,
          senderRole: "ADMIN",
          senderEmail: session.user!.email!,
          text: text || null,
          imageUrl,
        },
      })
    )
  );

  return NextResponse.json({ ok: true, sent: convos.length });
}
