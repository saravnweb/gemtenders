// No unused imports
import TendersClient from './TendersClient';
import { Metadata } from 'next';

export const revalidate = 60; // Cache for 60s — tenders change frequently but not every second

type Props = {};

export async function generateMetadata(props: Props): Promise<Metadata> {
  const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  const d = new Date();
  const month = monthNames[d.getMonth()];
  const year = d.getFullYear(); // e.g. March 2026

  let title = `All Active Tenders – GeM Bids ${month} ${year}`;
  
  return {
    title,
    description: `Track and monitor active Government e-Marketplace (GeM) tenders with AI-powered summaries and real-time alerts.`,
  };
}

const COLUMNS = 'id,title,bid_number,state,city,department,ministry_name,department_name,organisation_name,office_name,emd_amount,start_date,end_date,ai_summary,eligibility_msme,eligibility_mii,created_at,slug';

export default async function Page() {
  const res = await fetch(
    `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/tenders?select=${encodeURIComponent(COLUMNS)}&end_date=gte.${new Date().toISOString()}&order=start_date.desc&limit=21`,
    {
      headers: {
        apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string,
        Authorization: `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY}`
      },
      next: { revalidate: 60 }
    }
  );

  const initialTenders = await res.json();

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
      <TendersClient
        initialTenders={initialTenders || []}
        initialQ=""
        initialStates={[]}
      />
    </>
  );
}
