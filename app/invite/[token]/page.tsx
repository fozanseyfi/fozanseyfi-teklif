import { prisma } from "@/lib/prisma";
import { createSupabaseServer } from "@/lib/supabase/server";
import { ROLE_LABELS, type Role } from "@/lib/permissions";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Sun, Mail, ShieldAlert, Sparkles } from "lucide-react";
import Link from "next/link";
import { InviteAcceptForm } from "./client";

interface Props {
  params: Promise<{ token: string }>;
}

export default async function InvitePage({ params }: Props) {
  const { token } = await params;

  const invitation = await prisma.invitation.findUnique({
    where: { token },
    include: { organization: true },
  });

  // Hatalı davet durumlari
  if (!invitation) return <ErrorScreen title="Geçersiz davet linki" message="Bu link tanınmıyor. Sizi davet eden kişiden yeni bir link talep edin." />;
  if (invitation.acceptedAt) return <ErrorScreen title="Davet zaten kabul edildi" message="Bu davet daha önce kabul edilmiş. Hesabınızla giriş yapabilirsiniz." cta={{ href: "/login", label: "Giriş Yap" }} />;
  if (invitation.expiresAt < new Date()) return <ErrorScreen title="Davetin süresi doldu" message="Bu davetin geçerlilik süresi sona ermiş. Sizi davet eden kişiden yeni bir link talep edin." />;

  const supabase = await createSupabaseServer();
  const { data: { user: authUser } } = await supabase.auth.getUser();

  // Auth değilse: register/login formu göster (email pre-filled, token taşınır)
  if (!authUser) {
    return (
      <Shell
        org={invitation.organization.name}
        email={invitation.email}
        role={invitation.role as Role}
      >
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Bu davete katılmak için <strong className="text-foreground">{invitation.email}</strong>{" "}
            adresiyle bir hesabınız olması gerek.
          </p>
          <div className="flex flex-col gap-2">
            <Link
              href={`/register?email=${encodeURIComponent(invitation.email)}&inviteToken=${token}`}
              className="inline-flex h-10 items-center justify-center rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
            >
              <Sparkles className="mr-1.5 size-4" /> Yeni Hesap Aç
            </Link>
            <Link
              href={`/login?next=${encodeURIComponent(`/invite/${token}`)}`}
              className="inline-flex h-10 items-center justify-center rounded-lg border bg-card px-4 text-sm font-semibold text-foreground transition-colors hover:bg-muted"
            >
              Mevcut Hesabımla Giriş Yap
            </Link>
          </div>
        </div>
      </Shell>
    );
  }

  // Auth var ama email eslesmiyor
  if ((authUser.email ?? "").toLowerCase() !== invitation.email.toLowerCase()) {
    return (
      <ErrorScreen
        title="Bu davet sizin için değil"
        message={`Bu davet ${invitation.email} adresi için oluşturulmuş. Şu an ${authUser.email} ile giriş yapmışsınız. Önce çıkış yapın, sonra ${invitation.email} ile giriş yapın.`}
        cta={{ href: "/login", label: "Çıkış / Hesap Değiştir" }}
      />
    );
  }

  // Auth var, email eslesti — accept butonu.
  //
  // Sifre alani ne zaman gozuksun?
  // - Yeni davet ile Supabase'de YENI yaratilan user: sifresi yok, magic
  //   link ile geldi → sifre belirlemek onerilir (default acik).
  // - Mevcut hesabi olan kullanici (baska panelden zaten signup yapmis,
  //   sifre var): sifre alani gereksiz; default kapali, kullanici isterse
  //   "Şifremi de güncellemek istiyorum" ile acabilir.
  //
  // Ayirt etmek icin: bizim inviteUser action'unda Supabase user_metadata'ya
  // invitation_token yaziyoruz. Eger authUser.user_metadata.invitation_token
  // === token ise bu kisi tam bu davet ile yaratildi — yeni user.
  const meta = (authUser.user_metadata ?? {}) as Record<string, unknown>;
  const isFreshlyInvited = meta.invitation_token === token;

  return (
    <Shell
      org={invitation.organization.name}
      email={invitation.email}
      role={invitation.role as Role}
    >
      <InviteAcceptForm
        token={token}
        orgName={invitation.organization.name}
        isFreshlyInvited={isFreshlyInvited}
      />
    </Shell>
  );
}

function Shell({
  org,
  email,
  role,
  children,
}: {
  org: string;
  email: string;
  role: Role;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-soft-gradient flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <div className="mb-3 inline-flex items-center gap-2.5">
            <div className="flex size-10 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm">
              <Sun className="size-5" />
            </div>
            <span className="text-2xl font-semibold tracking-tight text-foreground">SolarTeklif</span>
          </div>
        </div>
        <Card className="shadow-xl">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Mail className="size-5 text-primary" />
              Panel Daveti
            </CardTitle>
            <CardDescription>
              <strong className="text-foreground">{org}</strong> paneline{" "}
              <strong className="text-foreground">{ROLE_LABELS[role]}</strong> rolüyle davet
              edildin. Davet alan: <strong className="text-foreground">{email}</strong>.
            </CardDescription>
          </CardHeader>
          <CardContent>{children}</CardContent>
        </Card>
        <p className="mt-4 text-center text-xs text-muted-foreground">
          fozanseyfi.com platformları
        </p>
      </div>
    </div>
  );
}

function ErrorScreen({
  title,
  message,
  cta,
}: {
  title: string;
  message: string;
  cta?: { href: string; label: string };
}) {
  return (
    <div className="bg-soft-gradient flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-md">
        <Card className="shadow-xl">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg text-destructive-soft-foreground">
              <ShieldAlert className="size-5" />
              {title}
            </CardTitle>
            <CardDescription>{message}</CardDescription>
          </CardHeader>
          {cta && (
            <CardContent>
              <Link
                href={cta.href}
                className="inline-flex h-10 w-full items-center justify-center rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
              >
                {cta.label}
              </Link>
            </CardContent>
          )}
        </Card>
      </div>
    </div>
  );
}
