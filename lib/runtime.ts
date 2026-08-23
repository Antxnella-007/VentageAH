export function isDemoMode() {
  return process.env.DEMO_MODE === "true";
}

export function isVercel() {
  return process.env.VERCEL === "1";
}

export function databaseUrl() {
  return process.env.DATABASE_URL ?? "file:./dev.db";
}

export function isSqliteUrl(url = databaseUrl()) {
  return url.startsWith("file:");
}

/** Vercel disk is ephemeral; SQLite there is not a real store. */
export function useMemoryLedger() {
  if (isDemoMode()) return true;
  return isVercel() && isSqliteUrl();
}
