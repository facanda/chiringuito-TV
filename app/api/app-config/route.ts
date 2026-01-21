import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const cfg = await prisma.appConfig.upsert({
    where: { id: 1 },
    create: { id: 1, maintenanceActive: false, maintenanceMessage: "" },
    update: {},
    select: { maintenanceActive: true, maintenanceMessage: true, updatedAt: true },
  });

  return NextResponse.json(cfg);
}
