import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { prisma } from "@/lib/prisma";
import { authOptions } from "@/lib/auth";

function isAdmin(session: any) {
  return session && (session as any).role === "ADMIN";
}

export async function POST(req: Request) {
  const session = (await getServerSession(authOptions as any)) as any;
  if (!isAdmin(session)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const active = Boolean(body?.active);
  const message = String(body?.message || "").trim();

  await prisma.appConfig.upsert({
    where: { id: 1 },
    create: { id: 1, maintenanceActive: active, maintenanceMessage: message },
    update: { maintenanceActive: active, maintenanceMessage: message },
  });

  // opcional: kick a todos (menos admin) si activas
  if (active) {
    await prisma.user.updateMany({
      where: { role: "USER" },
      data: { sessionVersion: { increment: 1 } },
    });
  }

  return NextResponse.json({ ok: true, active, message });
}
