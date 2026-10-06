import { AccordionItem, AccordionTrigger, AccordionContent } from "@/components/ui/accordion";
import type { ReactNode } from "react";

export function ClaimSection({ value, title, summary, children }: { value: string; title: string; summary?: string; children: ReactNode }) {
  return <AccordionItem value={value} className="border-border min-w-0">
    <AccordionTrigger className="gap-3 text-left hover:no-underline">
      <span className="min-w-0"><span className="block font-semibold">{title}</span>{summary && <span className="block text-xs font-normal text-muted-foreground mt-1">{summary}</span>}</span>
    </AccordionTrigger>
    <AccordionContent>{children}</AccordionContent>
  </AccordionItem>;
}