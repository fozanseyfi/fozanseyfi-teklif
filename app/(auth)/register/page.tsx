"use client";

import { useActionState, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { register } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

function RegisterForm() {
  const [result, action, pending] = useActionState(register, undefined);
  const searchParams = useSearchParams();
  const inviteToken = searchParams.get("token");

  return (
    <Card className="animate-in-up">
      <CardHeader>
        <CardTitle className="text-xl">
          {inviteToken ? "Davete Katıl" : "Hesap Oluştur"}
        </CardTitle>
        <CardDescription>
          {inviteToken
            ? "Firma davetini kabul ederek kayıt olun"
            : "Firmanız için ücretsiz hesap oluşturun"}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form action={action} className="space-y-4">
          {result?.error && (
            <div className="rounded-md border border-destructive/30 bg-destructive-soft p-3 text-sm text-destructive-soft-foreground">
              {result.error}
            </div>
          )}
          {inviteToken && <input type="hidden" name="inviteToken" value={inviteToken} />}
          <div className="space-y-1.5">
            <Label htmlFor="name">Ad Soyad</Label>
            <Input id="name" name="name" placeholder="Ahmet Yılmaz" required autoComplete="name" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="email">E-posta</Label>
            <Input
              id="email"
              name="email"
              type="email"
              placeholder="ahmet@firma.com"
              required
              autoComplete="email"
            />
          </div>
          {!inviteToken && (
            <div className="space-y-1.5">
              <Label htmlFor="firmName">Firma Adı</Label>
              <Input
                id="firmName"
                name="firmName"
                placeholder="ABC Solar Enerji"
                required
                autoComplete="organization"
              />
            </div>
          )}
          <div className="space-y-1.5">
            <Label htmlFor="password">Şifre</Label>
            <Input
              id="password"
              name="password"
              type="password"
              placeholder="En az 8 karakter"
              required
              autoComplete="new-password"
            />
          </div>
          <Button type="submit" className="w-full" disabled={pending}>
            {pending ? "Kayıt yapılıyor..." : "Kayıt Ol"}
          </Button>
        </form>
        <p className="mt-6 text-center text-sm text-muted-foreground">
          Zaten hesabınız var mı?{" "}
          <Link href="/login" className="font-medium text-primary hover:underline">
            Giriş yap
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}

export default function RegisterPage() {
  return (
    <Suspense fallback={<div className="text-center text-muted-foreground">Yükleniyor...</div>}>
      <RegisterForm />
    </Suspense>
  );
}
