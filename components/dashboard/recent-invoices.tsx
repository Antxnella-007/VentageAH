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
  return (
    <Card>
      <CardHeader>
        <CardTitle>Recent invoices</CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Invoice</TableHead>
              <TableHead>Supplier</TableHead>
              <TableHead>Branch</TableHead>
              <TableHead>Amount</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Status</TableHead>
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
  const map: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
    UPLOADED: { label: "Uploaded", variant: "secondary" },
    PROCESSING: { label: "Processing", variant: "outline" },
    PROCESSED: { label: "Processed", variant: "default" },
    FLAGGED: { label: "Flagged", variant: "destructive" },
    ERROR: { label: "Error", variant: "destructive" },
  };
  const item = map[status] ?? { label: status, variant: "secondary" as const };
  return <Badge variant={item.variant}>{item.label}</Badge>;
}
