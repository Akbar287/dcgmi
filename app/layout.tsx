import type { Metadata } from "next";
import { Figtree, Geist, Geist_Mono } from "next/font/google";

import { I18nProvider } from "@/lib/i18n/client";
import { getLocale, getTranslator } from "@/lib/i18n/server";
import { cn } from "@/lib/utils";

import "./globals.css";

const figtree = Figtree({ subsets: ["latin"], variable: "--font-sans" });

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslator();
  return { title: { default: t("app.name"), template: `%s · ${t("app.shortName")}` }, description: t("app.description") };
}

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const locale = await getLocale();
  return (
    <html
      lang={locale}
      className={cn("h-full", "antialiased", geistSans.variable, geistMono.variable, "font-sans", figtree.variable)}
    >
      <body className="flex min-h-full flex-col">
        <I18nProvider locale={locale}>{children}</I18nProvider>
      </body>
    </html>
  );
}
