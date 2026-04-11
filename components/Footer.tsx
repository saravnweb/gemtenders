import Link from "next/link";
import { CATEGORIES } from "@/lib/categories";

const stateLinks = [
  { label: "Delhi", href: "/?state=Delhi" },
  { label: "Maharashtra", href: "/?state=Maharashtra" },
  { label: "Karnataka", href: "/?state=Karnataka" },
  { label: "Tamil Nadu", href: "/?state=Tamil+Nadu" },
  { label: "Uttar Pradesh", href: "/?state=Uttar+Pradesh" },
  { label: "Gujarat", href: "/?state=Gujarat" },
  { label: "Rajasthan", href: "/?state=Rajasthan" },
  { label: "West Bengal", href: "/?state=West+Bengal" },
];

const categoryLinks = [
  CATEGORIES.find(c => c.id === "vehicles"),
  CATEGORIES.find(c => c.id === "computer-hardware"),
  CATEGORIES.find(c => c.id === "office-supplies"),
  CATEGORIES.find(c => c.id === "medical-equipment"),
  CATEGORIES.find(c => c.id === "construction"),
  CATEGORIES.find(c => c.id === "security-services"),
].filter(Boolean).map(c => ({ label: c!.label, href: `/?category=${c!.id}` }));

export default function Footer() {
  return (
    <footer className="border-t border-slate-100 dark:border-border mt-16 w-full">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* SEO link grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-8">
          <div>
            <p className="text-[11px] font-bold text-slate-600 dark:text-muted-foreground uppercase tracking-widest mb-2">
              Browse by State
            </p>
            <ul className="space-y-1">
              {stateLinks.map((l) => (
                <li key={l.href}>
                  <Link
                    href={l.href}
                    className="text-[12px] font-medium text-slate-600 dark:text-muted-foreground hover:text-slate-800 dark:hover:text-foreground transition-colors focus-visible:outline-none focus-visible:underline"
                  >
                    {l.label}
                  </Link>
                </li>
              ))}
              <li>
                <Link
                  href="/explore"
                  className="text-[12px] font-bold text-blue-600 dark:text-link hover:text-blue-700 dark:hover:text-link-hover transition-colors focus-visible:outline-none focus-visible:underline mt-2 inline-block"
                >
                  View All States &rarr;
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <p className="text-[11px] font-bold text-slate-600 dark:text-muted-foreground uppercase tracking-widest mb-2">
              Browse by Category
            </p>
            <ul className="space-y-1">
              {categoryLinks.map((l) => (
                <li key={l.href}>
                  <Link
                    href={l.href}
                    className="text-[12px] font-medium text-slate-600 dark:text-muted-foreground hover:text-slate-800 dark:hover:text-foreground transition-colors focus-visible:outline-none focus-visible:underline"
                  >
                    {l.label}
                  </Link>
                </li>
              ))}
              <li>
                <Link
                  href="/explore"
                  className="text-[12px] font-bold text-blue-600 dark:text-link hover:text-blue-700 dark:hover:text-link-hover transition-colors focus-visible:outline-none focus-visible:underline mt-2 inline-block"
                >
                  View All Categories &rarr;
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <p className="text-[11px] font-bold text-slate-600 dark:text-muted-foreground uppercase tracking-widest mb-2">
              Platform
            </p>
            <ul className="space-y-1">
              {[
                { label: "Explore Tenders", href: "/explore" },
                { label: "Pricing", href: "/pricing" },
                { label: "Sign Up Free", href: "/signup" },
              ].map((l) => (
                <li key={l.href}>
                  <Link
                    href={l.href}
                    className="text-[12px] font-medium text-slate-600 dark:text-muted-foreground hover:text-slate-800 dark:hover:text-foreground transition-colors focus-visible:outline-none focus-visible:underline"
                  >
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <p className="text-[11px] font-bold text-slate-600 dark:text-muted-foreground uppercase tracking-widest mb-2">
              Company
            </p>
            <ul className="space-y-1">
              {[
                { label: "About", href: "/about" },
                { label: "Privacy Policy", href: "/privacy" },
                { label: "Contact Us", href: "https://wa.me/919952749408", target: "_blank" },
              ].map((l) => (
                <li key={l.label}>
                  <Link
                    href={l.href}
                    target={l.target}
                    rel={l.target === "_blank" ? "noopener noreferrer" : undefined}
                    className="text-[12px] font-medium text-slate-600 dark:text-muted-foreground hover:text-slate-800 dark:hover:text-foreground transition-colors focus-visible:outline-none focus-visible:underline"
                  >
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="border-t border-slate-100 dark:border-border pt-4">
          <p className="text-[11px] font-medium text-slate-500 dark:text-muted-foreground text-center leading-relaxed">
            &copy; 2026 GeMTenders.org. Built with ❤️ for Small Businesses.
          </p>
        </div>
      </div>
    </footer>
  );
}
