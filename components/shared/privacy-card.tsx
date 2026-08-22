import { Check } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function PrivacyCard() {
  const items = [
    "Invoice OCR local",
    "Invoice extraction local",
    "Financial analysis local",
  ];

  return (
    <Card className="border-border shadow-sm">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium tracking-wide text-muted-foreground">
          Local AI Processing
        </CardTitle>
        <p className="text-lg font-semibold text-foreground">QVAC</p>
      </CardHeader>
      <CardContent className="space-y-2 text-sm">
        {items.map((item) => (
          <p key={item} className="flex items-center gap-2 text-foreground">
            <Check className="size-4 text-emerald-600" />
            {item}
          </p>
        ))}
        <p className="pt-2 text-xs text-muted-foreground">
          No external AI provider. Financial documents never need to leave your infrastructure.
        </p>
        <p className="text-xs font-medium text-emerald-700">Processed locally with QVAC.</p>
      </CardContent>
    </Card>
  );
}
