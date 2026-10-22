import type { Metadata, Viewport } from "next";
import { Bricolage_Grotesque, Geist } from "next/font/google";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { dir, locale, t } from "@/i18n";
import "./globals.css";

const bricolage = Bricolage_Grotesque({
  variable: "--font-bricolage",
  subsets: ["latin", "latin-ext"],
  axes: ["opsz"],
  display: "swap",
});

const geist = Geist({
  variable: "--font-geist",
  subsets: ["latin", "latin-ext"],
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL("https://www.rolearch.com"),
  title: { default: t("meta.title"), template: t("meta.titleTemplate") },
  description: t("meta.description"),
  applicationName: "Rolearch",
  openGraph: {
    type: "website",
    siteName: "Rolearch",
    title: t("meta.title"),
    description: t("meta.description"),
    locale: "en_US",
  },
  twitter: { card: "summary_large_image", title: t("meta.title"), description: t("meta.description") },
  alternates: { canonical: "/" },
};

export const viewport: Viewport = {
  themeColor: "#f4f5f1",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang={locale} dir={dir} className={`${bricolage.variable} ${geist.variable} antialiased`}>
      <body className="flex min-h-dvh flex-col">
        <SiteHeader />
        <main id="main" className="flex-1">
          {children}
        </main>
        <SiteFooter />
      </body>
    </html>
  );
}
