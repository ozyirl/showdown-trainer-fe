"use client";

import { PanelRightOpenIcon } from "lucide-react";
import type { ReactNode } from "react";

import {
  ACCENT_TEXT,
  IndexTag,
  Panel,
  boxButtonClass,
} from "@/components/battle/panel";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

/** One side's latest decision, shown on a single line. */
export type CpuDecisionLine = {
  key: string;
  /** Who decided, e.g. "CPU" or "P1". */
  label: string;
  /** What they chose, e.g. "Psychic Fangs"; null before the first decision. */
  action: string | null;
  /** Trailing details, e.g. ["fly-cns", "94%"]. */
  meta: string[];
  /** Shown instead of the action while the model is still deciding. */
  thinking?: string | null;
  tone?: "rose" | "blue";
};

const TONE_DOT = {
  rose: "bg-rose-400",
  blue: "bg-blue-400",
} as const;

/**
 * The latest CPU (or, in AI vs AI, both AIs') decision in one line, with a
 * button that opens the full analysis in a side sheet.
 */
export function CpuDecisionBar({
  title,
  index,
  lines,
  notice,
  onOpen,
  className,
}: {
  title: string;
  index?: number;
  lines: CpuDecisionLine[];
  /** Extra status under the lines, e.g. the retry notice. */
  notice?: ReactNode;
  onOpen: () => void;
  className?: string;
}) {
  return (
    <Panel className={cn("shrink-0", className)}>
      <div className="flex h-8 items-center justify-between gap-2 border-b border-white/[0.07] pl-3 pr-1.5">
        <IndexTag index={index} label={title} />
        <button
          type="button"
          onClick={onOpen}
          className={cn(boxButtonClass, "px-2 py-0.5 text-[11px]")}
        >
          <PanelRightOpenIcon className="size-3" aria-hidden />
          View analysis
        </button>
      </div>
      <div className="min-w-0 space-y-1 px-3 py-2">
        {lines.map((line) => (
          <div
            key={line.key}
            className="flex min-w-0 items-center gap-1.5 font-mono text-[11.5px] leading-5"
          >
            <span
              className={cn(
                "h-1.5 w-1.5 shrink-0 rounded-full",
                TONE_DOT[line.tone ?? "rose"],
                line.thinking && "animate-pulse",
              )}
            />
            <span className="shrink-0 uppercase tracking-[0.08em] text-white/45">
              {line.label}
            </span>
            <span className="text-white/20">·</span>
            {line.thinking ? (
              <span className="truncate text-white/60">{line.thinking}</span>
            ) : line.action ? (
              <>
                <span className="min-w-0 truncate font-sans text-[12.5px] font-medium text-white">
                  {line.action}
                </span>
                {line.meta.map((part) => (
                  <span key={part} className="contents">
                    <span className="text-white/20">·</span>
                    <span
                      className={cn(
                        "shrink-0",
                        /%$/.test(part) ? ACCENT_TEXT : "text-white/45",
                      )}
                    >
                      {part}
                    </span>
                  </span>
                ))}
              </>
            ) : (
              <span className="truncate text-white/35">
                waiting for the first move
              </span>
            )}
          </div>
        ))}
        {notice}
      </div>
    </Panel>
  );
}

/**
 * The full CPU analysis (decision trace, brain panel, retry status) in a sheet
 * that slides in from the right. Its content mounts when it opens, so feeds
 * inside start pinned to their newest entry.
 */
export function CpuAnalysisSheet({
  open,
  onOpenChange,
  title,
  subtitle,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  subtitle: ReactNode;
  children: ReactNode;
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        // The page is dark without the `dark` class on <html>; scope it here
        // so the token-based styles inside (Trace, close button) are dark too.
        className="dark w-full gap-0 border-white/10 bg-[#09090b] p-0 text-white sm:max-w-[min(520px,92vw)] [&>button:last-child]:top-3 [&>button:last-child]:right-3"
      >
        <SheetHeader className="gap-0.5 border-b border-white/10 px-4 py-3 pr-12">
          <SheetTitle className="text-sm font-medium text-white">
            {title}
          </SheetTitle>
          <SheetDescription className="font-mono text-[10px] uppercase tracking-[0.14em] text-white/40">
            {subtitle}
          </SheetDescription>
        </SheetHeader>
        <div className="flex min-h-0 flex-1 flex-col gap-3 p-4">
          {children}
        </div>
      </SheetContent>
    </Sheet>
  );
}
