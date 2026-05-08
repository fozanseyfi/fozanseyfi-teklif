// public.invitations tablosunu olustur (paylasilan, platform kolonu ile).
// Karardestek de bu tabloyu kullanacak — platform = 'karar-destek' filtresi ile.
import "dotenv/config";
import pg from "pg";

const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
await client.connect();

console.log("invitations tablosu olusturuluyor...");

try {
  await client.query("BEGIN");

  await client.query(`
    CREATE TABLE IF NOT EXISTS public.invitations (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      email TEXT NOT NULL,
      role TEXT NOT NULL,
      organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
      platform TEXT NOT NULL,
      token TEXT NOT NULL UNIQUE,
      expires_at TIMESTAMPTZ NOT NULL,
      invited_by uuid REFERENCES public.profiles(id),
      accepted_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);

  await client.query(`CREATE INDEX IF NOT EXISTS invitations_organization_platform_idx ON public.invitations (organization_id, platform)`);
  await client.query(`CREATE INDEX IF NOT EXISTS invitations_email_idx ON public.invitations (email)`);
  await client.query(`CREATE INDEX IF NOT EXISTS invitations_pending_idx ON public.invitations (organization_id, platform) WHERE accepted_at IS NULL`);

  await client.query("COMMIT");
  console.log("✓ Tablo olusturuldu.");

  const cols = await client.query(`
    SELECT column_name, data_type FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'invitations'
    ORDER BY ordinal_position
  `);
  console.log("\ninvitations columns:");
  cols.rows.forEach((r) => console.log(`  ${r.column_name} : ${r.data_type}`));
} catch (e) {
  await client.query("ROLLBACK");
  console.error("HATA:", e.message);
  throw e;
} finally {
  await client.end();
}
