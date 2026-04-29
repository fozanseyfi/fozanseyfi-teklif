"use client";

import { useActionState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { register } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

function RegisterForm() {
  const [result, action, pending] = useActionState(register, undefined);
  const searchParams = useSearchParams();
  const inviteToken = searchParams.get("token");

  return (
    <Card className="shadow-xl shadow-slate-200/50 border-slate-200">
      <CardHeader className="pb-4">
        <CardTitle className="text-xl">{inviteToken ? "Davete Katıl" : "Hesap Oluştur"}</CardTitle>
        <CardDescription>
          {inviteToken ? "Firma davetini kabul ederek kayıt olun" : "Firmanız için ücretsiz hesap oluşturun"}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form action={action} className="space-y-4">
          {result?.error && (
            <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-600">
              {result.error}
            </div>
          )}
          {inviteToken && <input type="hidden" name="inviteToken" value={inviteToken} />}
          <div className="space-y-1.5">
            <Label htmlFor="name">Ad Soyad</Label>
            <Input id="name" name="name" placeholder="Ahmet Yılmaz" required />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="email">E-posta</Label>
            <Input id="email" name="email" type="email" placeholder="ahmet@firma.com" required />
          </div>
          {!inviteToken && (
            <div className="space-y-1.5">
              <Label htmlFor="firmName">Firma Adı</Label>
              <Input id="firmName" name="firmName" placeholder="ABC Solar Enerji" required />
            </div>
          )}
          <div className="space-y-1.5">
            <Label htmlFor="password">Şifre</Label>
            <Input id="password" name="password" type="password" placeholder="En az 8 karakter" required />
          </div>
          <Button type="submit" className="w-full" disabled={pending}>
            {pending ? "Kayıt yapılıyor..." : "Kayıt Ol"}
          </Button>
        </form>
        <p className="mt-5 text-center text-sm text-slate-500">
          Zaten hesabınız var mı?{" "}
          <Link href="/login" className="text-amber-600 hover:text-amber-700 font-medium">
            Giriş yap
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}

export default function RegisterPage() {
  return (
    <Suspense fallback={<div className="text-slate-400 text-center">Yükleniyor...</div>}>
      <RegisterForm />
    </Suspense>
  );
}
