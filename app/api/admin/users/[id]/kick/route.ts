import { NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import { prisma } from "@/lib/prisma";
import { auditLog } from "@/lib/audit";

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const token = await getToken({ req: req as any, secret: process.env.NEXTAUTH_SECRET });
  if (!token?.sub) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  if ((token as any).role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  await prisma.user.update({
    where: { id: params.id },
    data: { sessionVersion: { increment: 1 } },
  });

  await prisma.loginSession.deleteMany({ where: { userId: params.id } });

  await auditLog({
    actorId: token.sub as string,
    actorEmail: (token as any).email || null,
    action: "USER_KICK",
    targetId: params.id,
    target: null,
    meta: {},
    req,
  });

  return NextResponse.json({ ok: true });
}
