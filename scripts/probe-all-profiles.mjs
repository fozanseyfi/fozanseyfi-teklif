import "dotenv/config";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);

const ids = [
  "90bb7948-d0c0-4311-8a7f-88d772dbb13d",
  "6e4e986a-f83c-4fc7-885e-23e37a8ed7a4",
  "caf91e35-5406-49bc-afdc-c500ea80fab5",
];
const { data, error } = await supabase
  .from("profiles")
  .select("id,email,full_name,organization_id,role")
  .in("id", ids);
if (error) console.error(error);
console.log(JSON.stringify(data, null, 2));
