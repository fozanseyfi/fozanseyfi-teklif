// handle_new_user trigger'inda on conflict (user_id, organization_id) clause'u
// eski PK'yi referans aliyor; yeni PK (user_id, organization_id, platform).
// Trigger'i her iki platform icin uyelik insert'leyecek sekilde guncelle.
import "dotenv/config";
import pg from "pg";

const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
await client.connect();

const sql = `
CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  invited_org_id uuid;
  invited_role user_role;
  new_org_id uuid;
  display_name text;
begin
  display_name := coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1));
  invited_org_id := (new.raw_user_meta_data->>'invited_org_id')::uuid;

  if invited_org_id is not null then
    invited_role := coalesce((new.raw_user_meta_data->>'invited_role')::user_role, 'user'::user_role);

    insert into public.profiles (id, email, full_name, role, organization_id)
    values (new.id, new.email, display_name, invited_role, invited_org_id)
    on conflict (id) do nothing;

    -- Davet uyeligi her iki platforma da default olarak eklenir; her platform
    -- kendi tarafinda gerekirse role'u guncelleyebilir.
    insert into public.organization_members (user_id, organization_id, role, platform)
    values
      (new.id, invited_org_id, invited_role, 'karar-destek'),
      (new.id, invited_org_id, invited_role, 'solar-teklif')
    on conflict (user_id, organization_id, platform) do nothing;
  else
    insert into organizations (name) values (display_name || ' Paneli') returning id into new_org_id;

    insert into public.profiles (id, email, full_name, role, organization_id)
    values (new.id, new.email, display_name, 'admin'::user_role, new_org_id)
    on conflict (id) do nothing;

    -- Yeni signup'in kendi org'una owner-admin uyeligi her iki platformda
    insert into public.organization_members (user_id, organization_id, role, platform)
    values
      (new.id, new_org_id, 'admin'::user_role, 'karar-destek'),
      (new.id, new_org_id, 'admin'::user_role, 'solar-teklif')
    on conflict (user_id, organization_id, platform) do nothing;

    update organizations set owner_id = new.id where id = new_org_id;
  end if;

  return new;
end;
$function$;
`;

await client.query(sql);
console.log("✓ handle_new_user trigger guncellendi (yeni PK ile uyumlu).");

await client.end();
