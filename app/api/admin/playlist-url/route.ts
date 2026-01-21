import { NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import { prisma } from "@/lib/prisma";

function buildM3UUrl(input: {
  url?: string;
  baseUrl?: string;
  username?: string;
  password?: string;
  output?: "ts" | "m3u8";
}) {
  if (input.url && input.url.trim()) return input.url.trim();

  const base = (input.baseUrl || "").trim().replace(/\/+$/, "");
  const username = (input.username || "").trim();
  const password = (input.password || "").trim();
  const output = (input.output || "ts").trim();

  if (!base || !username || !password) return "";

  const u = new URL(base + "/get.php");
  u.searchParams.set("username", username);
  u.searchParams.set("password", password);
  u.searchParams.set("type", "m3u_plus");
  u.searchParams.set("output", output);

  return u.toString();
}

function parseCounts(m3uText: string) {
  const lines = m3uText.split(/\r?\n/);
  let channels = 0;
  const groups = new Set<string>();
  let lastExtinf = "";

  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;

    if (line.startsWith("#EXTINF")) {
      lastExtinf = line;
      const m = line.match(/group-title="([^"]*)"/i);
      if (m?.[1]) groups.add(m[1].trim() || "Otros");
      continue;
    }

    if (lastExtinf && !line.startsWith("#")) {
      channels += 1;
      lastExtinf = "";
    }
  }

  return { channels, groupsCount: groups.size };
}

export async function POST(req: Request) {
  try {
    const token = await getToken({
      req: req as any,
      secret: process.env.NEXTAUTH_SECRET,
    });

    if ((token as any)?.role !== "ADMIN") {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));

    const url = buildM3UUrl({
      url: body?.url,
      baseUrl: body?.baseUrl,
      username: body?.username,
      password: body?.password,
      output: body?.output,
    });

    if (!url) {
      return NextResponse.json(
        { error: "Falta url o (baseUrl, username, password)." },
        { status: 400 }
      );
    }

    let parsed: URL;
    try {
      parsed = new URL(url);
    } catch {
      return NextResponse.json({ error: "URL inválida." }, { status: 400 });
    }

    if (!["http:", "https:"].includes(parsed.protocol)) {
      return NextResponse.json(
        { error: "Solo se permite http/https." },
        { status: 400 }
      );
    }

    // ✅ Descarga server-side con timeout
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20000);

    let m3uText = "";
    let statusCode = 0;

    try {
      const res = await fetch(url, {
        method: "GET",
        cache: "no-store",
        signal: controller.signal,
        headers: {
          "User-Agent": "Mozilla/5.0 IPTV-Legal-App",
          Accept: "*/*",
        },
      });

      statusCode = res.status;

      if (!res.ok) {
        const t = await res.text().catch(() => "");
        return NextResponse.json(
          {
            error: `No se pudo descargar M3U. HTTP ${res.status}`,
            details: t?.slice(0, 300) || "",
          },
          { status: 400 }
        );
      }

      m3uText = await res.text();
    } catch (e: any) {
      const msg =
        e?.name === "AbortError"
          ? "Timeout descargando el M3U (20s)."
          : "Error de red descargando el M3U.";
      return NextResponse.json(
        { error: msg, extra: String(e?.message || e || "") },
        { status: 500 }
      );
    } finally {
      clearTimeout(timeout);
    }

    if (!m3uText.trim()) {
      return NextResponse.json(
        { error: "Respuesta vacía (no llegó texto M3U)." },
        { status: 400 }
      );
    }

    // algunos proveedores no mandan #EXTM3U al inicio pero igual es válido,
    // pero si NO hay EXTINF, no sirve
    if (!m3uText.includes("#EXTINF")) {
      return NextResponse.json(
        {
          error: "La respuesta no parece un M3U válido (#EXTINF no encontrado).",
          preview: m3uText.slice(0, 200),
          httpStatus: statusCode,
        },
        { status: 400 }
      );
    }

    // ✅ Guardar global en DB
    if (!prisma?.playlist) {
      // esto atrapa el clásico "prisma.playlist undefined"
      return NextResponse.json(
        {
          error: "Prisma Client no tiene el modelo Playlist (prisma.playlist undefined).",
          hint: "Revisa lib/prisma export y que el schema tenga model Playlist + npx prisma generate.",
        },
        { status: 500 }
      );
    }

    const saved = await prisma.playlist.upsert({
      where: { userId: "GLOBAL" },
      create: { userId: "GLOBAL", m3uText },
      update: { m3uText },
      select: { updatedAt: true },
    });

    const counts = parseCounts(m3uText);

    return NextResponse.json({
      ok: true,
      updatedAt: saved.updatedAt,
      ...counts,
    });
  } catch (e: any) {
    // ✅ Log real al CMD
    console.error("playlist-url ERROR:", e);
    return NextResponse.json(
      { error: "Error interno en /api/admin/playlist-url", extra: String(e?.message || e || "") },
      { status: 500 }
    );
  }
}
