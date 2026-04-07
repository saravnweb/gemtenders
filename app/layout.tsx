import type { Metadata, Viewport } from "next";
import Script from "next/script";
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

const siteUrl = "https://www.gemtenders.org";

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
    default: "GeMTenders.org — AI-Powered GeM Portal Tender Tracking India",
    template: "%s | GeMTenders.org",
  },
  description: "Track live bids and tenders on India's Government e-Marketplace (GeM) portal using AI. Search, filter and monitor GeM tenders in real time.",
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
    title: "GeMTenders.org — AI-Powered GeM Portal Tender Tracking India",
    description: "Track live bids and tenders on India's Government e-Marketplace (GeM) portal using AI. Search, filter and monitor GeM tenders in real time.",
    images: [
      {
        url: `${siteUrl}/logo.png`,
        width: 1200,
        height: 630,
        alt: "GeMTenders.org — AI-Powered GeM Portal Tender Tracking India",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "GeMTenders.org — AI-Powered GeM Portal Tender Tracking India",
    description: "Track live bids and tenders on India's Government e-Marketplace (GeM) portal using AI. Search, filter and monitor GeM tenders in real time.",
    images: [`${siteUrl}/logo.png`],
    site: "@GeMTenders",
    creator: "@GeMTenders",
  },
  icons: {
    icon: [
      { url: '/favicon.png', sizes: '32x32', type: 'image/png' },
    ],
    shortcut: '/favicon.png',
    apple: '/favicon.png',
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
import { ThemeProvider } from "next-themes";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${outfit.variable} ${jetbrainsMono.variable} ${bricolage.variable}`} suppressHydrationWarning>
      <head>
        {/* Google Analytics */}
        <Script
          src="https://www.googletagmanager.com/gtag/js?id=G-3GD5YYRK3M"
          strategy="afterInteractive"
        />
        <Script
          id="google-analytics"
          strategy="afterInteractive"
          dangerouslySetInnerHTML={{
            __html: `
              window.dataLayer = window.dataLayer || [];
              function gtag(){dataLayer.push(arguments);}
              gtag('js', new Date());
              gtag('config', 'G-3GD5YYRK3M');
            `,
          }}
        />
      </head>
      <body className="font-sans antialiased">
        <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false}>
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

