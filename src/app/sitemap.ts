import type { MetadataRoute } from "next";
import { BLOG_POSTS } from "@/content/blog";
import { CHARACTERS } from "@/content/characters";
import { absoluteUrl } from "@/lib/utils";

export default function sitemap(): MetadataRoute.Sitemap {
  const staticPaths = [
    "/",
    "/characters",
    "/how-it-works",
    "/pricing",
    "/safety",
    "/faq",
    "/about",
    "/contact",
    "/terms",
    "/privacy",
    "/refund-policy",
    "/blog",
  ];

  const lastModified = "2026-11-23";

  return [
    ...staticPaths.map((path) => ({
      url: absoluteUrl(path),
      lastModified,
      changeFrequency: path === "/" ? ("weekly" as const) : ("monthly" as const),
      priority: path === "/" ? 1 : 0.7,
    })),
    ...CHARACTERS.map((c) => ({
      url: absoluteUrl(`/characters/${c.slug}`),
      lastModified,
      changeFrequency: "monthly" as const,
      priority: 0.6,
    })),
    ...BLOG_POSTS.map((p) => ({
      url: absoluteUrl(`/blog/${p.slug}`),
      lastModified: p.date,
      changeFrequency: "monthly" as const,
      priority: 0.5,
    })),
  ];
}
