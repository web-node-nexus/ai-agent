import type { ReactNode } from "react";
import Link from "next/link";

/** Minimal markdown-ish renderer for blog TS modules (headings, bold, links, paragraphs). */
export function BlogBody({ content }: { content: string }) {
  const blocks = content.split(/\n\n+/);

  return (
    <div className="space-y-5 text-base leading-relaxed text-foreground/90">
      {blocks.map((block, i) => {
        const trimmed = block.trim();
        if (trimmed.startsWith("## ")) {
          return (
            <h2 key={i} className="pt-4 font-display text-2xl tracking-tight text-foreground">
              {trimmed.slice(3)}
            </h2>
          );
        }
        return (
          <p key={i} className="text-muted-foreground">
            {renderInline(trimmed)}
          </p>
        );
      })}
    </div>
  );
}

function renderInline(text: string) {
  const parts: ReactNode[] = [];
  const re = /(\*\*[^*]+\*\*|\[([^\]]+)\]\(([^)]+)\))/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let key = 0;
  while ((m = re.exec(text))) {
    if (m.index > last) parts.push(text.slice(last, m.index));
    if (m[0].startsWith("**")) {
      parts.push(
        <strong key={key++} className="font-semibold text-foreground">
          {m[0].slice(2, -2)}
        </strong>
      );
    } else {
      parts.push(
        <Link
          key={key++}
          href={m[3]}
          className="text-accent underline underline-offset-2 hover:opacity-90"
        >
          {m[2]}
        </Link>
      );
    }
    last = m.index + m[0].length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return parts;
}
