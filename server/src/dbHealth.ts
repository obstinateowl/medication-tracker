import pool from "./db.js";
import { getDbConfigPublic } from "./config.js";
import { formatDbError, type DbErrorInfo } from "./dbErrors.js";

export type DbHealthResult =
  | { ok: true; latencyMs: number; config: ReturnType<typeof getDbConfigPublic> }
  | { ok: false; config: ReturnType<typeof getDbConfigPublic> } & DbErrorInfo;

export async function checkDatabase(): Promise<DbHealthResult> {
  const configPublic = getDbConfigPublic();
  const started = Date.now();

  try {
    const conn = await pool.getConnection();
    try {
      await conn.query("SELECT 1");
    } finally {
      conn.release();
    }
    return {
      ok: true,
      latencyMs: Date.now() - started,
      config: configPublic,
    };
  } catch (err) {
    const formatted = formatDbError(err);
    return {
      ok: false,
      config: configPublic,
      ...formatted,
    };
  }
}

export function logDbHealth(result: DbHealthResult): void {
  if (result.ok) {
    console.log(
      `[db] Connected to ${result.config.host}:${result.config.port}/${result.config.database} (${result.latencyMs}ms)`
    );
    return;
  }

  console.error("[db] Connection failed");
  console.error(`  Message: ${result.message}`);
  if (result.code) console.error(`  Code:    ${result.code}`);
  console.error(`  Details: ${result.details}`);
  console.error(`  Hint:    ${result.hint}`);
  console.error(
    `  Config:  ${result.config.host}:${result.config.port} db=${result.config.database} user=${result.config.user}`
  );
  if (!result.config.envFileFound) {
    console.error(`  Warning: .env not found at ${result.config.envFile}`);
  }
}
