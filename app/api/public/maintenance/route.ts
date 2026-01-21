import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const cfg = await prisma.appConfig.findUnique({
    where: { id: 1 },
    select: { maintenanceActive: true, maintenanceMessage: true, updatedAt: true },
  });

  return NextResponse.json({
    active: cfg?.maintenanceActive ?? false,
    message: cfg?.maintenanceMessage ?? "",
    updatedAt: cfg?.updatedAt ?? null,
  });
}
