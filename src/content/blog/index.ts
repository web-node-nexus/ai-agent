import hinglish from "./hinglish-companions-that-dont-sound-like-robots";
import pricing from "./pricing-that-doesnt-guilt-trip-you";
import type { BlogPost } from "./types";
import whyLabel from "./why-we-label-every-companion-as-ai";

export type { BlogPost } from "./types";

export const BLOG_POSTS: BlogPost[] = [pricing, hinglish, whyLabel].sort((a, b) =>
  a.date < b.date ? 1 : -1
);

export function getPost(slug: string) {
  return BLOG_POSTS.find((p) => p.slug === slug);
}
