import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";

async function checkAdmin() {
  const session = await getSession();
  if (!session || session.role !== "FIRM_ADMIN") return false;
  return true;
}

export async function GET() {
  if (!await checkAdmin()) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const data = await prisma.referencePriceTable.findMany({ orderBy: [{ installationType: "asc" }, { powerKw: "asc" }] });
  return NextResponse.json(data);
}

export async function POST(request: NextRequest) {
  if (!await checkAdmin()) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await request.json();
  const now = new Date();

  await prisma.$transaction(
    body.map((item: any) =>
      item.id
        ? prisma.referencePriceTable.update({
            where: { id: item.id },
            data: { powerKw: item.powerKw, installationType: item.installationType, pricePerKw: item.pricePerKw, notes: item.notes ?? null, validFrom: now },
          })
        : prisma.referencePriceTable.create({
            data: { powerKw: item.powerKw, installationType: item.installationType, pricePerKw: item.pricePerKw, notes: item.notes ?? null, validFrom: now },
          })
    )
  );

  return NextResponse.json({ success: true });
}
