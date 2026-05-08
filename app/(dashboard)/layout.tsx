import { requireAuth, getUserOrganizations } from "@/lib/auth";
import { Sidebar } from "@/components/shared/sidebar";
import { Footer } from "@/components/shared/footer";
import { Toaster } from "sonner";

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
    <div className="min-h-screen bg-background">
      <Sidebar
        userName={user.fullName ?? user.email ?? ""}
        firmName={user.organization.name}
        userRole={user.role}
        organizations={orgs}
      />
      {/* Top bar artÄ±k hem mobilde hem desktop'ta var (14h). Desktop'ta sidebar
          fixed, content sidebar geniÅŸliÄŸi kadar pad'lenir. */}
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
    </div>
  );
}
