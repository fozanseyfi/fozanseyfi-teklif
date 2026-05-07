// Tek seferlik: solar.User satirinin id'sini gercek auth.users.id ile senkron et.
// register sirasinda Supabase signUp obfuscated bir id donmustu; login'de
// gercek id geldi, mismatch'i giderir.
import "dotenv/config";
import { createClient } from "@supabase/supabase-js";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);
const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

const { data: authData } = await supabase.auth.admin.listUsers();
const target = authData.users.find((u) => u.email === "fozanseyfi@gmail.com");
if (!target) {
  console.error("auth.users'ta fozanseyfi@gmail.com bulunamadi");
  process.exit(1);
}
console.log("real auth id:", target.id);

const profile = await prisma.user.findFirst({ where: { email: "fozanseyfi@gmail.com" } });
if (!profile) {
  console.log("Profile yok — sorun yok");
  await prisma.$disconnect();
  process.exit(0);
}
console.log("current profile id:", profile.id);

if (profile.id === target.id) {
  console.log("Zaten senkron, hicbir sey yapilmadi");
  await prisma.$disconnect();
  process.exit(0);
}

// Project FK'lari olabilir — onceki cleanup sonrasi 0 olmali, yine de saymadan
// once tum referanslari kontrol edelim.
const projectCount = await prisma.project.count({ where: { createdById: profile.id } });
if (projectCount > 0) {
  console.log(`UYARI: ${projectCount} proje bu User'a bagli. Cascade gerekiyor.`);
}

await prisma.user.delete({ where: { id: profile.id } });
const synced = await prisma.user.create({
  data: {
    id: target.id,
    name: profile.name,
    email: profile.email,
    role: profile.role,
    firmId: profile.firmId,
    isActive: profile.isActive,
  },
});
console.log("synced:", synced.id, synced.email);

await prisma.$disconnect();
