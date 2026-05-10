-- Marka Ayarları (Organization.brandSettings JSON kolonu)
--
-- Supabase SQL Editor'da çalıştır (Database → SQL Editor → New query → Run).
-- Bir defa çalışır, sonra deploy push'ladığında uygulama hazır.

-- 1) Organization tablosuna brand_settings JSONB kolonu (idempotent)
ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS brand_settings JSONB NOT NULL DEFAULT '{}'::jsonb;

-- 2) Logo dosyaları için Storage bucket (public-read)
INSERT INTO storage.buckets (id, name, public)
VALUES ('brand-logos', 'brand-logos', true)
ON CONFLICT (id) DO NOTHING;

-- 3) Bucket policy'leri — PostgreSQL CREATE POLICY IF NOT EXISTS desteklemediği
--    için drop-then-create ile idempotent. Tekrar çalıştırılabilir.

DROP POLICY IF EXISTS "Public read brand-logos" ON storage.objects;
CREATE POLICY "Public read brand-logos"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'brand-logos');

DROP POLICY IF EXISTS "Auth users insert brand-logos" ON storage.objects;
CREATE POLICY "Auth users insert brand-logos"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'brand-logos');

DROP POLICY IF EXISTS "Auth users update brand-logos" ON storage.objects;
CREATE POLICY "Auth users update brand-logos"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'brand-logos');

DROP POLICY IF EXISTS "Auth users delete brand-logos" ON storage.objects;
CREATE POLICY "Auth users delete brand-logos"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'brand-logos');
