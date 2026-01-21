import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import path from "path";
import fs from "fs/promises";

export const runtime = "nodejs"; // importante para fs

function safeName(name: string) {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_");
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions as any);
  if (!session?.user?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const form = await req.formData();
  const file = form.get("file");

  if (!file || !(file instanceof File)) {
    return NextResponse.json({ error: "Archivo requerido (file)" }, { status: 400 });
  }

  // ✅ valida tipo (solo imágenes)
  if (!file.type.startsWith("image/")) {
    return NextResponse.json({ error: "Solo imágenes" }, { status: 400 });
  }

  // ✅ límite (ej: 4MB)
  const MAX = 4 * 1024 * 1024;
  if (file.size > MAX) {
    return NextResponse.json({ error: "Imagen muy grande (máx 4MB)" }, { status: 400 });
  }

  const buf = Buffer.from(await file.arrayBuffer());

  // destino
  const dir = path.join(process.cwd(), "public", "chat_uploads");
  await fs.mkdir(dir, { recursive: true });

  const ext = safeName(path.extname(file.name || "")) || ".png";
  const base = safeName(path.basename(file.name || "image", ext));

  const stamp = Date.now().toString(36);
  const filename = `${base}-${stamp}${ext}`;
  const full = path.join(dir, filename);

  await fs.writeFile(full, buf);

  // URL pública
  const url = `/chat_uploads/${filename}`;

  return NextResponse.json({ ok: true, url });
}
