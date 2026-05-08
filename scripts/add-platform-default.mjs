// organization_members.platform icin DEFAULT 'karar-destek' set et.
// Karardestek'in handle_new_user trigger'i platform kolonunu bilmedigi icin
// NULL gonderiyor — DEFAULT verince trigger eski semantigi ile calisir
// (yeni user kendi org'una 'karar-destek' uyeligi alir). Solar Teklif tarafi
// ensureProfile fallback'i ile 'solar-teklif' uyeligini sonradan ekler.
import "dotenv/config";
import pg from "pg";

const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
await client.connect();

await client.query(`
  ALTER TABLE public.organization_members
  ALTER COLUMN platform SET DEFAULT 'karar-destek'
`);

console.log("✓ DEFAULT 'karar-destek' set edildi.");

const r = await client.query(`
  SELECT column_default
  FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'organization_members' AND column_name = 'platform'
`);
console.log("Mevcut DEFAULT:", r.rows[0]?.column_default ?? "(yok)");

await client.end();
