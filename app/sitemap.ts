import { MetadataRoute } from 'next'

const baseUrl = 'https://www.gemtenders.org'

export const revalidate = 3600

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date().toISOString()

  // Fetch all active tenders for the sitemap
  const res = await fetch(
    `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/tenders?select=slug,created_at,end_date&end_date=gte.${now}&order=created_at.desc&limit=5000`,
    {
      headers: {
        apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string,
        Authorization: `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY}`,
      },
      next: { revalidate: 3600 },
    }
  )

  const tenders: { slug: string; created_at: string; end_date: string }[] =
    res.ok ? await res.json() : []

  const tenderUrls: MetadataRoute.Sitemap = tenders.map((t) => ({
    url: `${baseUrl}/bids/${t.slug}`,
    lastModified: new Date(t.created_at),
    changeFrequency: 'daily',
    priority: 0.7,
  }))

  return [
    {
      url: baseUrl,
      lastModified: new Date(),
      changeFrequency: 'hourly',
      priority: 1,
    },
    {
      url: `${baseUrl}/about`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.8,
    },
    {
      url: `${baseUrl}/pricing`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.8,
    },
    {
      url: `${baseUrl}/bids`,
      lastModified: new Date(),
      changeFrequency: 'hourly',
      priority: 0.9,
    },
    {
      url: `${baseUrl}/privacy-policy`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.4,
    },
    ...tenderUrls,
  ]
}
