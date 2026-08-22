import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { AppShell } from "@/components/shared/app-shell";
import { getHealth } from "@/lib/dashboard";
import { getCurrentRole } from "@/lib/roles";
import { getCurrentLocale } from "@/lib/i18n/locale";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Vantage Enterprise",
  description: "Privacy-first enterprise treasury copilot",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const [role, health, locale] = await Promise.all([
    getCurrentRole(),
    getHealth(),
    getCurrentLocale(),
  ]);

  return (
    <html
      lang={locale}
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full">
        <AppShell initialRole={role} initialHealth={health} initialLocale={locale}>
          {children}
        </AppShell>
      </body>
    </html>
  );
}

