import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatDate, PLAN_LABELS } from "@/lib/utils";

export default async function FirmsAdminPage() {
  const user = await requireAuth();

  const firms = await prisma.firm.findMany({
    include: {
      subscription: true,
      _count: { select: { users: true, projects: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  const planVariant: Record<string, "default" | "secondary" | "success" | "warning"> = {
    FREE: "secondary",
    STARTER: "warning",
    PROFESSIONAL: "success",
    ENTERPRISE: "default",
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Tüm Firmalar ({firms.length})</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-800 text-gray-500">
                <th className="text-left px-6 py-3 font-medium">Firma</th>
                <th className="text-center px-6 py-3 font-medium">Kullanıcılar</th>
                <th className="text-center px-6 py-3 font-medium">Projeler</th>
                <th className="text-center px-6 py-3 font-medium">Plan</th>
                <th className="text-center px-6 py-3 font-medium">Bu Ay</th>
                <th className="text-right px-6 py-3 font-medium">Kayıt Tarihi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800/50">
              {firms.map((firm) => (
                <tr key={firm.id} className="hover:bg-gray-800/30">
                  <td className="px-6 py-4">
                    <p className="font-medium text-gray-200">{firm.name}</p>
                    {firm.email && <p className="text-xs text-gray-500">{firm.email}</p>}
                  </td>
                  <td className="px-6 py-4 text-center text-gray-400">{firm._count.users}</td>
                  <td className="px-6 py-4 text-center text-gray-400">{firm._count.projects}</td>
                  <td className="px-6 py-4 text-center">
                    {firm.subscription ? (
                      <Badge variant={planVariant[firm.subscription.plan] ?? "secondary"}>
                        {PLAN_LABELS[firm.subscription.plan]}
                      </Badge>
                    ) : (
                      <span className="text-gray-600">—</span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-center text-gray-400">
                    {firm.subscription
                      ? `${firm.subscription.currentMonthCount} / ${firm.subscription.monthlyProposalLimit === -1 ? "∞" : firm.subscription.monthlyProposalLimit}`
                      : "—"}
                  </td>
                  <td className="px-6 py-4 text-right text-gray-500 text-xs">
                    {formatDate(firm.createdAt)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
