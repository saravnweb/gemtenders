import TendersClient from './TendersClient';
import { Metadata } from 'next';
import { createClient } from '@/lib/supabase/server';

export const revalidate = 3600;

export const metadata: Metadata = {
  title: 'GeM Tender Tracker — Live Government Bids | GeMTenders.org',
  description: 'Track 10,000+ live GeM portal tenders with AI-powered filtering. Find government bids by category, ministry, and state. Updated daily.',
};

export default async function Page() {
  const supabase = await createClient();
  const { data: tenders } = await supabase
    .from('tenders')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(20);

  const initialTenders = tenders ?? [];

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    "itemListElement": initialTenders.map((tender: any, index: number) => ({
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
      <TendersClient
        initialTenders={initialTenders}
        initialQ=""
        initialStates={[]}
      />
    </>
  );
}
