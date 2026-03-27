import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Pricing",
  description: "Simple, transparent pricing for GeM tender tracking. Get real-time alerts and AI-powered summaries for relevant government bids.",
  alternates: { canonical: "https://www.gemtenders.org/pricing" },
  openGraph: {
    url: "https://www.gemtenders.org/pricing",
    title: "Pricing | GeMTenders.org",
    description: "Simple, transparent pricing for GeM tender tracking. Get real-time alerts and AI-powered summaries for relevant government bids.",
  },
};

export default function PricingLayout({ children }: { children: React.ReactNode }) {
  return children;
}
