"use client";

import { Check } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useI18n } from "@/components/shared/i18n-provider";

export function PrivacyCard() {
  const { t } = useI18n();
  const items = [t.dashboard.ocr, t.dashboard.extract, t.dashboard.analysis];

  return (
    <Card className="border-border shadow-sm">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium tracking-wide text-muted-foreground">
          {t.dashboard.privacyTitle}
        </CardTitle>
        <p className="text-lg font-semibold text-foreground">{t.dashboard.privacyLead}</p>
      </CardHeader>
      <CardContent className="space-y-2 text-sm">
        {items.map((item) => (
          <p key={item} className="flex items-center gap-2 text-foreground">
            <Check className="size-4 text-emerald-600" />
            {item}
          </p>
        ))}
        <p className="pt-2 text-xs text-muted-foreground">{t.dashboard.noExternal}</p>
        <p className="text-xs font-medium text-emerald-700">{t.dashboard.processedLocal}</p>
      </CardContent>
    </Card>
  );
}
