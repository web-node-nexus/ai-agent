import type { Metadata } from "next";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { BLOG_POSTS } from "@/content/blog";

export const metadata: Metadata = {
  title: "Blog",
  description:
    "Notes from TaraWorld — safety, character writing, and honest pricing.",
};

export default function BlogIndexPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-14 sm:px-6 sm:py-20">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent">
        Journal
      </p>
      <h1 className="mt-3 font-display text-4xl tracking-tight sm:text-5xl">Blog</h1>
      <p className="mt-4 text-muted-foreground">
        Product notes on safety, language, and pricing — written for humans, not
        press kits.
      </p>
      <ul className="mt-12 space-y-8">
        {BLOG_POSTS.map((post) => (
          <li key={post.slug} className="border-b border-white/10 pb-8">
            <p className="text-xs text-muted-foreground">
              {post.date} · {post.readingMinutes} min read
            </p>
            <Link
              href={`/blog/${post.slug}`}
              className="mt-2 block font-display text-2xl tracking-tight hover:text-accent"
            >
              {post.title}
            </Link>
            <p className="mt-2 text-sm text-muted-foreground">{post.description}</p>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {post.tags.map((t) => (
                <Badge key={t} variant="muted">
                  {t}
                </Badge>
              ))}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
