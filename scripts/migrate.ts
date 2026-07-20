import { readFile } from "node:fs/promises";
import path from "node:path";
import postgres from "postgres";

const databaseUrl = process.env.SUPABASE_DATABASE_URL;
if (!databaseUrl) {
  console.log("SUPABASE_DATABASE_URL is not set; skipping remote migrations.");
  process.exit(0);
}

const sql = postgres(databaseUrl, { ssl: "require", max: 1 });
const migrationPath = path.join(process.cwd(), "supabase/migrations/202607200001_initial_schema.sql");
try {
  const migration = await readFile(migrationPath, "utf8");
  await sql.unsafe(migration);
  console.log("Supabase migrations completed successfully.");
} finally {
  await sql.end();
}
