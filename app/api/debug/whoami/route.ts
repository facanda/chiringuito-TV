export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request) {
  const token = await getToken({ req: req as any, secret: process.env.NEXTAUTH_SECRET });

  if (!token?.sub) {
    return NextResponse.json({ ok: false, error: "NO_TOKEN" }, { status: 401 });
  }

  const dbUser = await prisma.user.findUnique({
    where: { id: String(token.sub) },
    select: { id: true, email: true, role: true, isBlocked: true },
  });

  return NextResponse.json({
    ok: true,
    token: {
      sub: token.sub,
      email: (token as any).email || token.email,
      role: (token as any).role,
      sv: (token as any).sv,
    },
    dbUser,
  });
}
