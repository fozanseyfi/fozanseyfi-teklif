import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { formatDate, PLAN_LABELS, PLAN_LIMITS, cn } from "@/lib/utils";
import { Check } from "lucide-react";

const PLANS = [
  {
    key: "FREE",
    price: "₺0",
    features: ["3 aylık teklif", "1 kullanıcı", "10 proje", "PDF çıktısı", "Firma logo & branding"],
  },
  {
    key: "STARTER",
    price: "₺XXX",
    features: ["15 aylık teklif", "3 kullanıcı", "50 proje", "PDF çıktısı", "Firma logo & branding"],
  },
  {
    key: "PROFESSIONAL",
    price: "₺X.XXX",
    features: ["Sınırsız teklif", "10 kullanıcı", "Sınırsız proje", "Rol bazlı yetkilendirme", "Öncelikli destek"],
    popular: true,
  },
  {
    key: "ENTERPRISE",
    price: "Teklif Al",
    features: ["Her şey dahil", "Sınırsız kullanıcı", "Özel onboarding", "SLA garantisi"],
  },
];

export default async function SubscriptionPage() {
  const user = await requireAuth();
  const subscription = await prisma.subscription.findUnique({ where: { organizationId: user.organizationId } });

  const currentPlan = subscription?.plan ?? "FREE";
  const thisMonthCount = subscription?.currentMonthCount ?? 0;
  const monthlyLimit = subscription?.monthlyProposalLimit ?? 3;
  const usagePercent = monthlyLimit === -1 ? 0 : Math.min((thisMonthCount / monthlyLimit) * 100, 100);

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <h1 className="text-2xl font-semibold tracking-tight text-foreground">Abonelik</h1>

      {/* Mevcut Durum */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Mevcut Plan</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-3">
            <Badge variant="default" className="px-3 py-1 text-sm">
              {PLAN_LABELS[currentPlan]}
            </Badge>
            {subscription && (
              <span className="text-xs text-muted-foreground">
                Dönem: {formatDate(subscription.periodStart)} — {formatDate(subscription.periodEnd)}
              </span>
            )}
          </div>
          <div>
            <div className="mb-2 flex justify-between text-sm text-muted-foreground">
              <span>Bu ay oluşturulan teklifler</span>
              <span>
                {thisMonthCount} / {monthlyLimit === -1 ? "∞" : monthlyLimit}
              </span>
            </div>
            {monthlyLimit !== -1 && (
              <Progress value={usagePercent} className="h-2" />
            )}
          </div>
        </CardContent>
      </Card>

      {/* Plan Tablosu */}
      <div className="grid grid-cols-1 gap-4 animate-in-stagger sm:grid-cols-2 lg:grid-cols-4">
        {PLANS.map((plan) => (
          <Card
            key={plan.key}
            className={cn(
              "relative card-lift",
              plan.popular && "border-primary shadow-sm",
            )}
          >
            {plan.popular && (
              <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                <span className="rounded-full bg-primary px-3 py-1 text-xs font-semibold text-primary-foreground shadow-sm">
                  EN POPÜLER
                </span>
              </div>
            )}
            <CardHeader className="pb-3">
              <CardTitle className="text-base">{PLAN_LABELS[plan.key]}</CardTitle>
              <p className="text-2xl font-bold tracking-tight text-foreground">{plan.price}</p>
              <p className="text-xs text-muted-foreground">/ aylık</p>
            </CardHeader>
            <CardContent className="space-y-4">
              <ul className="space-y-2">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-sm text-muted-foreground">
                    <Check className="mt-0.5 size-3.5 shrink-0 text-primary" />
                    {f}
                  </li>
                ))}
              </ul>
              <Button
                variant={currentPlan === plan.key ? "outline" : plan.popular ? "default" : "secondary"}
                size="sm"
                className="w-full"
                disabled={currentPlan === plan.key}
              >
                {currentPlan === plan.key ? "Mevcut Plan" : "Seç"}
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      <p className="text-center text-xs text-muted-foreground">
        Ödeme altyapısı yakında aktif olacak. Şu an tüm planlar ücretsiz kullanılabilir.
      </p>
    </div>
  );
}
