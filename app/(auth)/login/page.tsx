"use client";

import { useActionState } from "react";
import { login } from "@/app/actions/auth";
import { LoginKitPage } from "@/components/auth/login-kit";
import { LOGIN_PLATFORM } from "@/lib/login-platform";

/*
 * Giriş sayfası. Görünüm bütün platformlarda ortak (components/auth/login-kit.tsx);
 * bu platforma özgü tanıtım ve ekranlar lib/login-platform.tsx'te.
 */
export default function LoginPage() {
  const [result, action, pending] = useActionState(login, undefined);
  return <LoginKitPage platform={LOGIN_PLATFORM} form={{ action, pending, error: result?.error }} />;
}
