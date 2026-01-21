// app/api/admin/users/role/route.ts
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { prisma } from "@/lib/prisma";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";

export async function POST(req: Request) {
  const session = await getServerSession(authOptions as any);
  if (!session?.user?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const role = String((session as any).role || "USER");
  if (role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json().catch(() => ({} as any));
  const userId = String(body?.userId || "").trim();
  const newRole = String(body?.role || "").trim().toUpperCase();

  if (!userId) return NextResponse.json({ error: "userId requerido" }, { status: 400 });
  if (newRole !== "ADMIN" && newRole !== "USER")
    return NextResponse.json({ error: "role inválido" }, { status: 400 });

  // (opcional) evitar que te quites tu propio admin sin querer
  const meId = String((session.user as any).id || "");
  if (meId && userId === meId && newRole !== "ADMIN") {
    return NextResponse.json({ error: "No puedes quitarte tu propio ADMIN" }, { status: 400 });
  }

  const updated = await prisma.user.update({
    where: { id: userId },
    data: { role: newRole as any },
    select: { id: true, email: true, role: true },
  });

  // (opcional) audit
  try {
    await prisma.auditLog.create({
      data: {
        actorId: meId || undefined,
        actorEmail: session.user.email || undefined,
        action: "USER_ROLE_CHANGE",
        targetId: updated.id,
        target: updated.email,
        meta: JSON.stringify({ role: updated.role }),
      },
    });
  } catch {}

  return NextResponse.json({ ok: true, user: updated });
}
