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
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      <Card>
        <CardContent className="p-5">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-xs text-muted-foreground">Toplam Firma</p>
            <Building2 className="size-4 text-muted-foreground" />
          </div>
          <p className="text-3xl font-bold tracking-tight text-foreground">{formatNumber(firmCount)}</p>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-5">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-xs text-muted-foreground">Toplam Proje</p>
            <FolderOpen className="size-4 text-muted-foreground" />
          </div>
          <p className="text-3xl font-bold tracking-tight text-foreground">{formatNumber(projectCount)}</p>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-5">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-xs text-muted-foreground">Toplam Kullanıcı</p>
            <Users className="size-4 text-muted-foreground" />
          </div>
          <p className="text-3xl font-bold tracking-tight text-foreground">{formatNumber(userCount)}</p>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-5">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-xs text-muted-foreground">Oluşturulan PDF</p>
            <FileText className="size-4 text-muted-foreground" />
          </div>
          <p className="text-3xl font-bold tracking-tight text-foreground">{formatNumber(proposalCount)}</p>
        </CardContent>
      </Card>
    </div>
  );
}
