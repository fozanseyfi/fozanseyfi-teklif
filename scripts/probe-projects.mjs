import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

const ps = await prisma.project.findMany({ select: { id: true, name: true, firmId: true, createdById: true, isTemplate: true } });
console.log("projects:", ps.length);
ps.forEach((p) => console.log(`  ${p.id} | "${p.name}" | firmId=${p.firmId} | createdBy=${p.createdById} | tmpl=${p.isTemplate}`));

await prisma.$disconnect();
