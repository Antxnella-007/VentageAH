import { InvoiceWorkspace } from "@/components/invoices/invoice-workspace";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function InvoicesPage() {
  const invoices = await prisma.invoice.findMany({
    include: { branch: true },
    orderBy: { createdAt: "desc" },
  });

  return (
    <InvoiceWorkspace
      initialInvoices={invoices.map((invoice) => ({
        id: invoice.id,
        invoiceNumber: invoice.invoiceNumber,
        supplier: invoice.supplier,
        branch: invoice.branch.name,
        date: invoice.date.toISOString(),
        total: invoice.total,
        currency: invoice.currency,
        status: invoice.status,
        originalFilename: invoice.originalFilename,
        reconciliationStatus: invoice.reconciliationStatus,
        flagReason: invoice.flagReason,
      }))}
    />
  );
}
