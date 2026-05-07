import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

const users = await prisma.user.findMany({ include: { firm: true } });
console.log("solar.User rows:");
for (const u of users) console.log(" -", u.id, u.email, u.role, "firm:", u.firm.name);

console.log("\nfirms:", await prisma.firm.count(), "subscriptions:", await prisma.subscription.count());

await prisma.$disconnect();
