import { NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import { prisma } from "@/lib/prisma";
import { auditLog } from "@/lib/audit";

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const token = await getToken({ req: req as any, secret: process.env.NEXTAUTH_SECRET });
  if (!token?.sub) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  if ((token as any).role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const isBlocked = Boolean(body?.isBlocked);

  const user = await prisma.user.update({
    where: { id: params.id },
    data: {
      isBlocked,
      // invalida sesión actual inmediatamente
      sessionVersion: { increment: 1 },
    },
    select: { id: true, email: true, isBlocked: true },
  });

  await auditLog({
    actorId: token.sub as string,
    actorEmail: (token as any).email || null,
    action: isBlocked ? "USER_BLOCK" : "USER_UNBLOCK",
    targetId: user.id,
    target: user.email,
    meta: { isBlocked },
    req,
  });

  return NextResponse.json({ ok: true, user });
}
