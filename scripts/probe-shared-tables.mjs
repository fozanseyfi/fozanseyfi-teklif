// Karardestek'in olusturdugu paylasilan tablolari kesfet
import "dotenv/config";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);

// public.profiles
const { data: profiles, error: pe } = await supabase
  .from("profiles")
  .select("*")
  .eq("email", "fozanseyfi@gmail.com");
console.log("profiles[fozanseyfi]:", pe?.message ?? JSON.stringify(profiles, null, 2));

// public.organizations
const { data: orgs, error: oe } = await supabase.from("organizations").select("*");
console.log("\norganizations (all):", oe?.message ?? JSON.stringify(orgs, null, 2));

// user_hidden_resources schema
const { data: hidden, error: he } = await supabase
  .from("user_hidden_resources")
  .select("*")
  .limit(1);
console.log("\nuser_hidden_resources sample:", he?.message ?? hidden);

// invitations
const { data: invs, error: ie } = await supabase
  .from("invitations")
  .select("*")
  .limit(2);
console.log("\ninvitations sample:", ie?.message ?? invs);
