import type { Metadata, Viewport } from "next";
import Script from "next/script";
import { Outfit, JetBrains_Mono, Bricolage_Grotesque } from "next/font/google";
import "./globals.css";

const outfit = Outfit({
  subsets: ["latin"],
  variable: "--font-outfit",
  display: "optional",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  display: "swap",
});

const bricolage = Bricolage_Grotesque({
  subsets: ["latin"],
  variable: "--font-bricolage",
  display: "optional",
});

const siteUrl = "https://gemtenders.org";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#202124" },
  ],
};

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "GeMTenders.org — Searchable GeM Tender Tracking & AI Summaries",
    template: "%s | GeMTenders.org",
  },
  description: "Official site limiting your search? Use GeMTenders for searchable GeM tender tracking by keyword. Find government work easily with simple AI summaries and alerts.",
  keywords: ["searchable gem tenders", "gem tender tracking", "keyword search gem", "government tenders India", "GeM portal bids", "tender alerts"],
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
    title: "GeMTenders.org — Searchable GeM Tender Tracking & AI Summaries",
    description: "Official site limiting your search? Use GeMTenders for searchable GeM tender tracking by keyword. Find government work easily with simple AI summaries and alerts.",
    images: [
      {
        url: `${siteUrl}/logo.png`,
        width: 1200,
        height: 630,
        alt: "GeMTenders.org — Searchable GeM Tender Tracking & AI Summaries",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "GeMTenders.org — Searchable GeM Tender Tracking & AI Summaries",
    description: "Official site limiting your search? Use GeMTenders for searchable GeM tender tracking by keyword. Find government work easily with simple AI summaries and alerts.",
    images: [`${siteUrl}/logo.png`],
    site: "@GeMTenders",
    creator: "@GeMTenders",
  },
  manifest: '/manifest.json',
  icons: {
    icon: [
      { url: '/favicon-32x32.png', sizes: '32x32', type: 'image/png' },
      { url: '/favicon-16x16.png', sizes: '16x16', type: 'image/png' },
      { url: '/android-chrome-192x192.png', sizes: '192x192', type: 'image/png' },
      { url: '/android-chrome-512x512.png', sizes: '512x512', type: 'image/png' },
    ],
    shortcut: '/favicon.ico',
    apple: '/apple-touch-icon.png',
  },
  alternates: {
    canonical: siteUrl,
    languages: {
      'en-IN': siteUrl,
    },
  },
};

import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import GoogleOneTap from "@/components/GoogleOneTap";
import ScrollToTop from "@/components/ScrollToTop";
import PWARegister from "@/app/pwa-register";
import { ThemeProvider } from "next-themes";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const organizationJsonLd = {
    "@context": "https://schema.org",
    "@type": "Organization",
    "name": "GeMTenders.org",
    "url": siteUrl,
    "logo": `${siteUrl}/android-chrome-512x512.png`,
    "sameAs": [
      "https://twitter.com/GeMTenders",
    ],
    "description": "AI-powered searchable GeM tender tracking and simplified summaries for Indian government bids.",
  };

  const websiteJsonLd = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "name": "GeMTenders.org",
    "url": siteUrl,
    "potentialAction": {
      "@type": "SearchAction",
      "target": {
        "@type": "EntryPoint",
        "urlTemplate": `${siteUrl}/explore?q={search_term_string}`
      },
      "query-input": "required name=search_term_string"
    }
  };

  return (
    <html lang="en" className={`${outfit.variable} ${jetbrainsMono.variable} ${bricolage.variable}`} suppressHydrationWarning>
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationJsonLd) }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteJsonLd) }}
        />
        {/* Google Analytics */}
        <Script
          src="https://www.googletagmanager.com/gtag/js?id=G-3GD5YYRK3M"
          strategy="lazyOnload"
        />
        <Script
          id="google-analytics"
          strategy="lazyOnload"
          dangerouslySetInnerHTML={{
            __html: `
              window.dataLayer = window.dataLayer || [];
              function gtag(){dataLayer.push(arguments);}
              gtag('js', new Date());
              gtag('config', 'G-3GD5YYRK3M');
            `,
          }}
        />
        <link rel="preconnect" href="https://gemtenders.org" />
        <link rel="dns-prefetch" href="https://gemtenders.org" />
        <link rel="preconnect" href="https://hupvlvscskpserofewox.supabase.co" crossOrigin="anonymous" />
        <link rel="dns-prefetch" href="https://hupvlvscskpserofewox.supabase.co" />
        <link rel="preconnect" href="https://www.googletagmanager.com" />
        <link rel="dns-prefetch" href="https://www.googletagmanager.com" />
        <link rel="preconnect" href="https://accounts.google.com" />
        <link rel="dns-prefetch" href="https://accounts.google.com" />
        <link rel="preload" href="/android-chrome-192x192.png" as="image" fetchPriority="high" />
      </head>
      <body className="font-sans antialiased">
        <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false}>
          <PWARegister />
          <a
            href="#main-content"
            className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-200 focus:px-4 focus:py-2 focus:bg-white focus:text-blue-700 focus:font-bold focus:rounded-lg focus:shadow-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            Skip to main content
          </a>
          <GoogleOneTap />
          <Navbar />
          {children}
          <Footer />
          <ScrollToTop />
        </ThemeProvider>
      </body>
    </html>
  );
}

