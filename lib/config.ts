export function isDemoMode(): boolean {
  return process.env.DEMO_MODE !== "false";
}

export function isWdkDryRun(): boolean {
  return process.env.WDK_DRY_RUN !== "false";
}

export function getQvacBaseUrl(): string {
  return process.env.QVAC_BASE_URL ?? "http://localhost:11434/v1";
}

export function getQvacModel(): string {
  return process.env.QVAC_MODEL ?? "local-llm";
}

export function getWdkWalletName(): string {
  return process.env.WDK_WALLET_NAME ?? "vantage-treasury";
}

export function getWdkNetwork(): string {
  return process.env.WDK_NETWORK ?? "ethereum";
}

export function getWdkToken(): string {
  return process.env.WDK_TOKEN ?? "USDT";
}

export function getWdkBin(): string {
  return process.env.WDK_BIN ?? "wdk";
}

export function environmentLabel(): "Demo" | "Live" {
  return isDemoMode() ? "Demo" : "Live";
}
