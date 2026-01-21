import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { prisma } from "@/lib/prisma";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";

function isAdmin(session: any) {
  return session && (session as any).role === "ADMIN";
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions as any);
  if (!isAdmin(session)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const message = String(body?.message || "").trim();
  const activate = body?.activate !== false; // default true

  // 1) activar mantenimiento + mensaje
  await prisma.appConfig.upsert({
    where: { id: 1 },
    create: {
      id: 1,
      maintenanceActive: activate,
      maintenanceMessage: message || "⚠️ Estamos en mantenimiento. Vuelve en unos minutos.",
    },
    update: {
      maintenanceActive: activate,
      maintenanceMessage: message || "⚠️ Estamos en mantenimiento. Vuelve en unos minutos.",
    },
  });

  // 2) Expulsar a todos los USER (NO ADMIN)
  await prisma.user.updateMany({
    where: { role: "USER" },
    data: { sessionVersion: { increment: 1 } },
  });

  return NextResponse.json({ ok: true });
}
