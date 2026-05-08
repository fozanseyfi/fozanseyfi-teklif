import "dotenv/config";
import pg from "pg";

const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
await client.connect();

// auth.users uzerindeki triggerlar
const triggers = await client.query(`
  SELECT trigger_name, event_manipulation, action_statement, action_orientation, action_timing
  FROM information_schema.triggers
  WHERE event_object_schema = 'auth' AND event_object_table = 'users'
`);
console.log("auth.users triggers:");
triggers.rows.forEach((t) => {
  console.log(`  ${t.trigger_name} (${t.action_timing} ${t.event_manipulation})`);
  console.log(`    -> ${t.action_statement}`);
});

// handle_new_user fonksiyonunun kodunu cek
const fn = await client.query(`
  SELECT pg_get_functiondef(p.oid) AS def
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname = 'handle_new_user'
`);
console.log("\nhandle_new_user definition:");
fn.rows.forEach((r) => console.log(r.def));

await client.end();
