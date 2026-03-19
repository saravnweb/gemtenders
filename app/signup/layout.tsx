import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Sign Up",
  description: "Create a free account on GeMTenders.org and start tracking GeM government tenders with AI-powered alerts.",
  robots: { index: false, follow: false },
};

export default function SignupLayout({ children }: { children: React.ReactNode }) {
  return children;
}
