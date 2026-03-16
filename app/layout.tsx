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

export const metadata: Metadata = {
  title: "GeMTenders.org | Automated Tender Tracking",
  description: "Identify and track Government e-Marketplace (GeM) tenders with AI-powered summaries and real-time alerts.",
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
      <body className="font-sans antialiased bg-white">
        <GoogleOneTap />
        <Navbar />
        {children}
        <ScrollToTop />
      </body>
    </html>
  );
}

