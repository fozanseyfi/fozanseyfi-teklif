// Tek seferlik: Firm.name sonundaki " (Otomatik)" suffix'ini temizler.
// Eski auto-onboard kodu firma adina bu suffix'i ekliyordu, yeni kodda kaldirildi.
import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

const firms = await prisma.firm.findMany({
  where: { name: { endsWith: " (Otomatik)" } },
});
console.log(`'(Otomatik)' suffix'i tasiyan ${firms.length} firma bulundu.`);

for (const f of firms) {
  const cleaned = f.name.replace(/ \(Otomatik\)$/, "").trim();
  await prisma.firm.update({ where: { id: f.id }, data: { name: cleaned } });
  console.log(`  ${f.id}: "${f.name}" -> "${cleaned}"`);
}

await prisma.$disconnect();
