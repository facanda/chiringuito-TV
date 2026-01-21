import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { prisma } from "@/lib/prisma";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";

function isAdmin(session: any) {
  return String(session?.role || "").toUpperCase() === "ADMIN";
}

export async function GET() {
  const session = await getServerSession(authOptions as any);
  if (!session?.user?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isAdmin(session)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const users = await prisma.user.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      isBlocked: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  // normaliza role enum a string (ADMIN/USER)
  const items = users.map((u) => ({
    ...u,
    role: String((u as any).role) as "ADMIN" | "USER",
  }));

  return NextResponse.json({ items });
}

export async function PATCH(req: Request) {
  const session = await getServerSession(authOptions as any);
  if (!session?.user?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isAdmin(session)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json().catch(() => ({} as any));
  const userId = String(body?.userId || "").trim();
  const role = String(body?.role || "").trim().toUpperCase();

  if (!userId) return NextResponse.json({ error: "userId requerido" }, { status: 400 });
  if (role !== "ADMIN" && role !== "USER") {
    return NextResponse.json({ error: "role inválido (ADMIN | USER)" }, { status: 400 });
  }

  // (opcional) evita que el admin se quite a sí mismo:
  const myId = String((session.user as any).id || "");
  if (myId && myId === userId) {
    return NextResponse.json({ error: "No puedes cambiar tu propio rol aquí." }, { status: 400 });
  }

  const updated = await prisma.user.update({
    where: { id: userId },
    data: { role: role as any },
    select: { id: true, email: true, role: true },
  });

  return NextResponse.json({
    ok: true,
    user: { ...updated, role: String((updated as any).role) },
  });
}
