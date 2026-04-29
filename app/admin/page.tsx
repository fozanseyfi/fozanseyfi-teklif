import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatNumber } from "@/lib/utils";
import { Building2, FolderOpen, Users, FileText } from "lucide-react";

export default async function AdminPage() {
  const user = await requireAuth();

  const [firmCount, projectCount, userCount, proposalCount] = await Promise.all([
    prisma.firm.count(),
    prisma.project.count(),
    prisma.user.count(),
    prisma.proposal.count(),
  ]);

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      <Card>
        <CardContent className="p-5">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs text-gray-500">Toplam Firma</p>
            <Building2 className="w-4 h-4 text-gray-600" />
          </div>
          <p className="text-3xl font-bold text-gray-100">{formatNumber(firmCount)}</p>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-5">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs text-gray-500">Toplam Proje</p>
            <FolderOpen className="w-4 h-4 text-gray-600" />
          </div>
          <p className="text-3xl font-bold text-gray-100">{formatNumber(projectCount)}</p>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-5">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs text-gray-500">Toplam Kullanıcı</p>
            <Users className="w-4 h-4 text-gray-600" />
          </div>
          <p className="text-3xl font-bold text-gray-100">{formatNumber(userCount)}</p>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-5">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs text-gray-500">Oluşturulan PDF</p>
            <FileText className="w-4 h-4 text-gray-600" />
          </div>
          <p className="text-3xl font-bold text-gray-100">{formatNumber(proposalCount)}</p>
        </CardContent>
      </Card>
    </div>
  );
}
