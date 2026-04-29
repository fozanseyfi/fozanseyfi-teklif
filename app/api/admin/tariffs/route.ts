import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { TariffType } from "@prisma/client";

async function checkAdmin() {
  const session = await getSession();
  return session?.role === "FIRM_ADMIN";
}

export async function GET() {
  const data = await prisma.electricityTariff.findMany({
    orderBy: { effectiveDate: "desc" },
    distinct: ["type"],
  });
  return NextResponse.json(data);
}

export async function POST(request: NextRequest) {
  if (!await checkAdmin()) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body: { type: string; unitPrice: number }[] = await request.json();
  const now = new Date();

  await prisma.$transaction(
    body.map((item) =>
      prisma.electricityTariff.create({
        data: { type: item.type as TariffType, unitPrice: item.unitPrice, effectiveDate: now, source: "Admin" },
      })
    )
  );

  return NextResponse.json({ success: true });
}
