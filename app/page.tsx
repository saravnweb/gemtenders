export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center p-8 md:p-24 bg-fresh-sky-50 font-sans">
      {/* Hero Section */}
      <div className="relative flex flex-col items-center justify-center py-20 z-0">
        <div className="absolute -z-10 top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[140%] h-[140%] bg-[radial-gradient(circle_at_center,var(--color-fresh-sky-200)_0%,transparent_70%)] dark:bg-[radial-gradient(circle_at_center,var(--color-fresh-sky-900)_0%,transparent_70%)] opacity-30 blur-3xl"></div>
        
        <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight text-center mb-6 text-fresh-sky-900 dark:text-white leading-tight">
          Automated <span className="text-transparent bg-clip-text bg-linear-to-r from-atomic-tangerine-500 to-atomic-tangerine-700">GeM Tender</span> Tracking
        </h1>
        
        <p className="text-lg md:text-xl text-fresh-sky-700 dark:text-fresh-sky-300 text-center max-w-2xl mb-10 leading-relaxed">
          The next generation of tender discovery. Instant notifications, AI-powered extraction, and seamless management for government bids.
        </p>

        <div className="flex gap-4">
          <button className="px-8 py-3 bg-atomic-tangerine-500 hover:bg-atomic-tangerine-600 text-white rounded-xl font-semibold shadow-lg shadow-atomic-tangerine-200 dark:shadow-none transition-all hover:-translate-y-1">
            Get Started
          </button>
          <button className="px-8 py-3 bg-white dark:bg-fresh-sky-900 border border-fresh-sky-200 dark:border-fresh-sky-800 text-fresh-sky-700 dark:text-fresh-sky-200 rounded-xl font-semibold transition-all hover:bg-fresh-sky-100 dark:hover:bg-fresh-sky-800">
            Learn More
          </button>
        </div>
      </div>

      {/* Feature Cards */}
      <div className="mb-32 grid gap-6 text-center lg:max-w-6xl lg:w-full lg:mb-0 lg:grid-cols-3 lg:text-left">
        <FeatureCard 
          title="Infrastructure"
          description="Robust Supabase backend with auto-generated TypeScript types for full type safety."
          status="Initialized"
          color="fresh-sky"
        />

        <FeatureCard 
          title="Tender Database"
          description="Optimized schema for fast querying and comprehensive metadata storage."
          status="Ready"
          color="muted-olive"
        />

        <FeatureCard 
          title="Next Steps"
          description="Phase 2: Intelligent scraper development & Gemini AI analysis integration."
          status="Active"
          color="atomic-tangerine"
        />
      </div>
    </main>
  );
}

function FeatureCard({ title, description, status, color }: { title: string, description: string, status: string, color: 'atomic-tangerine' | 'fresh-sky' | 'muted-olive' }) {
  const colorClasses = {
    'atomic-tangerine': 'hover:border-atomic-tangerine-300 hover:bg-atomic-tangerine-50 dark:hover:bg-atomic-tangerine-950/20 text-atomic-tangerine-600 dark:text-atomic-tangerine-400',
    'fresh-sky': 'hover:border-fresh-sky-300 hover:bg-fresh-sky-100 dark:hover:bg-fresh-sky-900/20 text-fresh-sky-600 dark:text-fresh-sky-400',
    'muted-olive': 'hover:border-muted-olive-300 hover:bg-muted-olive-50 dark:hover:bg-muted-olive-950/20 text-muted-olive-600 dark:text-muted-olive-400',
  };

  const statusBg = {
    'atomic-tangerine': 'bg-atomic-tangerine-100 text-atomic-tangerine-700 dark:bg-atomic-tangerine-900 dark:text-atomic-tangerine-200',
    'fresh-sky': 'bg-fresh-sky-100 text-fresh-sky-700 dark:bg-fresh-sky-900 dark:text-fresh-sky-200',
    'muted-olive': 'bg-muted-olive-100 text-muted-olive-700 dark:bg-muted-olive-900 dark:text-muted-olive-200',
  };

  return (
    <div className={`group rounded-2xl border border-fresh-sky-200/50 dark:border-fresh-sky-800/50 bg-white dark:bg-fresh-sky-900/10 px-6 py-8 transition-all duration-300 hover:-translate-y-1 hover:shadow-xl ${colorClasses[color]}`}>
      <div className="flex justify-between items-start mb-4">
        <h2 className={`text-2xl font-bold text-fresh-sky-900 dark:text-white`}>
          {title}
        </h2>
        <span className={`px-2 py-1 rounded-md text-xs font-bold uppercase tracking-wider ${statusBg[color]}`}>
          {status}
        </span>
      </div>
      <p className={`m-0 max-w-[30ch] text-base leading-relaxed text-fresh-sky-700 dark:text-fresh-sky-300 opacity-80 group-hover:opacity-100 transition-opacity`}>
        {description}
      </p>
      <div className="mt-6 flex items-center gap-2 font-semibold">
        <span>Explore details</span>
        <span className="inline-block transition-transform group-hover:translate-x-1 motion-reduce:transform-none">
          -&gt;
        </span>
      </div>
    </div>
  );
}
