import { requireAuth, getUserOrganizations } from "@/lib/auth";
import { Sidebar } from "@/components/shared/sidebar";
import { Footer } from "@/components/shared/footer";
import { GlobalSearch } from "@/components/shared/global-search";
import { Toaster } from "sonner";
import { UnsavedChangesProvider } from "@/lib/unsaved-changes";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const user = await requireAuth();
  const memberships = await getUserOrganizations(user.id);
  const orgs = memberships.map((m) => ({
    id: m.organizationId,
    name: m.organization.name,
    role: m.role,
    isActive: m.organizationId === user.organizationId,
  }));

  return (
    <UnsavedChangesProvider>
      <div className="min-h-screen bg-background">
        <Sidebar
          userName={user.fullName ?? user.email ?? ""}
          firmName={user.organization.name}
          // platformRole = aktif organizasyondaki rol; profile.role degil.
          // Kullanici kendi panelinde admin olabilir, davet edildigi panelde
          // user/viewer; sidebar nav (Kullanicilar gibi adminOnly itemlar)
          // bu degere bakmali ki panel degisince yetkiler dogru guncellensin.
          userRole={user.platformRole}
          organizations={orgs}
        />
        {/* Top bar artık hem mobilde hem desktop'ta var (14h). Desktop'ta sidebar
            fixed, content sidebar genişliği kadar pad'lenir. */}
        <div className="flex min-h-screen flex-col pt-14 sidebar-aware">
          <main
            key="dashboard-main"
            className="flex-1 p-4 sm:p-6 lg:p-8 animate-in-up"
          >
            {children}
          </main>
          <Footer />
        </div>
        <Toaster theme="light" position="top-right" richColors />
        {/* Global Ctrl+K arama — her sayfada aktif, modal kapalı render
            edilir (sadece açıkken DOM'da görünür). */}
        <GlobalSearch />
      </div>
    </UnsavedChangesProvider>
  );
}
