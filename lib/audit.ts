import { prisma } from "@/lib/prisma";

export async function auditLog(params: {
  actorId?: string | null;
  actorEmail?: string | null;
  action: string;
  targetId?: string | null;
  target?: string | null;
  meta?: any;
  req?: Request;
}) {
  const ip =
    params.req?.headers.get("x-forwarded-for")?.split(",")?.[0]?.trim() ||
    params.req?.headers.get("x-real-ip") ||
    null;
  const userAgent = params.req?.headers.get("user-agent") || null;

  await prisma.auditLog.create({
    data: {
      actorId: params.actorId || null,
      actorEmail: params.actorEmail || null,
      action: params.action,
      targetId: params.targetId || null,
      target: params.target || null,
      meta: params.meta ? JSON.stringify(params.meta) : null,
      ip: ip || undefined,
      userAgent: userAgent || undefined,
    },
  });
}
