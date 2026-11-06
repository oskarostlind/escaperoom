// lib/db.ts
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

const url = process.env.DATABASE_URL || "";

/**
 * SSL aktiveras om querystring har sslmode=require, PGSSLMODE=require eller DB_SSL=true.
 * Neon via Vercel-integrationen har sslmode=require i URL:en.
 */
const wantsSSL =
  /\bsslmode=require\b/i.test(url) ||
  /^require$/i.test(process.env.PGSSLMODE || "") ||
  /^true$/i.test(process.env.DB_SSL || "");

declare global {
  // eslint-disable-next-line no-var
  var __escapePool: Pool | undefined;
}

// Återanvänd poolen mellan hot-reloads / lambda-anrop.
const pool =
  global.__escapePool ??
  new Pool({
    connectionString: url || undefined,
    ssl: wantsSSL ? { rejectUnauthorized: false } : undefined,
    max: 3,
  });
if (!global.__escapePool) global.__escapePool = pool;

export const db = drizzle(pool);
