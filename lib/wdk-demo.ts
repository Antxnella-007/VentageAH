import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { isDemoMode, isWdkDryRun } from "@/lib/config";
import { TREASURY_TEST_ADDRESS } from "@/demo-data/catalog";

const execFileAsync = promisify(execFile);

export async function simulateTreasuryAddress(): Promise<string> {
  return TREASURY_TEST_ADDRESS;
}

export async function simulateTreasuryBalance(): Promise<{
  amount: number;
  token: string;
  demo: true;
}> {
  return { amount: 250000, token: "USDT", demo: true };
}

export async function simulatePayment(input: {
  to: string;
  amount: number;
}): Promise<{
  mode: "demo" | "dry-run";
  transactionHash: string;
  previewed: true;
  broadcast: false;
}> {
  const suffix = Math.abs(hashCode(`${input.to}:${input.amount}`)).toString(16).slice(0, 6);
  const mode = isDemoMode() || isWdkDryRun() ? (isWdkDryRun() ? "dry-run" : "demo") : "demo";
  return {
    mode,
    transactionHash: `demo_tx_${suffix}`,
    previewed: true,
    broadcast: false,
  };
}

function hashCode(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(i);
    hash |= 0;
  }
  return hash;
}

export async function whichBinary(bin: string): Promise<boolean> {
  try {
    await execFileAsync(bin, ["--help"], { timeout: 4000 });
    return true;
  } catch {
    try {
      await execFileAsync("which", [bin], { timeout: 2000 });
      return true;
    } catch {
      return false;
    }
  }
}
