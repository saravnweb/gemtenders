import TendersClient from '@/app/TendersClient';
import { Metadata } from 'next';
import { KEYWORD_CATEGORIES } from '@/lib/categories';
import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase-server';

export const revalidate = 60; // Cache for 60s

export async function generateStaticParams() {
  return KEYWORD_CATEGORIES.map((category) => ({
    slug: category.slug,
  }));
}

type Props = {
  params: Promise<{ slug: string }>;
};

export async function generateMetadata(props: Props): Promise<Metadata> {
  const params = await props.params;
  const category = KEYWORD_CATEGORIES.find(c => c.slug === params.slug);
  
  if (!category) {
    return { title: 'Category Not Found' };
  }

  const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  const d = new Date();
  const month = monthNames[d.getMonth()];
  const year = d.getFullYear();
  
  return {
    title: `${category.name} Tenders – GeM Bids ${month} ${year}`,
    description: `Track and monitor active ${category.name} Government e-Marketplace (GeM) tenders with AI-powered summaries and real-time alerts.`,
  };
}

const COLUMNS = 'id,title,bid_number,state,city,department,ministry_name,department_name,organisation_name,office_name,emd_amount,start_date,end_date,ai_summary,eligibility_msme,eligibility_mii,created_at,slug';

export default async function CategoryPage(props: Props) {
  const params = await props.params;
  const category = KEYWORD_CATEGORIES.find(c => c.slug === params.slug);
  
  if (!category) {
    notFound();
  }

  // Pre-fetch matching tenders for initial SSR state
  const supabase = await createClient();
  
  let q = supabase
    .from("tenders")
    .select(COLUMNS)
    .gte("end_date", new Date().toISOString())
    .order("start_date", { ascending: false })
    .order("id", { ascending: true })
    .limit(21);
    
  // Add category keyword filtering
  const orClause = category.keywords.map((k) => `title.ilike.%${k}%`).join(",");
  q = q.or(orClause);

  const { data: initialTenders } = await q;

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    "itemListElement": (initialTenders || []).map((tender: any, index: number) => ({
      "@type": "ListItem",
      "position": index + 1,
      "url": `https://gemtenders.org/bids/${tender.slug}`
    }))
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <div className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 pt-8 pb-4">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
           <h1 className="text-3xl font-black mb-2 flex items-center">
             <span className="mr-3" aria-hidden="true">{category.icon}</span> 
             {category.name} Tenders
           </h1>
           <p className="text-slate-500 max-w-2xl text-sm">
              Latest read-only list of active bids and tenders in the <strong>{category.name}</strong> category. Use advanced search filters and sign up to unlock deep AI summaries and custom WhatsApp alerts.
           </p>
        </div>
      </div>
      <TendersClient
        initialTenders={initialTenders || []}
        initialQ=""
        initialStates={[]}
        initialCategory={category.id}
      />
    </>
  );
}
