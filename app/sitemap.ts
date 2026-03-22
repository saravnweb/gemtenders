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
  // Supabase Rest API has a default limit of 1000 rows
  const limit = 1000;
  const numSitemaps = Math.max(1, Math.ceil(total / limit));
  
  return Array.from({ length: numSitemaps }, (_, i) => ({ id: i }));
}

export default async function sitemap(props: {
  id?: number | Promise<number> | string | Promise<string>;
} = {}): Promise<MetadataRoute.Sitemap> {
  // Next 15+ passes params as promises sometimes, and `id` could be a Promise or string
  const rawId = await (props.id ?? 0);
  const resolvedId = Number(rawId);
  const limit = 1000;
  const start = resolvedId * limit;
  const end = start + limit - 1;

  const { data: tenders, error } = await supabase
    .from("tenders")
    .select("slug, created_at")
    .not("slug", "is", null)
    .order("created_at", { ascending: false })
    .range(start, end);

  if (error) {
    console.error("Supabase error in sitemap:", error);
  }

  const tenderUrls: MetadataRoute.Sitemap = (tenders ?? []).map((t) => ({
    url: `${siteUrl}/bids/${t.slug}`,
    lastModified: t.created_at ? new Date(t.created_at) : new Date(),
    changeFrequency: "weekly" as const,
    priority: 0.7,
  }));

  if (resolvedId === 0) { // Check id as number
    console.log("Returning top level sitemap with categories...");
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

