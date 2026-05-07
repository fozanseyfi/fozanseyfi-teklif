"use client";

import { useActionState } from "react";
import Link from "next/link";
import { resetPassword } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Sun } from "lucide-react";

export default function ResetPasswordPage() {
  // Supabase reset-password akisinda kullanici buraya geldigi anda zaten
  // /auth/callback uzerinden code -> session takasi yapilmis ve gecici bir
  // oturum acilmis oluyor. Burada sadece yeni sifreyi alip updateUser ile
  // kaydediyoruz; ayri bir token URL param'i yok.
  const [result, action, pending] = useActionState(resetPassword, undefined);

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
          <p className="text-sm text-muted-foreground">Güneş Enerjisi Teklif Yönetim Platformu</p>
        </div>

        <Card className="border-slate-200 shadow-xl shadow-slate-200/50">
          <CardHeader className="pb-4">
            <CardTitle className="text-xl">Yeni Şifre Belirle</CardTitle>
            <CardDescription>Hesabınız için yeni bir şifre oluşturun</CardDescription>
          </CardHeader>
          <CardContent>
            <form action={action} className="space-y-4">
              {result?.error && (
                <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-600">
                  {result.error}
                </div>
              )}
              {result?.success && (
                <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">
                  {result.success}{" "}
                  <Link href="/login" className="font-medium underline">
                    Giriş yap
                  </Link>
                </div>
              )}
              <div className="space-y-1.5">
                <Label htmlFor="password">Yeni Şifre</Label>
                <Input id="password" name="password" type="password" placeholder="En az 8 karakter" required />
              </div>
              <Button type="submit" className="w-full" disabled={pending}>
                {pending ? "Güncelleniyor..." : "Şifreyi Güncelle"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
