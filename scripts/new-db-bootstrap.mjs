// Yeni Supabase projesinde:
// 1. handle_new_user trigger (signup'ta otomatik profile + organization + member)
// 2. role check constraints (admin | user | viewer)
import "dotenv/config";
import pg from "pg";

const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
await client.connect();

console.log("Yeni DB bootstrap basliyor...");

try {
  await client.query("BEGIN");

  // Role check constraints
  console.log("[1/3] Role check constraints...");
  await client.query(`
    ALTER TABLE public.profiles
    ADD CONSTRAINT IF NOT EXISTS profiles_role_check
    CHECK (role IN ('admin', 'user', 'viewer'))
  `).catch((e) => {
    if (!/already exists|does not support/i.test(e.message)) throw e;
  });
  await client.query(`
    DO $$ BEGIN
      ALTER TABLE public.profiles ADD CONSTRAINT profiles_role_check CHECK (role IN ('admin', 'user', 'viewer'));
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;
  `);
  await client.query(`
    DO $$ BEGIN
      ALTER TABLE public.organization_members ADD CONSTRAINT om_role_check CHECK (role IN ('admin', 'user', 'viewer'));
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;
  `);
  await client.query(`
    DO $$ BEGIN
      ALTER TABLE public.invitations ADD CONSTRAINT inv_role_check CHECK (role IN ('admin', 'user', 'viewer'));
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;
  `);

  // handle_new_user trigger fonksiyonu
  console.log("[2/3] handle_new_user fonksiyonu...");
  await client.query(`
    CREATE OR REPLACE FUNCTION public.handle_new_user()
    RETURNS TRIGGER
    LANGUAGE plpgsql
    SECURITY DEFINER
    SET search_path TO 'public'
    AS $func$
    DECLARE
      new_org_id uuid;
      display_name text;
      invited_org_id uuid;
      invited_role text;
    BEGIN
      display_name := COALESCE(NEW.raw_user_meta_data->>'full_name', SPLIT_PART(NEW.email, '@', 1));
      invited_org_id := (NEW.raw_user_meta_data->>'invited_to_org')::uuid;

      IF invited_org_id IS NOT NULL THEN
        -- Davet edilen kullanici: davet edenin org'una uye olur
        invited_role := COALESCE(NEW.raw_user_meta_data->>'invited_role', 'user');

        INSERT INTO public.profiles (id, email, full_name, role, organization_id)
        VALUES (NEW.id, NEW.email, display_name, invited_role, invited_org_id)
        ON CONFLICT (id) DO NOTHING;

        INSERT INTO public.organization_members (user_id, organization_id, role)
        VALUES (NEW.id, invited_org_id, invited_role)
        ON CONFLICT (user_id, organization_id) DO NOTHING;
      ELSE
        -- Self signup: yeni org yarat, kullanici admin olur
        INSERT INTO public.organizations (name)
        VALUES (display_name || ' Paneli')
        RETURNING id INTO new_org_id;

        INSERT INTO public.profiles (id, email, full_name, role, organization_id, onboarding_completed)
        VALUES (NEW.id, NEW.email, display_name, 'admin', new_org_id, true)
        ON CONFLICT (id) DO NOTHING;

        INSERT INTO public.organization_members (user_id, organization_id, role)
        VALUES (NEW.id, new_org_id, 'admin')
        ON CONFLICT (user_id, organization_id) DO NOTHING;

        UPDATE public.organizations SET owner_id = NEW.id WHERE id = new_org_id;
      END IF;

      RETURN NEW;
    END;
    $func$;
  `);

  // Trigger: auth.users INSERT sonrasi handle_new_user calistir
  console.log("[3/3] Trigger ekleme...");
  await client.query(`DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users`);
  await client.query(`
    CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user()
  `);

  await client.query("COMMIT");
  console.log("\n✓ Bootstrap basarili.");
} catch (e) {
  await client.query("ROLLBACK");
  console.error("HATA:", e.message);
  throw e;
} finally {
  await client.end();
}
