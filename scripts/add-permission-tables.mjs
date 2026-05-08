// Per-user kaynak yetki tablolarini ekler:
// - public.user_hidden_resources: kaynak bu user'dan tamamen gizli
// - public.user_locked_resources: kaynak bu user icin read-only
//
// Idempotent — IF NOT EXISTS ile guvenli.
import "dotenv/config";
import pg from "pg";

const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
await client.connect();

console.log("Permission tables migration basliyor...");

try {
  await client.query("BEGIN");

  console.log("[1/2] user_hidden_resources...");
  await client.query(`
    CREATE TABLE IF NOT EXISTS public.user_hidden_resources (
      user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
      resource_type text NOT NULL,
      resource_id text NOT NULL,
      organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
      hidden_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
      created_at timestamptz NOT NULL DEFAULT now(),
      PRIMARY KEY (user_id, resource_type, resource_id)
    )
  `);
  await client.query(`
    DO $$ BEGIN
      ALTER TABLE public.user_hidden_resources
        ADD CONSTRAINT uhr_resource_type_check
        CHECK (resource_type IN ('project', 'customer'));
    EXCEPTION WHEN duplicate_object THEN NULL; END $$
  `);
  await client.query(`
    CREATE INDEX IF NOT EXISTS uhr_org_idx
      ON public.user_hidden_resources (organization_id)
  `);
  await client.query(`
    CREATE INDEX IF NOT EXISTS uhr_resource_idx
      ON public.user_hidden_resources (resource_type, resource_id)
  `);

  console.log("[2/2] user_locked_resources...");
  await client.query(`
    CREATE TABLE IF NOT EXISTS public.user_locked_resources (
      user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
      resource_type text NOT NULL,
      resource_id text NOT NULL,
      organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
      locked_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
      created_at timestamptz NOT NULL DEFAULT now(),
      PRIMARY KEY (user_id, resource_type, resource_id)
    )
  `);
  await client.query(`
    DO $$ BEGIN
      ALTER TABLE public.user_locked_resources
        ADD CONSTRAINT ulr_resource_type_check
        CHECK (resource_type IN ('project', 'customer'));
    EXCEPTION WHEN duplicate_object THEN NULL; END $$
  `);
  await client.query(`
    CREATE INDEX IF NOT EXISTS ulr_org_idx
      ON public.user_locked_resources (organization_id)
  `);
  await client.query(`
    CREATE INDEX IF NOT EXISTS ulr_resource_idx
      ON public.user_locked_resources (resource_type, resource_id)
  `);

  await client.query("COMMIT");
  console.log("\nOK Permission tables hazir.");
} catch (e) {
  await client.query("ROLLBACK");
  console.error("HATA:", e.message);
  throw e;
} finally {
  await client.end();
}
