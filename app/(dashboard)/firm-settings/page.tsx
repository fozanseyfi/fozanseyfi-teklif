import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isAdmin } from "@/lib/permissions";
import { redirect } from "next/navigation";
import { FirmSettingsForm } from "@/components/shared/firm-settings-form";

export default async function FirmSettingsPage() {
  const user = await requireAuth();
  if (!isAdmin(user)) redirect("/dashboard");

  const firm = await prisma.organization.findUnique({
    where: { id: user.organizationId },
  });
  if (!firm) return null;

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <h1 className="text-2xl font-semibold tracking-tight text-foreground">Firma Ayarları</h1>
      <FirmSettingsForm firm={firm} />
    </div>
  );
}
