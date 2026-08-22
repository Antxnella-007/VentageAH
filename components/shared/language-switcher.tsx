"use client";

import { LOCALES, type Locale } from "@/lib/i18n/dictionaries";
import { useI18n } from "@/components/shared/i18n-provider";
import { cn } from "@/lib/utils";

export function LanguageSwitcher() {
  const { locale, setLocale, t } = useI18n();

  return (
    <div className="flex rounded-lg border border-white/15 p-0.5">
      {LOCALES.map((item) => (
        <button
          key={item}
          type="button"
          onClick={() => setLocale(item as Locale)}
          className={cn(
            "rounded-md px-2 py-1 text-[11px] font-medium transition-colors",
            locale === item ? "bg-white text-navy" : "text-slate-300 hover:text-white",
          )}
          aria-label={t.lang[item]}
        >
          {item.toUpperCase()}
        </button>
      ))}
    </div>
  );
}
