import "dotenv/config";
import pg from "pg";

const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
await client.connect();

const cols = await client.query(`
  SELECT column_name, data_type, is_nullable, column_default
  FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'invitations'
  ORDER BY ordinal_position
`);
console.log("invitations columns:");
cols.rows.forEach((r) => console.log(`  ${r.column_name} : ${r.data_type} ${r.is_nullable === "NO" ? "NOT NULL" : ""} ${r.column_default ? "DEFAULT " + r.column_default : ""}`));

const sample = await client.query(`SELECT * FROM public.invitations ORDER BY created_at DESC LIMIT 3`);
console.log("\nSample rows:");
sample.rows.forEach((r) => console.log(JSON.stringify(r, null, 2)));

await client.end();
