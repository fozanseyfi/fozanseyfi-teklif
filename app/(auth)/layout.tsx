import type { Metadata } from "next";
import { Sun } from "lucide-react";

export const metadata: Metadata = {
  title: "SolarTeklif — Giriş",
};

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-soft-gradient flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <div className="mb-3 inline-flex items-center gap-2.5">
            <div className="flex size-10 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm">
              <Sun className="size-5" />
            </div>
            <span className="text-2xl font-semibold tracking-tight text-foreground">
              SolarTeklif
            </span>
          </div>
          <p className="text-sm text-muted-foreground">
            Güneş Enerjisi Teklif Yönetim Platformu
          </p>
        </div>
        {children}
      </div>
    </div>
  );
}
