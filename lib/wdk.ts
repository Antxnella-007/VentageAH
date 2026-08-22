import { execFile } from "node:child_process";
import { promisify } from "node:util";
import {
  getWdkBin,
  getWdkNetwork,
  getWdkToken,
  getWdkWalletName,
  isDemoMode,
  isWdkDryRun,
} from "@/lib/config";
import {
  simulatePayment,
  simulateTreasuryAddress,
  simulateTreasuryBalance,
  whichBinary,
} from "@/lib/wdk-demo";
import { paymentRequestSchema } from "@/lib/validators";

const execFileAsync = promisify(execFile);

export type WdkHealth = {
  status: "online" | "dry-run" | "unavailable";
  detail: string;
};

export type PaymentRequest = {
  to: string;
  amount: number;
  token?: string;
  network?: string;
  wallet?: string;
};

export type PaymentExecutionResult = {
  ok: boolean;
  mode: "live" | "dry-run" | "demo";
  transactionHash?: string;
  previewed: boolean;
  broadcast: boolean;
  detail: string;
};

type WdkCommand = {
  bin: string;
  args: string[];
};

/**
 * Isolated WDK CLI command builder.
 * Documented commands (WDK CLI):
 *   wdk get address --network <network> --wallet <name>
 *   wdk get balance --network <network> --wallet <name> --json
 *   wdk send --network <network> --to <address> --amount <decimal>
 *            --token <ticker> --wallet <name> [--dry-run] [--json]
 */
export function buildWdkCommand(
  action: "address" | "balance" | "send",
  payment?: PaymentRequest,
): WdkCommand {
  const bin = getWdkBin();
  const network = payment?.network ?? getWdkNetwork();
  const wallet = payment?.wallet ?? getWdkWalletName();

  if (action === "address") {
    return { bin, args: ["get", "address", "--network", network, "--wallet", wallet] };
  }
  if (action === "balance") {
    return {
      bin,
      args: ["get", "balance", "--network", network, "--wallet", wallet, "--json"],
    };
  }

  const parsed = paymentRequestSchema.parse({
    to: payment?.to,
    amount: payment?.amount,
    token: payment?.token ?? getWdkToken(),
    network,
    wallet,
  });

  const args = [
    "send",
    "--network",
    parsed.network,
    "--to",
    parsed.to,
    "--amount",
    String(parsed.amount),
    "--token",
    parsed.token,
    "--wallet",
    parsed.wallet,
    "--json",
  ];

  if (isWdkDryRun()) {
    args.push("--dry-run");
  }

  return { bin, args };
}

export async function checkWdkHealth(): Promise<WdkHealth> {
  const available = await whichBinary(getWdkBin());
  if (available && !isWdkDryRun() && !isDemoMode()) {
    return { status: "online", detail: "WDK CLI is available." };
  }
  if (available && isWdkDryRun()) {
    return { status: "dry-run", detail: "WDK CLI is available. Payments will use --dry-run." };
  }
  if (isDemoMode() || isWdkDryRun()) {
    return {
      status: "dry-run",
      detail: "WDK CLI was not detected. Treasury execution uses demo / dry-run simulation.",
    };
  }
  return { status: "unavailable", detail: "WDK CLI is not installed." };
}

export async function getTreasuryAddress(): Promise<string> {
  if (isDemoMode()) {
    return simulateTreasuryAddress();
  }
  try {
    const { bin, args } = buildWdkCommand("address");
    const { stdout } = await execFileAsync(bin, args, { timeout: 8000 });
    return parseAddress(stdout) ?? (await simulateTreasuryAddress());
  } catch {
    return simulateTreasuryAddress();
  }
}

export async function getTreasuryBalance(): Promise<{ amount: number; token: string }> {
  if (isDemoMode()) {
    return simulateTreasuryBalance();
  }
  try {
    const { bin, args } = buildWdkCommand("balance");
    const { stdout } = await execFileAsync(bin, args, { timeout: 8000 });
    const parsed = parseBalance(stdout);
    if (parsed) return parsed;
  } catch {
    // fall through to simulation
  }
  return simulateTreasuryBalance();
}

export async function previewPayment(payment: PaymentRequest): Promise<PaymentExecutionResult> {
  return executePayment({ ...payment }, true);
}

export async function executePayment(
  payment: PaymentRequest,
  forcePreview = false,
): Promise<PaymentExecutionResult> {
  const parsed = paymentRequestSchema.parse({
    to: payment.to,
    amount: payment.amount,
    token: payment.token ?? getWdkToken(),
    network: payment.network ?? getWdkNetwork(),
    wallet: payment.wallet ?? getWdkWalletName(),
  });

  const shouldSimulate = isDemoMode() || isWdkDryRun() || forcePreview;
  const available = await whichBinary(getWdkBin());

  if (!available || shouldSimulate) {
    const simulated = await simulatePayment(parsed);
    return {
      ok: true,
      mode: simulated.mode === "dry-run" ? "dry-run" : "demo",
      transactionHash: simulated.transactionHash,
      previewed: true,
      broadcast: false,
      detail:
        simulated.mode === "dry-run"
          ? "Dry run — WDK did not broadcast a transaction."
          : "Demo transaction — no blockchain confirmation.",
    };
  }

  try {
    const { bin, args } = buildWdkCommand("send", parsed);
    const { stdout } = await execFileAsync(bin, args, { timeout: 20000 });
    const hash = parseTxHash(stdout);
    const dry = args.includes("--dry-run");
    return {
      ok: true,
      mode: dry ? "dry-run" : "live",
      transactionHash: hash,
      previewed: dry,
      broadcast: !dry,
      detail: dry ? "Dry run preview from WDK CLI." : "WDK reported a send result.",
    };
  } catch {
    return {
      ok: false,
      mode: isWdkDryRun() ? "dry-run" : "live",
      previewed: false,
      broadcast: false,
      detail: "Payment could not be executed. The batch will continue with remaining suppliers.",
    };
  }
}

export async function executeBatch(
  payments: PaymentRequest[],
): Promise<PaymentExecutionResult[]> {
  const results: PaymentExecutionResult[] = [];
  for (const payment of payments) {
    results.push(await executePayment(payment));
  }
  return results;
}

function parseAddress(stdout: string): string | null {
  const trimmed = stdout.trim();
  try {
    const json = JSON.parse(trimmed) as Record<string, unknown>;
    const candidate =
      (json.address as string | undefined) ??
      (json.result as { address?: string } | undefined)?.address ??
      (Array.isArray(json.addresses)
        ? (json.addresses[0] as { address?: string })?.address
        : undefined);
    if (candidate && /^0x[a-fA-F0-9]{40}$/.test(candidate)) return candidate;
  } catch {
    const match = trimmed.match(/0x[a-fA-F0-9]{40}/);
    if (match) return match[0];
  }
  return null;
}

function parseBalance(stdout: string): { amount: number; token: string } | null {
  try {
    const json = JSON.parse(stdout) as Record<string, unknown>;
    const amount = Number(json.amount ?? json.balance ?? json.total);
    if (Number.isFinite(amount)) {
      return { amount, token: String(json.token ?? getWdkToken()) };
    }
  } catch {
    const match = stdout.match(/([0-9]+(?:\.[0-9]+)?)/);
    if (match) return { amount: Number(match[1]), token: getWdkToken() };
  }
  return null;
}

function parseTxHash(stdout: string): string | undefined {
  const match = stdout.match(/0x[a-fA-F0-9]{64}/);
  return match?.[0];
}
