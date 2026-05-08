// organization_members tablosuna `platform` kolonu ekle ve mevcut satirlari
// her iki platforma duplike et.
import "dotenv/config";
import pg from "pg";

const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
await client.connect();

console.log("organization_members.platform kolonu ekleniyor...");

try {
  await client.query("BEGIN");

  // 1. Kolon ekle
  await client.query(`ALTER TABLE public.organization_members ADD COLUMN IF NOT EXISTS platform TEXT`);

  // 2. Mevcut satirlari 'karar-destek' olarak isaretle
  const r1 = await client.query(`UPDATE public.organization_members SET platform = 'karar-destek' WHERE platform IS NULL`);
  console.log(`  ${r1.rowCount} satir 'karar-destek' olarak isaretlendi`);

  // 3. NOT NULL
  await client.query(`ALTER TABLE public.organization_members ALTER COLUMN platform SET NOT NULL`);

  // 4. ESKI PK'yi DROP ET (artik (user, org) tek basina yeterli degil)
  const pk = await client.query(`
    SELECT conname FROM pg_constraint
    WHERE conrelid = 'public.organization_members'::regclass AND contype = 'p'
  `);
  if (pk.rows.length > 0) {
    const pkName = pk.rows[0].conname;
    console.log(`  Eski PK '${pkName}' drop ediliyor...`);
    await client.query(`ALTER TABLE public.organization_members DROP CONSTRAINT "${pkName}"`);
  }

  // 5. YENI PK (user_id, organization_id, platform) ekle
  console.log(`  Yeni PK (user_id, organization_id, platform) ekleniyor...`);
  await client.query(`
    ALTER TABLE public.organization_members
    ADD PRIMARY KEY (user_id, organization_id, platform)
  `);

  // 6. ARTIK 'solar-teklif' icin duplike satir ekleyebiliriz
  const r2 = await client.query(`
    INSERT INTO public.organization_members (user_id, organization_id, role, joined_at, platform)
    SELECT user_id, organization_id, role, joined_at, 'solar-teklif'
    FROM public.organization_members
    WHERE platform = 'karar-destek'
    ON CONFLICT (user_id, organization_id, platform) DO NOTHING
  `);
  console.log(`  ${r2.rowCount} satir 'solar-teklif' icin duplike edildi`);

  await client.query("COMMIT");
  console.log("\n✓ Migration BASARILI");

  const total = await client.query(`SELECT COUNT(*) FROM public.organization_members`);
  const byPlatform = await client.query(`
    SELECT platform, COUNT(*) AS cnt FROM public.organization_members GROUP BY platform ORDER BY platform
  `);
  console.log(`  Toplam satir: ${total.rows[0].count}`);
  byPlatform.rows.forEach((r) => console.log(`    ${r.platform}: ${r.cnt}`));
} catch (e) {
  await client.query("ROLLBACK");
  console.error("\n✗ HATA — rollback yapildi:", e.message);
  throw e;
} finally {
  await client.end();
}
