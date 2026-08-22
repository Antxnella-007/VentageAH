import { prisma } from "@/lib/db";

export async function resolveCompanyAndBranch(input: {
  companyHint?: string | null;
  branchHint?: string | null;
  analysisCompany?: string | null;
  analysisBranch?: string | null;
}) {
  const companies = await prisma.company.findMany({ include: { branches: true } });
  const companyName = input.companyHint || input.analysisCompany || companies[0]?.name || "Holding company";

  let company = companies.find((row) => namesMatch(row.name, companyName));
  if (!company) {
    company = await prisma.company.create({
      data: { name: title(companyName) },
      include: { branches: true },
    });
  }

  const branchName = input.branchHint || input.analysisBranch || company.branches[0]?.name || "Headquarters";
  let branch = company.branches.find((row) => namesMatch(row.name, branchName));
  if (!branch) {
    branch = await prisma.branch.create({
      data: {
        name: title(branchName),
        companyId: company.id,
        historicalAverage: 40000,
        currentSpend: 0,
      },
    });
  }

  return { company, branch };
}

export async function knownOrgNames() {
  const companies = await prisma.company.findMany({ include: { branches: true }, orderBy: { name: "asc" } });
  return {
    companies: companies.map((row) => row.name),
    branches: companies.flatMap((row) => row.branches.map((branch) => branch.name)),
  };
}

function namesMatch(a: string, b: string) {
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}

function title(value: string) {
  return value.replace(/\s+/g, " ").trim().slice(0, 80) || "Unassigned";
}
