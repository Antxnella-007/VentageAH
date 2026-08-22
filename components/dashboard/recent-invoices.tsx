"use client";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatDate, formatUsd } from "@/lib/format";
import { useI18n } from "@/components/shared/i18n-provider";

export function RecentInvoices({
  invoices,
}: {
  invoices: {
    id: string;
    invoiceNumber: string;
    supplier: string;
    branch: string;
    amount: number;
    date: Date | string;
    status: string;
  }[];
}) {
  const { t } = useI18n();
  return (
    <Card>
      <CardHeader>
        <CardTitle>{t.dashboard.recent}</CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t.dashboard.colInvoice}</TableHead>
              <TableHead>{t.dashboard.colSupplier}</TableHead>
              <TableHead>{t.dashboard.colBranch}</TableHead>
              <TableHead>{t.dashboard.colAmount}</TableHead>
              <TableHead>{t.dashboard.colDate}</TableHead>
              <TableHead>{t.dashboard.colStatus}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {invoices.map((invoice) => (
              <TableRow key={invoice.id}>
                <TableCell className="font-medium">{invoice.invoiceNumber}</TableCell>
                <TableCell>{invoice.supplier}</TableCell>
                <TableCell>{invoice.branch}</TableCell>
                <TableCell>{formatUsd(invoice.amount)}</TableCell>
                <TableCell>{formatDate(invoice.date)}</TableCell>
                <TableCell>
                  <InvoiceStatus status={invoice.status} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

export function InvoiceStatus({ status }: { status: string }) {
  const { t } = useI18n();
  const labels = t.invoiceStatus as Record<string, string>;
  const variant =
    status === "FLAGGED" || status === "ERROR"
      ? "destructive"
      : status === "PROCESSED"
        ? "default"
        : "secondary";
  return <Badge variant={variant}>{labels[status] ?? status}</Badge>;
}
