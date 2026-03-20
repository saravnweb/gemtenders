import { Metadata } from 'next';
import { KEYWORD_CATEGORIES } from '@/lib/categories';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Tender Categories | GeM Bids Tracking',
  description: 'Browse active government tenders and GeM bids by categories like IT, Civil, Medical, and more.',
};

export default function CategoriesPage() {
  return (
    <div className="min-h-screen bg-fresh-sky-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-3xl md:text-5xl font-black mb-4">Browse Tenders by Category</h1>
        <p className="text-lg text-slate-600 dark:text-slate-400 mb-10 max-w-3xl">
          Explore read-only listings of the most popular tender categories. Find government contracts matching your business domain to start bidding and win projects.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {KEYWORD_CATEGORIES.map((cat) => (
            <Link 
              key={cat.id} 
              href={`/categories/${cat.slug}`}
              className="bg-white dark:bg-slate-900 p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 hover:shadow-md hover:border-blue-500 transition-all group flex flex-col h-full"
            >
              <div className="text-4xl mb-4 group-hover:scale-110 transition-transform origin-left">
                {cat.icon}
              </div>
              <h2 className="text-xl font-bold mb-2 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                {cat.name}
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-auto line-clamp-2">
                {cat.keywords.join(', ')}
              </p>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
