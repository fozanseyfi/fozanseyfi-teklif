-- RLS politikaları — eksik tablolar
--
-- İlk RLS migration'ında ana tabloları kapsadık (Project, ShareLink,
-- AuditLog, ProjectDetail, ProjectActivity, organizations, vb.).
-- Supabase Security Advisor solar şemasındaki yardımcı tablolarda da
-- RLS açık olmadığını bildiriyor. Bu migration onları da kapatır.
--
-- Idempotent: tekrar çalıştırılabilir.
--
-- Mantık:
-- - PricingSnapshot, EquipmentItem, CostItem, Proposal: projectId üzerinden
--   Project tablosuna join + is_org_member kontrolü.
-- - Subscription: organizationId üzerinden.
-- - ReferencePriceTable, ElectricityTariff, PlatformSettings: ortak referans
--   tabloları, tüm giriş yapmış kullanıcılara okunabilir (read-only).
--   Hassas veri içermez (sadece kamuya açık kur/fiyat referansları).

-- ─── 1) solar.PricingSnapshot ─────────────────────────────────────────

ALTER TABLE solar."PricingSnapshot" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS ps_member ON solar."PricingSnapshot";
CREATE POLICY ps_member ON solar."PricingSnapshot"
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM solar."Project" p
      WHERE p.id = solar."PricingSnapshot"."projectId"
        AND public.is_org_member(p.organization_id)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM solar."Project" p
      WHERE p.id = solar."PricingSnapshot"."projectId"
        AND public.is_org_member(p.organization_id)
    )
  );

-- ─── 2) solar.EquipmentItem ───────────────────────────────────────────

ALTER TABLE solar."EquipmentItem" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS ei_member ON solar."EquipmentItem";
CREATE POLICY ei_member ON solar."EquipmentItem"
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM solar."Project" p
      WHERE p.id = solar."EquipmentItem"."projectId"
        AND public.is_org_member(p.organization_id)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM solar."Project" p
      WHERE p.id = solar."EquipmentItem"."projectId"
        AND public.is_org_member(p.organization_id)
    )
  );

-- ─── 3) solar.CostItem ────────────────────────────────────────────────

ALTER TABLE solar."CostItem" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS ci_member ON solar."CostItem";
CREATE POLICY ci_member ON solar."CostItem"
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM solar."Project" p
      WHERE p.id = solar."CostItem"."projectId"
        AND public.is_org_member(p.organization_id)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM solar."Project" p
      WHERE p.id = solar."CostItem"."projectId"
        AND public.is_org_member(p.organization_id)
    )
  );

-- ─── 4) solar.Proposal ────────────────────────────────────────────────

ALTER TABLE solar."Proposal" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS prop_member ON solar."Proposal";
CREATE POLICY prop_member ON solar."Proposal"
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM solar."Project" p
      WHERE p.id = solar."Proposal"."projectId"
        AND public.is_org_member(p.organization_id)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM solar."Project" p
      WHERE p.id = solar."Proposal"."projectId"
        AND public.is_org_member(p.organization_id)
    )
  );

-- ─── 5) solar.Subscription — organizationId üzerinden ────────────────

ALTER TABLE solar."Subscription" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS sub_member_read ON solar."Subscription";
CREATE POLICY sub_member_read ON solar."Subscription"
  FOR SELECT TO authenticated
  USING (public.is_org_member(organization_id));
DROP POLICY IF EXISTS sub_admin_write ON solar."Subscription";
CREATE POLICY sub_admin_write ON solar."Subscription"
  FOR ALL TO authenticated
  USING (public.is_org_admin(organization_id))
  WITH CHECK (public.is_org_admin(organization_id));

-- ─── 6) solar.ReferencePriceTable — herkese okunabilir referans ───────

ALTER TABLE solar."ReferencePriceTable" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS rpt_read ON solar."ReferencePriceTable";
CREATE POLICY rpt_read ON solar."ReferencePriceTable"
  FOR SELECT TO authenticated
  USING (true);

-- ─── 7) solar.ElectricityTariff — herkese okunabilir referans ─────────

ALTER TABLE solar."ElectricityTariff" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS et_read ON solar."ElectricityTariff";
CREATE POLICY et_read ON solar."ElectricityTariff"
  FOR SELECT TO authenticated
  USING (true);

-- ─── 8) solar.PlatformSettings — sadece authenticated okuyabilir ─────

ALTER TABLE solar."PlatformSettings" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS plat_read ON solar."PlatformSettings";
CREATE POLICY plat_read ON solar."PlatformSettings"
  FOR SELECT TO authenticated
  USING (true);

-- ──────────────────────────────────────────────────────────────────────
-- Migration sonrası: Supabase Studio → Database → Tables → her tablonun
-- Policies sekmesinde 1+ policy görmelisin. Supabase Advisor uyarıları
-- birkaç dakika içinde otomatik temizlenir (cache yenilenince).
-- ──────────────────────────────────────────────────────────────────────
