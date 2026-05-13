-- Row-Level Security (RLS) politikaları
--
-- Defansif derinlik: uygulama katmanı (Prisma/Next.js) zaten organizationId
-- ile filtreliyor. Ama service_role anahtarı sızarsa veya bir Prisma sorgusunda
-- where filter unutulursa RLS politikaları ikinci savunma hattıdır.
--
-- Önemli: Bu app Prisma + DATABASE_URL üzerinden veritabanına bağlanıyor.
-- Prisma superuser (postgres) rolü kullanır ve RLS'yi BYPASS eder. Bu nedenle
-- RLS politikaları şu durumdan korur:
--   1. Birisi anon/authenticated Supabase anahtarıyla REST/SDK'dan erişmeye
--      çalışırsa (örn. açık client tarafı kodda anahtar sızması).
--   2. Bir authenticated kullanıcı kendi org'u dışındaki tabloya erişmeye
--      çalışırsa Supabase SDK üzerinden.
--
-- Bu, service_role veya DATABASE_URL sızarsa korumaz. Onlar için Vercel env
-- vars güvenliği + Supabase Vault önerilir.
--
-- Idempotent: tekrar çalıştırılabilir (DROP POLICY IF EXISTS pattern).

-- ─── 1) Helper function — kullanıcı belirli org'a üye mi? ─────────────
-- SECURITY DEFINER: kendi sahiplik haklarıyla çalışır, organization_members
-- üstündeki RLS'yi atlatır → infinite recursion önlenmiş olur.

CREATE OR REPLACE FUNCTION public.is_org_member(org_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.organization_members
    WHERE user_id = auth.uid() AND organization_id = org_id
  );
$$;

CREATE OR REPLACE FUNCTION public.is_org_admin(org_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.organization_members
    WHERE user_id = auth.uid() AND organization_id = org_id AND role = 'admin'
  );
$$;

-- ─── 2) public.organizations — kendi org'unu gör ──────────────────────

ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS org_select ON public.organizations;
CREATE POLICY org_select ON public.organizations
  FOR SELECT TO authenticated
  USING (public.is_org_member(id));
DROP POLICY IF EXISTS org_update_admin ON public.organizations;
CREATE POLICY org_update_admin ON public.organizations
  FOR UPDATE TO authenticated
  USING (public.is_org_admin(id))
  WITH CHECK (public.is_org_admin(id));

-- ─── 3) public.organization_members ───────────────────────────────────
-- Kullanıcı kendi üyeliklerini görür + aynı org'daki diğerlerini görür.

ALTER TABLE public.organization_members ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS om_select ON public.organization_members;
CREATE POLICY om_select ON public.organization_members
  FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR public.is_org_member(organization_id)
  );
DROP POLICY IF EXISTS om_admin_write ON public.organization_members;
CREATE POLICY om_admin_write ON public.organization_members
  FOR ALL TO authenticated
  USING (public.is_org_admin(organization_id))
  WITH CHECK (public.is_org_admin(organization_id));

-- ─── 4) public.invitations ────────────────────────────────────────────
-- Org admin'i kendi davetlerini görür + yönetir; davet alıcısı kendi
-- email'ine gönderilen davetleri görür (acceptInvitation akışı için).

ALTER TABLE public.invitations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS inv_select ON public.invitations;
CREATE POLICY inv_select ON public.invitations
  FOR SELECT TO authenticated
  USING (
    public.is_org_admin(organization_id)
    OR email = (SELECT lower(email) FROM auth.users WHERE id = auth.uid())
  );
DROP POLICY IF EXISTS inv_admin_write ON public.invitations;
CREATE POLICY inv_admin_write ON public.invitations
  FOR ALL TO authenticated
  USING (public.is_org_admin(organization_id))
  WITH CHECK (public.is_org_admin(organization_id));

-- ─── 5) public.user_hidden_resources + user_locked_resources ──────────
-- Kullanıcı kendi yetkilerini görür; admin org'daki tüm yetkileri görür/yönetir.

ALTER TABLE public.user_hidden_resources ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS uhr_select ON public.user_hidden_resources;
CREATE POLICY uhr_select ON public.user_hidden_resources
  FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR public.is_org_admin(organization_id)
  );
DROP POLICY IF EXISTS uhr_admin_write ON public.user_hidden_resources;
CREATE POLICY uhr_admin_write ON public.user_hidden_resources
  FOR ALL TO authenticated
  USING (public.is_org_admin(organization_id))
  WITH CHECK (public.is_org_admin(organization_id));

ALTER TABLE public.user_locked_resources ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS ulr_select ON public.user_locked_resources;
CREATE POLICY ulr_select ON public.user_locked_resources
  FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR public.is_org_admin(organization_id)
  );
DROP POLICY IF EXISTS ulr_admin_write ON public.user_locked_resources;
CREATE POLICY ulr_admin_write ON public.user_locked_resources
  FOR ALL TO authenticated
  USING (public.is_org_admin(organization_id))
  WITH CHECK (public.is_org_admin(organization_id));

-- ─── 6) solar."Project" ───────────────────────────────────────────────
-- Üye sadece kendi org'unun projelerini görür/değiştirir.

ALTER TABLE solar."Project" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS project_member ON solar."Project";
CREATE POLICY project_member ON solar."Project"
  FOR ALL TO authenticated
  USING (public.is_org_member(organization_id))
  WITH CHECK (public.is_org_member(organization_id));

-- ─── 7) solar."ProjectDetail" ─────────────────────────────────────────
-- Project FK üzerinden org-scope kontrolü.

ALTER TABLE solar."ProjectDetail" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS pd_member ON solar."ProjectDetail";
CREATE POLICY pd_member ON solar."ProjectDetail"
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM solar."Project" p
      WHERE p.id = solar."ProjectDetail"."projectId"
        AND public.is_org_member(p.organization_id)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM solar."Project" p
      WHERE p.id = solar."ProjectDetail"."projectId"
        AND public.is_org_member(p.organization_id)
    )
  );

-- ─── 8) solar.audit_logs ──────────────────────────────────────────────
-- Sadece org admin'i okuyabilir; INSERT app-layer'dan (service_role) gelir
-- ve RLS bypass eder, dolayısıyla policy SELECT için yeterli.

ALTER TABLE solar.audit_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS audit_admin_read ON solar.audit_logs;
CREATE POLICY audit_admin_read ON solar.audit_logs
  FOR SELECT TO authenticated
  USING (public.is_org_admin(organization_id));

-- ─── 9) solar.share_links ─────────────────────────────────────────────
-- Org üyesi kendi org'undaki paylaşımları görür (admin yönetir).
-- Public share sayfası Prisma + service_role ile token validate ettiği için
-- RLS bypass eder, müşteri sayfası etkilenmez.

ALTER TABLE solar.share_links ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS sl_member_read ON solar.share_links;
CREATE POLICY sl_member_read ON solar.share_links
  FOR SELECT TO authenticated
  USING (public.is_org_member(organization_id));
DROP POLICY IF EXISTS sl_admin_write ON solar.share_links;
CREATE POLICY sl_admin_write ON solar.share_links
  FOR ALL TO authenticated
  USING (public.is_org_admin(organization_id))
  WITH CHECK (public.is_org_admin(organization_id));

-- ─── 10) solar.project_activities ─────────────────────────────────────
-- Org üyeleri kendi org'undaki aktiviteleri görür/ekler.

ALTER TABLE solar.project_activities ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS pa_member ON solar.project_activities;
CREATE POLICY pa_member ON solar.project_activities
  FOR ALL TO authenticated
  USING (public.is_org_member(organization_id))
  WITH CHECK (public.is_org_member(organization_id));

-- ─── 11) profiles (kendi profilini gör/güncelle) ──────────────────────
-- Kullanıcı kendi profilini görür ve günceller; başkasının profilini
-- aynı org üyesiyse okuyabilir (Kullanıcılar sayfası vs.).

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS profile_self ON public.profiles;
CREATE POLICY profile_self ON public.profiles
  FOR ALL TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());
DROP POLICY IF EXISTS profile_org_read ON public.profiles;
CREATE POLICY profile_org_read ON public.profiles
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.organization_members om
      WHERE om.user_id = public.profiles.id
        AND public.is_org_member(om.organization_id)
    )
  );

-- ──────────────────────────────────────────────────────────────────────
-- Test: bu migration sonrası Supabase Studio'da bir tabloya RLS panelinden
-- politikaların eklendiğini doğrula. Uygulama Prisma kullandığı için
-- davranış değişmemeli; bir kullanıcı doğrudan REST'le erişmeye çalışırsa
-- artık org-dışı veriyi göremez.
-- ──────────────────────────────────────────────────────────────────────
