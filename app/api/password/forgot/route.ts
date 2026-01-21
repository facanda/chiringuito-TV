export const runtime = "nodejs";

import { NextResponse } from "next/server";
import crypto from "crypto";
import { prisma } from "@/lib/prisma";

function sha256(input: string) {
  return crypto.createHash("sha256").update(input).digest("hex");
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const email = String(body?.email || "").trim().toLowerCase();

  if (!email) {
    return NextResponse.json({ error: "Email requerido." }, { status: 400 });
  }

  const rawToken = crypto.randomBytes(32).toString("hex");
  const tokenHash = sha256(rawToken);
  const expiresAt = new Date(Date.now() + 1000 * 60 * 30);

  await prisma.passwordReset.deleteMany({ where: { email } });

  await prisma.passwordReset.create({
    data: { email, tokenHash, expiresAt },
  });

  const resetUrl = `/reset?token=${rawToken}&email=${encodeURIComponent(email)}`;

  return NextResponse.json({ ok: true, message: "Listo", resetUrl });
}
