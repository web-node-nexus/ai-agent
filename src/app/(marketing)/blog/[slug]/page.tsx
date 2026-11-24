import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { BlogBody } from "@/components/marketing/blog-body";
import { Badge } from "@/components/ui/badge";
import { BLOG_POSTS, getPost } from "@/content/blog";

export function generateStaticParams() {
  return BLOG_POSTS.map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const post = getPost(slug);
  if (!post) return { title: "Post" };
  return { title: post.title, description: post.description };
}

export default async function BlogPostPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const post = getPost(slug);
  if (!post) notFound();

  return (
    <article className="mx-auto max-w-3xl px-4 py-12 sm:px-6 sm:py-16">
      <Link
        href="/blog"
        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Blog
      </Link>
      <p className="mt-8 text-xs text-muted-foreground">
        {post.date} · {post.readingMinutes} min read
      </p>
      <h1 className="mt-3 font-display text-4xl tracking-tight sm:text-5xl">
        {post.title}
      </h1>
      <p className="mt-4 text-lg text-muted-foreground">{post.description}</p>
      <div className="mt-4 flex flex-wrap gap-1.5">
        {post.tags.map((t) => (
          <Badge key={t} variant="muted">
            {t}
          </Badge>
        ))}
      </div>
      <div className="mt-10">
        <BlogBody content={post.content} />
      </div>
    </article>
  );
}
