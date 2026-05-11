-- Public Share Links tablosu (solar.share_links)
--
-- Supabase SQL Editor'da çalıştır. Idempotent — tekrar çalıştırılabilir.
--
-- Yönetici tab'leri seçer + süre verir → token üretilir → /share/<token>
-- public sayfasından müşteri/yatırımcı erişir. Revoked veya expired olunca
-- public sayfa 404 döner ama satır audit/forensic için DB'de kalır.

CREATE TABLE IF NOT EXISTS solar.share_links (
  id              text PRIMARY KEY,
  token           text UNIQUE NOT NULL,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  project_id      text NOT NULL REFERENCES solar."Project"(id) ON DELETE CASCADE,
  created_by_id   uuid NOT NULL,
  customer_label  text,
  included_tabs   jsonb NOT NULL,
  expires_at      timestamptz,
  view_count      integer NOT NULL DEFAULT 0,
  last_viewed_at  timestamptz,
  revoked_at      timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS share_links_org_created_idx
  ON solar.share_links(organization_id, created_at DESC);

CREATE INDEX IF NOT EXISTS share_links_project_idx
  ON solar.share_links(project_id);
