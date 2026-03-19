import type { Metadata } from "next";
import { Outfit, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const outfit = Outfit({ 
  subsets: ["latin"],
  variable: "--font-outfit",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
});

const siteUrl = "https://gemtenders.org";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "GeMTenders.org | AI-Powered GeM Tender Tracking",
    template: "%s | GeMTenders.org",
  },
  description: "Track Government e-Marketplace (GeM) tenders with AI-powered summaries, real-time alerts, and smart keyword filtering. Never miss a relevant GeM bid again.",
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
    title: "GeMTenders.org | AI-Powered GeM Tender Tracking",
    description: "Track Government e-Marketplace (GeM) tenders with AI-powered summaries, real-time alerts, and smart keyword filtering.",
    images: [
      {
        url: "/logo.png",
        width: 1200,
        height: 630,
        alt: "GeMTenders.org - AI-Powered GeM Tender Tracking",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "GeMTenders.org | AI-Powered GeM Tender Tracking",
    description: "Track GeM tenders with AI-powered summaries and real-time alerts.",
    images: ["/logo.png"],
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

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${outfit.variable} ${jetbrainsMono.variable}`}>
      <body className="font-sans antialiased">
        <GoogleOneTap />
        <Navbar />
        {children}
        <ScrollToTop />
      </body>
    </html>
  );
}

