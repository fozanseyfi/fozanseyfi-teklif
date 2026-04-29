"use client";

import { useState, useActionState } from "react";
import Link from "next/link";
import { login } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Eye, EyeOff } from "lucide-react";

export default function LoginPage() {
  const [result, action, pending] = useActionState(login, undefined);
  const [showPassword, setShowPassword] = useState(false);

  return (
    <Card className="shadow-xl shadow-slate-200/50 border-slate-200">
      <CardHeader className="pb-4">
        <CardTitle className="text-xl">Giriş Yap</CardTitle>
        <CardDescription>Hesabınıza giriş yapın</CardDescription>
      </CardHeader>
      <CardContent>
        <form action={action} className="space-y-4">
          {result?.error && (
            <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-600">
              {result.error}
            </div>
          )}
          <div className="space-y-1.5">
            <Label htmlFor="email">E-posta</Label>
            <Input id="email" name="email" type="email" placeholder="ornek@firma.com" required />
          </div>
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="password">Şifre</Label>
              <Link href="/forgot-password" className="text-xs text-amber-600 hover:text-amber-700 font-medium">
                Şifremi unuttum
              </Link>
            </div>
            <div className="relative">
              <Input
                id="password"
                name="password"
                type={showPassword ? "text" : "password"}
                placeholder="••••••••"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>
          <Button type="submit" className="w-full" disabled={pending}>
            {pending ? "Giriş yapılıyor..." : "Giriş Yap"}
          </Button>
        </form>
        <p className="mt-5 text-center text-sm text-slate-500">
          Hesabınız yok mu?{" "}
          <Link href="/register" className="text-amber-600 hover:text-amber-700 font-medium">
            Kayıt ol
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
