import type { MetadataRoute } from "next";
import { supabase } from "@/lib/supabase";
import { KEYWORD_CATEGORIES } from "@/lib/categories";

const siteUrl = "https://gemtenders.org";

export async function generateSitemaps() {
  const { count } = await supabase
    .from("tenders")
    .select("id", { count: "exact", head: true })
    .not("slug", "is", null);

  const total = count || 0;
  // Route handlers and sitemaps can safely return up to 50000 entries
  const limit = 50000;
  const numSitemaps = Math.max(1, Math.ceil(total / limit));
  
  return Array.from({ length: numSitemaps }, (_, i) => ({ id: i }));
}

export default async function sitemap({
  id = 0,
}: {
  id?: number;
}): Promise<MetadataRoute.Sitemap> {
  const limit = 50000;
  const start = id * limit;
  const end = start + limit - 1;

  const { data: tenders } = await supabase
    .from("tenders")
    .select("slug, created_at")
    .not("slug", "is", null)
    .order("created_at", { ascending: false })
    .range(start, end);

  const tenderUrls: MetadataRoute.Sitemap = (tenders ?? []).map((t) => ({
    url: `${siteUrl}/bids/${t.slug}`,
    lastModified: t.created_at ? new Date(t.created_at) : new Date(),
    changeFrequency: "weekly" as const,
    priority: 0.7,
  }));

  if (id === 0) {
    const categoryUrls: MetadataRoute.Sitemap = KEYWORD_CATEGORIES.map((cat) => ({
      url: `${siteUrl}/categories/${cat.slug}`,
      lastModified: new Date(),
      changeFrequency: "daily" as const,
      priority: 0.9,
    }));

    return [
      {
        url: siteUrl,
        lastModified: new Date(),
        changeFrequency: "daily",
        priority: 1.0,
      },
      {
        url: `${siteUrl}/pricing`,
        lastModified: new Date(),
        changeFrequency: "monthly",
        priority: 0.8,
      },
      {
        url: `${siteUrl}/categories`,
        lastModified: new Date(),
        changeFrequency: "weekly",
        priority: 0.9,
      },
      ...categoryUrls,
      ...tenderUrls,
    ];
  }

  return tenderUrls;
}

