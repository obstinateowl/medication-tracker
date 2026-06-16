type MysqlError = Error & {
  code?: string;
  errno?: number;
  sqlState?: string;
  sqlMessage?: string;
};

export type DbErrorInfo = {
  message: string;
  code: string | null;
  hint: string;
  details: string;
};

const HINTS: Record<string, string> = {
  ECONNREFUSED:
    "Nothing is listening on that host/port. Check DB_HOST and DB_PORT, ensure MariaDB is running, and verify firewall rules allow inbound 3306.",
  ETIMEDOUT:
    "Connection timed out. The host may be unreachable — check the IP, network route, and firewall on the MariaDB machine.",
  ENOTFOUND:
    "Hostname could not be resolved. Verify DB_HOST is a valid IP or hostname on your network.",
  ER_ACCESS_DENIED_ERROR:
    "Authentication failed. Verify DB_USER and DB_PASSWORD in .env, and that the user is allowed to connect from this machine's IP (e.g. 'medtracker'@'192.168.x.x' or '%').",
  ER_BAD_DB_ERROR:
    "Database does not exist. Run server/sql/001_init.sql on your MariaDB server to create it.",
  ER_HOST_NOT_PRIVILEGED:
    "This client host is not allowed to connect. Grant access from your app's IP on the MariaDB server.",
  PROTOCOL_CONNECTION_LOST:
    "Connection was lost. MariaDB may have restarted or closed idle connections.",
  EHOSTUNREACH:
    "Host unreachable on the network. Check routing and that both machines are on the same LAN/VPN.",
};

export function formatDbError(err: unknown): DbErrorInfo {
  const e = err as MysqlError;
  const code = e.code ?? null;
  const details = e.sqlMessage ?? e.message ?? String(err);
  const hint =
    (code && HINTS[code]) ||
    "Check .env database settings and the README database setup section.";

  let message = "Database connection failed";
  if (code === "ECONNREFUSED") {
    message = `Cannot reach MariaDB at ${details.includes("connect") ? "configured host" : "server"}`;
  } else if (code === "ER_ACCESS_DENIED_ERROR") {
    message = "MariaDB rejected the username or password";
  } else if (code === "ER_BAD_DB_ERROR") {
    message = `Database "${details.match(/Unknown database '(.+?)'/)?.[1] ?? "medication_tracker"}" not found`;
  } else if (code === "ETIMEDOUT" || code === "ENOTFOUND") {
    message = "Cannot reach the MariaDB host";
  }

  return { message, code, hint, details };
}

export function isDbError(err: unknown): boolean {
  const code = (err as MysqlError).code;
  if (!code) return false;
  return (
    code.startsWith("ER_") ||
    [
      "ECONNREFUSED",
      "ETIMEDOUT",
      "ENOTFOUND",
      "EHOSTUNREACH",
      "PROTOCOL_CONNECTION_LOST",
    ].includes(code)
  );
}
