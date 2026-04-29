"use client";

import { useActionState } from "react";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import Link from "next/link";
import { resetPassword } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

function ResetPasswordForm() {
  const [result, action, pending] = useActionState(resetPassword, undefined);
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

  if (!token) {
    return (
      <Card className="shadow-xl shadow-slate-200/50 border-slate-200">
        <CardContent className="pt-6 text-center text-red-600">
          Geçersiz şifre sıfırlama linki.
          <Link href="/forgot-password" className="block mt-2 text-amber-600 font-medium">
            Yeni link talep et
          </Link>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="shadow-xl shadow-slate-200/50 border-slate-200">
      <CardHeader className="pb-4">
        <CardTitle className="text-xl">Yeni Şifre Belirle</CardTitle>
        <CardDescription>Hesabınız için yeni bir şifre oluşturun</CardDescription>
      </CardHeader>
      <CardContent>
        <form action={action} className="space-y-4">
          {result?.error && (
            <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-600">
              {result.error}
            </div>
          )}
          {result?.success && (
            <div className="rounded-lg bg-emerald-50 border border-emerald-200 p-3 text-sm text-emerald-700">
              {result.success}{" "}
              <Link href="/login" className="underline font-medium">
                Giriş yap
              </Link>
            </div>
          )}
          <input type="hidden" name="token" value={token} />
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
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<div className="text-slate-400 text-center">Yükleniyor...</div>}>
      <ResetPasswordForm />
    </Suspense>
  );
}
