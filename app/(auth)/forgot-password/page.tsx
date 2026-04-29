"use client";

import { useActionState } from "react";
import Link from "next/link";
import { forgotPassword } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function ForgotPasswordPage() {
  const [result, action, pending] = useActionState(forgotPassword, undefined);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Şifremi Unuttum</CardTitle>
        <CardDescription>E-posta adresinizi girin, şifre sıfırlama linki gönderelim</CardDescription>
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
              {result.success}
            </div>
          )}
          <div className="space-y-1.5">
            <Label htmlFor="email">E-posta</Label>
            <Input id="email" name="email" type="email" placeholder="ornek@firma.com" required />
          </div>
          <Button type="submit" className="w-full" disabled={pending}>
            {pending ? "Gönderiliyor..." : "Sıfırlama Linki Gönder"}
          </Button>
        </form>
        <p className="mt-5 text-center text-sm text-slate-500">
          <Link href="/login" className="text-amber-600 hover:text-amber-700 font-medium">
            ← Giriş sayfasına dön
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
