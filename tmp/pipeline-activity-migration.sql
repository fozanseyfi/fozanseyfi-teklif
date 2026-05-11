-- Sales pipeline + ProjectActivity migration
--
-- Supabase SQL Editor'da çalıştır. Idempotent — tekrar çalıştırılabilir.
--
-- 1) 3 yeni enum tip: PipelineStage, LostReason, ActivityType
-- 2) Project tablosuna: pipeline_stage, lost_reason, competitor_name
-- 3) Yeni tablo: project_activities

-- ─── 1) Enums (idempotent: yoksa oluştur) ────────────────────────────

DO $$ BEGIN
  CREATE TYPE solar."PipelineStage" AS ENUM ('SENT','UNDER_REVIEW','REVISED','WON','LOST');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE solar."LostReason" AS ENUM ('PRICE','TECHNICAL','REFERENCE','TIMING','RELATIONSHIP','OTHER');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE solar."ActivityType" AS ENUM (
    'CUSTOMER_VIEWED','CUSTOMER_ACCEPTED','CUSTOMER_REVISION','CUSTOMER_QUESTION',
    'INTERNAL_NOTE','PHONE_CALL','EMAIL_SENT','STAGE_CHANGE'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- ─── 2) Project tablosuna pipeline alanları ──────────────────────────

ALTER TABLE solar."Project"
  ADD COLUMN IF NOT EXISTS pipeline_stage  solar."PipelineStage",
  ADD COLUMN IF NOT EXISTS lost_reason     solar."LostReason",
  ADD COLUMN IF NOT EXISTS competitor_name text;

CREATE INDEX IF NOT EXISTS project_pipeline_stage_idx
  ON solar."Project"(pipeline_stage);

-- ─── 3) project_activities tablosu ───────────────────────────────────

CREATE TABLE IF NOT EXISTS solar.project_activities (
  id              text PRIMARY KEY,
  project_id      text NOT NULL REFERENCES solar."Project"(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL,
  type            solar."ActivityType" NOT NULL,
  message         text,
  actor_id        uuid,
  actor_email     text,
  actor_name      text,
  share_link_id   text REFERENCES solar.share_links(id) ON DELETE SET NULL,
  details         jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS project_activities_project_idx
  ON solar.project_activities(project_id, created_at DESC);

CREATE INDEX IF NOT EXISTS project_activities_org_idx
  ON solar.project_activities(organization_id, created_at DESC);

CREATE INDEX IF NOT EXISTS project_activities_type_idx
  ON solar.project_activities(type);
