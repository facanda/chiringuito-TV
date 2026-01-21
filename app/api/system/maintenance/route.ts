import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const cfg = await prisma.appConfig.findUnique({
      where: { id: 1 },
      select: { maintenanceActive: true, maintenanceMessage: true, updatedAt: true },
    });

    return NextResponse.json({
      active: Boolean(cfg?.maintenanceActive),
      message: String(cfg?.maintenanceMessage || ""),
      updatedAt: cfg?.updatedAt || null,
    });
  } catch (e) {
    return NextResponse.json({ active: false, message: "" });
  }
}
