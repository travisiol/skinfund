import type { Metadata, Viewport } from "next";
import { Barlow, Cinzel, IBM_Plex_Mono } from "next/font/google";
import { WalletDialog } from "@/components/WalletDialog";
import { SITE } from "@/config/site";
import "./globals.css";

// All three families are downloaded at build time and served from this origin.
const cinzel = Cinzel({ variable: "--font-cinzel", subsets: ["latin"], weight: ["700"], display: "swap" });
const barlow = Barlow({ variable: "--font-barlow", subsets: ["latin"], weight: ["400", "500", "600"], display: "swap" });
const plex = IBM_Plex_Mono({ variable: "--font-plex", subsets: ["latin"], weight: ["500"], display: "swap" });

export const metadata: Metadata = {
  title: { default: SITE.title, template: "%s · skinfund" },
  description: SITE.description,
};

export const viewport: Viewport = { themeColor: "#091821" };

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${cinzel.variable} ${barlow.variable} ${plex.variable} h-full`}>
      <body className="flex min-h-full flex-col">
        <a href="#main" className="btn btn-sm frame btn-primary sr-only focus:not-sr-only focus:absolute focus:top-3 focus:left-3 focus:z-50">
          Skip to content
        </a>
        {children}
        <WalletDialog />
      </body>
    </html>
  );
}
