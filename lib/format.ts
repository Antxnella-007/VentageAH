export function formatCurrency(
  amount: number,
  currency: string = "USD",
  options?: { compact?: boolean },
): string {
  const formatted = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency === "USDT" ? "USD" : currency,
    maximumFractionDigits: options?.compact ? 0 : 0,
  }).format(amount);

  if (currency === "USDT") {
    return `${formatted.replace("$", "").trim()} USDT`.replace(/^/, "");
  }
  return formatted;
}

export function formatUsd(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatUsdt(amount: number): string {
  return `${new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 0,
  }).format(amount)} USDT`;
}

export function formatPercent(value: number, digits = 1): string {
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(digits)}%`;
}

export function formatDate(value: Date | string): string {
  const date = typeof value === "string" ? new Date(value) : value;
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

export function formatTime(value: Date | string): string {
  const date = typeof value === "string" ? new Date(value) : value;
  return new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
}

export function formatDateTime(value: Date | string): string {
  return `${formatDate(value)} ${formatTime(value)}`;
}

export function shortHash(hash: string, size = 10): string {
  if (hash.length <= size + 4) return hash;
  return `${hash.slice(0, size)}…${hash.slice(-4)}`;
}
