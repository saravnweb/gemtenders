import Link from "next/link";

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
  { label: "Vehicles", href: "/?category=Vehicles" },
  { label: "IT Equipment", href: "/?category=IT+Equipment" },
  { label: "Office Supplies", href: "/?category=Office+Supplies" },
  { label: "Medical Equipment", href: "/?category=Medical+Equipment" },
  { label: "Construction", href: "/?category=Construction" },
  { label: "Security Services", href: "/?category=Security+Services" },
];

export default function Footer() {
  return (
    <footer className="border-t border-slate-100 dark:border-zinc-900 mt-16 w-full">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* SEO link grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-8">
          <div>
            <p className="text-[11px] font-bold text-slate-600 dark:text-zinc-400 uppercase tracking-widest mb-2">
              Browse by State
            </p>
            <ul className="space-y-1">
              {stateLinks.map((l) => (
                <li key={l.href}>
                  <Link
                    href={l.href}
                    className="text-[12px] font-medium text-slate-600 dark:text-zinc-400 hover:text-slate-800 dark:hover:text-zinc-200 transition-colors focus-visible:outline-none focus-visible:underline"
                  >
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <p className="text-[11px] font-bold text-slate-600 dark:text-zinc-400 uppercase tracking-widest mb-2">
              Browse by Category
            </p>
            <ul className="space-y-1">
              {categoryLinks.map((l) => (
                <li key={l.href}>
                  <Link
                    href={l.href}
                    className="text-[12px] font-medium text-slate-600 dark:text-zinc-400 hover:text-slate-800 dark:hover:text-zinc-200 transition-colors focus-visible:outline-none focus-visible:underline"
                  >
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <p className="text-[11px] font-bold text-slate-600 dark:text-zinc-400 uppercase tracking-widest mb-2">
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
                    className="text-[12px] font-medium text-slate-600 dark:text-zinc-400 hover:text-slate-800 dark:hover:text-zinc-200 transition-colors focus-visible:outline-none focus-visible:underline"
                  >
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <p className="text-[11px] font-bold text-slate-600 dark:text-zinc-400 uppercase tracking-widest mb-2">
              Company
            </p>
            <ul className="space-y-1">
              {[
                { label: "About", href: "/about" },
                { label: "Privacy Policy", href: "/privacy" },
              ].map((l) => (
                <li key={l.href}>
                  <Link
                    href={l.href}
                    className="text-[12px] font-medium text-slate-600 dark:text-zinc-400 hover:text-slate-800 dark:hover:text-zinc-200 transition-colors focus-visible:outline-none focus-visible:underline"
                  >
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="border-t border-slate-100 dark:border-zinc-900 pt-4">
          <p className="text-[11px] font-medium text-slate-500 dark:text-zinc-400 text-center leading-relaxed">
            &copy; {new Date().getFullYear()} GeMTenders.org &mdash; Data sourced from Government e-Marketplace (gem.gov.in). Not affiliated with the Government of India.
          </p>
        </div>
      </div>
    </footer>
  );
}
