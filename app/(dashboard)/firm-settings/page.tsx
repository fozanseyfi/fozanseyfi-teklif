import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { UserRole } from "@prisma/client";
import { FirmSettingsForm } from "@/components/shared/firm-settings-form";

export default async function FirmSettingsPage() {
  const user = await requireRole([UserRole.FIRM_ADMIN]);

  const [firm, users] = await Promise.all([
    prisma.firm.findUnique({ where: { id: user.firmId } }),
    prisma.user.findMany({ where: { firmId: user.firmId }, orderBy: { createdAt: "asc" } }),
  ]);

  if (!firm) return null;

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <h1 className="text-2xl font-bold text-gray-100">Firma Ayarları</h1>
      <FirmSettingsForm firm={firm} users={users} currentUserId={user.id} />
    </div>
  );
}
