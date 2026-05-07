// Bir kez kullanilacak — solar schema'sindaki tum domain kayitlarini temizler.
// Supabase Auth migration'i sonrasinda eski test verisini sifirlar.
import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

console.log("before:", {
  users: await prisma.user.count(),
  firms: await prisma.firm.count(),
  projects: await prisma.project.count(),
  subscriptions: await prisma.subscription.count(),
  inviteTokens: await prisma.inviteToken.count(),
});

await prisma.subscription.deleteMany();
await prisma.project.deleteMany();
await prisma.inviteToken.deleteMany();
await prisma.user.deleteMany();
await prisma.firm.deleteMany();

console.log("after:", {
  users: await prisma.user.count(),
  firms: await prisma.firm.count(),
  projects: await prisma.project.count(),
  subscriptions: await prisma.subscription.count(),
  inviteTokens: await prisma.inviteToken.count(),
});

await prisma.$disconnect();
