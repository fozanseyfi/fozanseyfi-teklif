import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "SolarTeklif — Giriş",
};

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background text-foreground antialiased">
      {children}
    </div>
  );
}
