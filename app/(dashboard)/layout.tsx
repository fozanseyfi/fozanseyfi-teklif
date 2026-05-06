import { requireAuth } from "@/lib/auth";
import { Sidebar } from "@/components/shared/sidebar";
import { Footer } from "@/components/shared/footer";
import { Toaster } from "sonner";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const user = await requireAuth();

  return (
    <div className="min-h-screen bg-background">
      <Sidebar userName={user.name} firmName={user.firm.name} role={user.role} />
      <div className="flex min-h-screen flex-col pl-64">
        <main key="dashboard-main" className="flex-1 p-8 animate-in-up">
          {children}
        </main>
        <Footer />
      </div>
      <Toaster theme="light" position="top-right" richColors />
    </div>
  );
}
