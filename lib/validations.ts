export function validateEmail(email: string): string | null {
  if (!email) return "E-posta zorunludur";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return "Geçerli bir e-posta girin";
  return null;
}

export function validatePassword(password: string): string | null {
  if (!password) return "Şifre zorunludur";
  if (password.length < 8) return "Şifre en az 8 karakter olmalıdır";
  return null;
}

export function validateRequired(value: string, fieldName: string): string | null {
  if (!value || !value.trim()) return `${fieldName} zorunludur`;
  return null;
}
