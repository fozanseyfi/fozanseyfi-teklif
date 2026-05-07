import "dotenv/config";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);

const { data, error } = await supabase.auth.admin.listUsers();
if (error) {
  console.error(error);
  process.exit(1);
}
console.log("auth.users:");
for (const u of data.users) {
  console.log(" -", u.id, u.email, "confirmed:", u.email_confirmed_at ? "yes" : "NO", "created:", u.created_at);
}
