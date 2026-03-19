import type { MetadataRoute } from "next";
import { supabase } from "@/lib/supabase";

const siteUrl = "https://gemtenders.org";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const { data: tenders } = await supabase
    .from("tenders")
    .select("slug, created_at")
    .not("slug", "is", null)
    .order("created_at", { ascending: false })
    .limit(5000);

  const tenderUrls: MetadataRoute.Sitemap = (tenders ?? []).map((t) => ({
    url: `${siteUrl}/tenders/${t.slug}`,
    lastModified: t.created_at ? new Date(t.created_at) : new Date(),
    changeFrequency: "weekly" as const,
    priority: 0.7,
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
    ...tenderUrls,
  ];
}
