import "dotenv/config";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);

const { data: rows, error } = await supabase.from("organization_members").select("*").limit(20);
console.log("organization_members:", error?.message ?? JSON.stringify(rows, null, 2));

// Active org tracking
const { data: pcols } = await supabase
  .rpc("query_columns", { tname: "profiles" })
  .single();
console.log("\nprofile columns hint:", pcols ?? "(rpc not available)");
