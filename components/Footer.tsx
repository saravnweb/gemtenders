import Link from "next/link";
import { CATEGORIES } from "@/lib/categories";

const stateLinks = [
  { label: "Delhi Tenders", href: "/?state=Delhi" },
  { label: "Maharashtra Tenders", href: "/?state=Maharashtra" },
  { label: "Karnataka Tenders", href: "/?state=Karnataka" },
  { label: "Tamil Nadu Tenders", href: "/?state=Tamil+Nadu" },
  { label: "Uttar Pradesh Tenders", href: "/?state=Uttar+Pradesh" },
  { label: "Gujarat Tenders", href: "/?state=Gujarat" },
  { label: "Rajasthan Tenders", href: "/?state=Rajasthan" },
  { label: "West Bengal Tenders", href: "/?state=West+Bengal" },
];

const categoryLinks = [
  CATEGORIES.find(c => c.id === "vehicles"),
  CATEGORIES.find(c => c.id === "computer-hardware"),
  CATEGORIES.find(c => c.id === "office-supplies"),
  CATEGORIES.find(c => c.id === "medical-equipment"),
  CATEGORIES.find(c => c.id === "construction"),
  CATEGORIES.find(c => c.id === "security-services"),
].filter(Boolean).map(c => ({ label: `${c!.label} Bids`, href: `/?category=${c!.id}` }));

export default function Footer() {
  return (
    <footer className="border-t border-slate-100 dark:border-border mt-16 w-full bg-slate-50/30 dark:bg-background">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-16">
        {/* SEO link grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-12">
          
          <nav aria-labelledby="footer-states-heading">
            <h2 id="footer-states-heading" className="text-[11px] font-bold text-slate-800 dark:text-foreground uppercase tracking-widest mb-4">
              Browse by State
            </h2>
            <ul className="space-y-2">
              {stateLinks.map((l) => (
                <li key={l.href}>
                  <Link
                    href={l.href}
                    className="text-[13px] font-medium text-slate-600 dark:text-muted-foreground hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
                  >
                    {l.label}
                  </Link>
                </li>
              ))}
              <li className="pt-2">
                <Link
                  href="/explore"
                  className="text-[13px] font-bold text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 transition-colors inline-flex items-center gap-1 group"
                >
                  Explore All States
                  <span className="transition-transform group-hover:translate-x-0.5" aria-hidden="true">&rarr;</span>
                </Link>
              </li>
            </ul>
          </nav>

          <nav aria-labelledby="footer-categories-heading">
            <h2 id="footer-categories-heading" className="text-[11px] font-bold text-slate-800 dark:text-foreground uppercase tracking-widest mb-4">
              Browse by Category
            </h2>
            <ul className="space-y-2">
              {categoryLinks.map((l) => (
                <li key={l.href}>
                  <Link
                    href={l.href}
                    className="text-[13px] font-medium text-slate-600 dark:text-muted-foreground hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
                  >
                    {l.label}
                  </Link>
                </li>
              ))}
              <li className="pt-2">
                <Link
                  href="/explore"
                  className="text-[13px] font-bold text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 transition-colors inline-flex items-center gap-1 group"
                >
                  Explore All Categories
                  <span className="transition-transform group-hover:translate-x-0.5" aria-hidden="true">&rarr;</span>
                </Link>
              </li>
            </ul>
          </nav>

          <nav aria-labelledby="footer-platform-heading">
            <h2 id="footer-platform-heading" className="text-[11px] font-bold text-slate-800 dark:text-foreground uppercase tracking-widest mb-4">
              Platform Features
            </h2>
            <ul className="space-y-2">
              {[
                { label: "Searchable GeM Tenders", href: "/explore" },
                { label: "AI Tender Summaries", href: "/pricing" },
                { label: "Premium Pro Plan", href: "/pricing" },
                { label: "Free Tender Alerts", href: "/signup" },
              ].map((l) => (
                <li key={l.href}>
                  <Link
                    href={l.href}
                    className="text-[13px] font-medium text-slate-600 dark:text-muted-foreground hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
                  >
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          <nav aria-labelledby="footer-company-heading">
            <h2 id="footer-company-heading" className="text-[11px] font-bold text-slate-800 dark:text-foreground uppercase tracking-widest mb-4">
              Resources & Support
            </h2>
            <ul className="space-y-2">
              {[
                { label: "About GeMTenders", href: "/about" },
                { label: "Privacy & Terms", href: "/privacy" },
                { label: "Help Center / WhatsApp", href: "https://wa.me/919952749408", target: "_blank" },
                { label: "Sitemap", href: "/sitemap.xml" },
              ].map((l) => (
                <li key={l.label}>
                  <Link
                    href={l.href}
                    target={l.target}
                    rel={l.target === "_blank" ? "noopener noreferrer" : undefined}
                    className="text-[13px] font-medium text-slate-600 dark:text-muted-foreground hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
                  >
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </div>

        {/* Bottom bar */}
        <div className="border-t border-slate-200 dark:border-border pt-8 flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-[12px] font-medium text-slate-500 dark:text-muted-foreground leading-relaxed">
            &copy; 2026 GeMTenders.org. Built for Small & Medium Enterprises. 
            All bid data is sourced from official government portals for discovery purposes.
          </p>
          <div className="flex items-center gap-6">
             <Link href="/privacy" className="text-[12px] font-medium text-slate-500 hover:text-slate-800 transition-colors">Privacy</Link>
             <Link href="/about" className="text-[12px] font-medium text-slate-500 hover:text-slate-800 transition-colors">About</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}

