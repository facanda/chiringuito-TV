import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const row = await prisma.globalPlaylist.findFirst({
    select: { m3uText: true, updatedAt: true },
    orderBy: { updatedAt: "desc" },
  });

  return NextResponse.json({
    m3uText: row?.m3uText || "",
    updatedAt: row?.updatedAt || null,
  });
}
