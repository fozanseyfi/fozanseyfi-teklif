-- Audit Log tablosu (solar.audit_logs)
--
-- Supabase SQL Editor'da çalıştır. Idempotent — tekrar çalıştırılabilir.

CREATE TABLE IF NOT EXISTS solar.audit_logs (
  id              text PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  actor_id        uuid,
  actor_email     text,
  actor_name      text,
  action          text NOT NULL,
  resource_type   text NOT NULL,
  resource_id     text,
  resource_name   text,
  details         jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS audit_logs_org_created_idx
  ON solar.audit_logs(organization_id, created_at DESC);

CREATE INDEX IF NOT EXISTS audit_logs_actor_idx
  ON solar.audit_logs(actor_id);

CREATE INDEX IF NOT EXISTS audit_logs_resource_idx
  ON solar.audit_logs(resource_type, resource_id);
