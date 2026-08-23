import type { AnalyzePayload } from "@/lib/analyze-payload";
import { compileInvoices } from "@/lib/compile";
import { invoiceAnalysisSchema } from "@/lib/invoice-schema";

export type MemoryCompany = {
  id: string;
  name: string;
  branches: { id: string; name: string; currentSpend: number }[];
};

type MemoryState = {
  companies: MemoryCompany[];
  invoices: AnalyzePayload[];
};

const globalStore = globalThis as unknown as { vantageMemory?: MemoryState };

function seed(): MemoryState {
  const companies: MemoryCompany[] = [
    {
      id: "co_pacific",
      name: "Pacific Retail Group",
      branches: [
        { id: "br_sj", name: "San José", currentSpend: 9420 },
        { id: "br_he", name: "Heredia", currentSpend: 3180 },
        { id: "br_al", name: "Alajuela", currentSpend: 0 },
        { id: "br_ca", name: "Cartago", currentSpend: 0 },
      ],
    },
  ];

  const sample = invoiceAnalysisSchema.parse({
    invoiceNumber: "CN-8891",
    supplier: "CloudNet Ltd",
    companyGuess: "Pacific Retail Group",
    branchGuess: "San José",
    date: "2026-08-14",
    dueDate: "2026-09-13",
    total: 9492,
    taxAmount: 1320,
    currency: "USD",
    paymentTerms: "Net 30",
    category: "Connectivity",
    summary: "Monthly connectivity for the San José flagship.",
    brief: "CloudNet billed San José $9,492. Match to the network PO before posting.",
    advice: ["Match to PO-CN-8891.", "Confirm tax is included.", "Post to San José IT."],
    risks: [],
    questionsForAp: ["Does this include the Cartago circuit?"],
    cashImpact: "Cash leaves on 13 Sep if posted this week.",
    controllerChecks: ["Confirm branch", "Confirm total"],
    confidence: 0.86,
  });

  const invoices: AnalyzePayload[] = [
    {
      id: "demo_cn_8891",
      extraction: {
        method: "text",
        originalLength: 400,
        sentLength: 400,
        preview: "INVOICE CN-8891 CloudNet Ltd San José Total 9492 USD",
      },
      model: "demo",
      usedFallback: false,
      riskScore: 8,
      analysis: sample,
      company: "Pacific Retail Group",
      branch: "San José",
      originalFilename: "demo-cloudnet.txt",
      folderPath: "Pacific Retail Group/San José",
      status: "PROCESSED",
    },
  ];

  return { companies, invoices };
}

export function memoryState(): MemoryState {
  if (!globalStore.vantageMemory) {
    globalStore.vantageMemory = seed();
  }
  return globalStore.vantageMemory;
}

export function memoryReset() {
  globalStore.vantageMemory = {
    companies: seed().companies.map((company) => ({
      ...company,
      branches: company.branches.map((branch) => ({ ...branch, currentSpend: 0 })),
    })),
    invoices: [],
  };
}

export function memoryKnownNames() {
  const { companies } = memoryState();
  return {
    companies: companies.map((row) => row.name),
    branches: companies.flatMap((row) => row.branches.map((branch) => branch.name)),
  };
}

export function memoryResolveOrg(input: {
  companyHint?: string | null;
  branchHint?: string | null;
  analysisCompany?: string | null;
  analysisBranch?: string | null;
}) {
  const state = memoryState();
  const companyName = input.companyHint || input.analysisCompany || state.companies[0]?.name || "Holding company";
  let company = state.companies.find((row) => row.name.toLowerCase() === companyName.toLowerCase());
  if (!company) {
    company = {
      id: `co_${Date.now().toString(36)}`,
      name: companyName.slice(0, 80) || "Holding company",
      branches: [],
    };
    state.companies.push(company);
  }
  const branchName = input.branchHint || input.analysisBranch || company.branches[0]?.name || "Headquarters";
  let branch = company.branches.find((row) => row.name.toLowerCase() === branchName.toLowerCase());
  if (!branch) {
    branch = { id: `br_${Date.now().toString(36)}`, name: branchName.slice(0, 80) || "Headquarters", currentSpend: 0 };
    company.branches.push(branch);
  }
  return { company, branch };
}

export function memorySaveInvoice(payload: AnalyzePayload) {
  const state = memoryState();
  state.invoices = [payload, ...state.invoices.filter((row) => row.id !== payload.id)];
  const company = state.companies.find((row) => row.name === payload.company);
  const branch = company?.branches.find((row) => row.name === payload.branch);
  if (branch && payload.analysis.total) {
    branch.currentSpend += payload.analysis.total;
  }
}

export function memoryFindDuplicate(company: string, invoiceNumber: string, supplier: string) {
  return memoryState().invoices.find(
    (row) =>
      row.company === company &&
      row.analysis.invoiceNumber === invoiceNumber &&
      row.analysis.supplier === supplier,
  );
}

export function memoryLedgerPayload() {
  const state = memoryState();
  return {
    source: "demo" as const,
    companies: state.companies,
    results: state.invoices,
    compiled: compileInvoices(state.invoices),
  };
}
