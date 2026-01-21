import { getToken } from "next-auth/jwt";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function requireAdmin(req: Request) {
  const token = await getToken({ req: req as any, secret: process.env.NEXTAUTH_SECRET });

  if (!token?.sub) {
    return { ok: false as const, res: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }

  // ✅ Validación real: DB manda (no el JWT)
  const user = await prisma.user.findUnique({
    where: { id: String(token.sub) },
    select: { id: true, email: true, role: true, isBlocked: true },
  });

  if (!user || user.isBlocked) {
    return { ok: false as const, res: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }

  if (user.role !== "ADMIN") {
    return { ok: false as const, res: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }

  return { ok: true as const, token, user };
}
