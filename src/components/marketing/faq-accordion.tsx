"use client";

import * as Accordion from "@radix-ui/react-accordion";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

export type FaqItem = { question: string; answer: string };

export function FaqAccordion({
  items,
  className,
}: {
  items: FaqItem[];
  className?: string;
}) {
  return (
    <Accordion.Root
      type="single"
      collapsible
      className={cn("divide-y divide-white/10 rounded-2xl border border-white/10 bg-white/[0.03]", className)}
    >
      {items.map((item, i) => (
        <Accordion.Item key={item.question} value={`item-${i}`} className="px-5">
          <Accordion.Header>
            <Accordion.Trigger className="group flex w-full items-center justify-between gap-4 py-5 text-left text-sm font-medium text-foreground transition hover:text-accent sm:text-base">
              {item.question}
              <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground transition group-data-[state=open]:rotate-180" />
            </Accordion.Trigger>
          </Accordion.Header>
          <Accordion.Content className="overflow-hidden data-[state=closed]:animate-out data-[state=open]:animate-in">
            <p className="pb-5 text-sm leading-relaxed text-muted-foreground">
              {item.answer}
            </p>
          </Accordion.Content>
        </Accordion.Item>
      ))}
    </Accordion.Root>
  );
}
