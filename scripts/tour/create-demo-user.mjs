/**
 * Tanıtım sayfası ekran görüntüleri için demo kullanıcıyı oluşturur (idempotent).
 *   node --env-file=.env scripts/tour/create-demo-user.mjs
 * Gerekli .env: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, TOUR_DEMO_EMAIL, TOUR_DEMO_PASSWORD
 * Profil ve panel (organizasyon) ilk girişte uygulamanın kendisi tarafından yaratılır.
 */
import { createClient } from "@supabase/supabase-js";

const { NEXT_PUBLIC_SUPABASE_URL: url, SUPABASE_SERVICE_ROLE_KEY: key, TOUR_DEMO_EMAIL: email, TOUR_DEMO_PASSWORD: password } = process.env;
if (!url || !key || !email || !password) throw new Error("Eksik .env değişkeni");

const admin = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
const { data, error } = await admin.auth.admin.createUser({
  email,
  password,
  email_confirm: true,
  user_metadata: { full_name: "Deniz Aydın" },
});
if (error) {
  if (/already|registered|exists/i.test(error.message)) console.log("Demo kullanıcı zaten var:", email);
  else throw error;
} else {
  console.log("Demo kullanıcı oluşturuldu:", data.user.id, email);
}
