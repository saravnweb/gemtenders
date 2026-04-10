import { MetadataRoute } from 'next'
import { INDIAN_STATES } from '@/lib/locations-client'
import { CATEGORIES } from '@/lib/categories'

const baseUrl = 'https://gemtenders.org'

// Number of tenders per sitemap page
const PAGE_SIZE = 1000

export const revalidate = 86400 // 24 hours

// Next.js calls this to know how many sitemap files to generate
export async function generateSitemaps() {
  // Get total count of tenders
  try {
    const res = await fetch(
      `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/tenders?select=id&limit=1`,
      {
        headers: {
          apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string,
          Authorization: `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY}`,
          Prefer: 'count=exact',
        },
      }
    )

    const totalCount = parseInt(res.headers.get('content-range')?.split('/')[1] ?? '50000')
    const totalPages = Math.ceil(totalCount / PAGE_SIZE)

    // Page 0 = static + state + category pages
    // Pages 1..N = tender batches
    return Array.from({ length: totalPages + 1 }, (_, i) => ({ id: i }))
  } catch (e) {
    console.error('Sitemap generation error:', e)
    return [{ id: 0 }]
  }
}

export default async function sitemap({
  id,
}: {
  id: number
}): Promise<MetadataRoute.Sitemap> {
  // Page 0: return static site pages and search hubs
  if (id === 0) {
    const staticPages: MetadataRoute.Sitemap = [
      { url: baseUrl, lastModified: new Date(), changeFrequency: 'hourly', priority: 1 },
      { url: `${baseUrl}/explore`, lastModified: new Date(), changeFrequency: 'hourly', priority: 0.9 },
      { url: `${baseUrl}/bids`, lastModified: new Date(), changeFrequency: 'hourly', priority: 0.9 },
      { url: `${baseUrl}/about`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.8 },
      { url: `${baseUrl}/pricing`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.8 },
      { url: `${baseUrl}/privacy`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.4 },
      { url: `${baseUrl}/terms`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.4 },
    ]

    // Add State-wise hub pages
    const statePages: MetadataRoute.Sitemap = Array.from(INDIAN_STATES).map(state => ({
      url: `${baseUrl}/explore?state=${encodeURIComponent(state)}`,
      lastModified: new Date(),
      changeFrequency: 'hourly',
      priority: 0.8
    }))

    // Add Category-wise hub pages
    const categoryPages: MetadataRoute.Sitemap = CATEGORIES.map(cat => ({
      url: `${baseUrl}/explore?category=${encodeURIComponent(cat.id)}`,
      lastModified: new Date(),
      changeFrequency: 'hourly',
      priority: 0.8
    }))

    return [...staticPages, ...statePages, ...categoryPages]
  }

  // Pages 1+: paginated tender URLs
  const offset = (id - 1) * PAGE_SIZE

  try {
    const res = await fetch(
      `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/tenders?select=slug,created_at&order=created_at.desc&limit=${PAGE_SIZE}&offset=${offset}`,
      {
        headers: {
          apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string,
          Authorization: `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY}`,
        },
        next: { revalidate: 86400 },
      }
    )

    const tenders: { slug: string; created_at: string }[] =
      res.ok ? await res.json() : []

    return tenders.map((t) => ({
      url: `${baseUrl}/bids/${t.slug}`,
      lastModified: new Date(t.created_at),
      changeFrequency: 'weekly',
      priority: 0.7,
    }))
  } catch (e) {
    console.error(`Sitemap batch ${id} error:`, e)
    return []
  }
}
