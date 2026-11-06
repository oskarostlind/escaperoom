// scripts/migrate.ts – körs före `next build` på Vercel så att Neon alltid har rätt tabeller.
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { Pool } from "pg";

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.warn("[migrate] DATABASE_URL saknas – hoppar över migrering.");
    return;
  }
  const wantsSSL =
    /\bsslmode=require\b/i.test(url) ||
    /^require$/i.test(process.env.PGSSLMODE || "") ||
    /^true$/i.test(process.env.DB_SSL || "");
  const pool = new Pool({ connectionString: url, ssl: wantsSSL ? { rejectUnauthorized: false } : undefined });
  const db = drizzle(pool);
  await migrate(db, { migrationsFolder: "./drizzle" });
  await pool.end();
  console.log("[migrate] Klart.");
}

main().catch((err) => {
  console.error("[migrate] Misslyckades:", err);
  process.exit(1);
});
