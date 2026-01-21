import { NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request) {
  const token = await getToken({ req: req as any, secret: process.env.NEXTAUTH_SECRET });
  if (!token?.sub) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  if ((token as any).role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const url = new URL(req.url);
  const q = (url.searchParams.get("q") || "").trim().toLowerCase();
  const action = (url.searchParams.get("action") || "").trim();
  const take = Math.min(Number(url.searchParams.get("take") || "100"), 300);

  const logs = await prisma.auditLog.findMany({
    where: {
      ...(action ? { action } : {}),
      ...(q
        ? {
            OR: [
              { actorEmail: { contains: q } },
              { target: { contains: q } },
              { meta: { contains: q } },
              { action: { contains: q } },
            ],
          }
        : {}),
    },
    orderBy: { createdAt: "desc" },
    take,
  });

  return NextResponse.json({ logs });
}
