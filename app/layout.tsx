import type { Metadata } from "next";
import { Outfit, JetBrains_Mono, Bricolage_Grotesque } from "next/font/google";
import "./globals.css";

const outfit = Outfit({ 
  subsets: ["latin"],
  variable: "--font-outfit",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
});

const bricolage = Bricolage_Grotesque({
  subsets: ["latin"],
  variable: "--font-bricolage",
});

const siteUrl = "https://gemtenders.org";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "GeMTenders.org | Advanced GeM Tender Tracking",
    template: "%s | GeMTenders.org",
  },
  description: "Track Government e-Marketplace (GeM) tenders with advanced summaries, real-time alerts, and smart keyword filtering. Never miss a relevant GeM bid again.",
  keywords: ["GeM tenders", "Government e-Marketplace", "GeM bid", "tender tracking", "government tenders India", "GeM portal bids", "tender alerts"],
  authors: [{ name: "GeMTenders.org" }],
  creator: "GeMTenders.org",
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  openGraph: {
    type: "website",
    locale: "en_IN",
    url: siteUrl,
    siteName: "GeMTenders.org",
    title: "GeMTenders.org | Advanced GeM Tender Tracking",
    description: "Track Government e-Marketplace (GeM) tenders with advanced summaries, real-time alerts, and smart keyword filtering.",
    images: [
      {
        url: `${siteUrl}/logo.png`,
        width: 1200,
        height: 630,
        alt: "GeMTenders.org - Advanced GeM Tender Tracking",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "GeMTenders.org | Advanced GeM Tender Tracking",
    description: "Track GeM tenders with advanced summaries and real-time alerts.",
    images: [`${siteUrl}/logo.png`],
    site: "@GeMTenders",
    creator: "@GeMTenders",
  },
  icons: {
    icon: "/favicon.png",
    shortcut: "/favicon.png",
  },
  alternates: {
    canonical: siteUrl,
  },
};

import Navbar from "@/components/Navbar";
import GoogleOneTap from "@/components/GoogleOneTap";
import ScrollToTop from "@/components/ScrollToTop";
import { ThemeProvider } from "next-themes";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${outfit.variable} ${jetbrainsMono.variable} ${bricolage.variable}`} suppressHydrationWarning>
      <body className="font-sans antialiased">
        <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false}>
          <GoogleOneTap />
          <Navbar />
          {children}
          <ScrollToTop />
        </ThemeProvider>
      </body>
    </html>
  );
}

