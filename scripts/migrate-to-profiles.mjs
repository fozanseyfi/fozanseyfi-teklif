// Karardestek pattern'ine geciste tek seferlik migration:
// solar.User -> public.profiles, solar.Firm -> public.organizations.
// Project.firmId/createdById ve Subscription.firmId guncellenir.
import "dotenv/config";
import pg from "pg";

const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
await client.connect();

console.log("Migration başlıyor...");

try {
  await client.query("BEGIN");

  // 1. Mevcut firmId -> organization_id mapping (User'in profile.org_id'si uzerinden)
  console.log("\n[1/9] Project.organization_id kolonu ekleniyor...");
  await client.query(`ALTER TABLE solar."Project" ADD COLUMN IF NOT EXISTS organization_id uuid`);

  console.log("[2/9] Project.organization_id backfill...");
  const r1 = await client.query(`
    UPDATE solar."Project" p
    SET organization_id = pr.organization_id
    FROM public.profiles pr
    WHERE p."createdById" = pr.id::text
      AND p.organization_id IS NULL
  `);
  console.log(`  ${r1.rowCount} project guncellendi`);

  const nullCheck = await client.query(`SELECT COUNT(*) FROM solar."Project" WHERE organization_id IS NULL`);
  if (parseInt(nullCheck.rows[0].count) > 0) {
    throw new Error(`${nullCheck.rows[0].count} Project hala organization_id'siz — migration durduruluyor`);
  }

  console.log("[3/9] Project.organization_id NOT NULL + FK...");
  await client.query(`ALTER TABLE solar."Project" ALTER COLUMN organization_id SET NOT NULL`);
  await client.query(`
    ALTER TABLE solar."Project"
      ADD CONSTRAINT "Project_organization_id_fkey"
        FOREIGN KEY (organization_id)
        REFERENCES public.organizations(id)
        ON DELETE CASCADE
  `);

  console.log("[4/9] Subscription.organization_id kolonu + backfill...");
  await client.query(`ALTER TABLE solar."Subscription" ADD COLUMN IF NOT EXISTS organization_id uuid`);
  const r2 = await client.query(`
    UPDATE solar."Subscription" s
    SET organization_id = pr.organization_id
    FROM solar."User" u
    JOIN public.profiles pr ON pr.id::text = u.id
    WHERE u."firmId" = s."firmId"
      AND s.organization_id IS NULL
  `);
  console.log(`  ${r2.rowCount} subscription guncellendi`);

  console.log("[5/9] Subscription.organization_id NOT NULL + UNIQUE + FK...");
  await client.query(`ALTER TABLE solar."Subscription" ALTER COLUMN organization_id SET NOT NULL`);
  await client.query(`
    ALTER TABLE solar."Subscription"
      ADD CONSTRAINT "Subscription_organization_id_key" UNIQUE (organization_id)
  `);
  await client.query(`
    ALTER TABLE solar."Subscription"
      ADD CONSTRAINT "Subscription_organization_id_fkey"
        FOREIGN KEY (organization_id)
        REFERENCES public.organizations(id)
        ON DELETE CASCADE
  `);

  console.log("[6/9] Project.createdById tipini text -> uuid'ye donustur...");
  await client.query(`ALTER TABLE solar."Project" DROP CONSTRAINT IF EXISTS "Project_createdById_fkey"`);
  await client.query(`ALTER TABLE solar."Project" ALTER COLUMN "createdById" TYPE uuid USING "createdById"::uuid`);
  await client.query(`
    ALTER TABLE solar."Project"
      ADD CONSTRAINT "Project_createdById_fkey"
        FOREIGN KEY ("createdById")
        REFERENCES public.profiles(id)
        ON DELETE NO ACTION
  `);

  console.log("[7/9] firmId kolonlari ve FK'lari kaldir...");
  // FK constraint kaldir, sonra kolonu kaldir
  await client.query(`ALTER TABLE solar."Project" DROP CONSTRAINT IF EXISTS "Project_firmId_fkey"`);
  await client.query(`ALTER TABLE solar."Project" DROP COLUMN IF EXISTS "firmId"`);
  await client.query(`ALTER TABLE solar."Subscription" DROP CONSTRAINT IF EXISTS "Subscription_firmId_fkey"`);
  await client.query(`ALTER TABLE solar."Subscription" DROP COLUMN IF EXISTS "firmId"`);

  console.log("[8/9] solar.User, solar.Firm, solar.InviteToken kaldir...");
  await client.query(`DROP TABLE IF EXISTS solar."InviteToken" CASCADE`);
  await client.query(`DROP TABLE IF EXISTS solar."User" CASCADE`);
  await client.query(`DROP TABLE IF EXISTS solar."Firm" CASCADE`);

  console.log("[9/9] UserRole enum kaldir...");
  await client.query(`DROP TYPE IF EXISTS solar."UserRole"`);

  await client.query("COMMIT");
  console.log("\n✓ Migration BASARILI");

  // Validation
  const projects = await client.query(`SELECT COUNT(*) FROM solar."Project"`);
  const subs = await client.query(`SELECT COUNT(*) FROM solar."Subscription"`);
  console.log(`  Project: ${projects.rows[0].count} satir`);
  console.log(`  Subscription: ${subs.rows[0].count} satir`);
} catch (e) {
  await client.query("ROLLBACK");
  console.error("\n✗ HATA — rollback yapildi:", e.message);
  throw e;
} finally {
  await client.end();
}
