import type { ComponentProps, ReactNode } from "react";

import { cn } from "@/lib/utils";

/**
 * Boxy building blocks for the battle screen: crisp rectangular panels with
 * 1px borders, a header with a title on the left and a mono index tag
 * ("01 · COACH") on the right, and corner-bracket frames for illustrations.
 */

/** The single accent colour of the battle screen. */
export const ACCENT_BG = "bg-[#3b5bff]";
export const ACCENT_TEXT = "text-[#9aabff]";

export function formatIndex(index: number) {
  return String(index).padStart(2, "0");
}

export function Panel({
  className,
  ...props
}: ComponentProps<"section">) {
  return (
    <section
      className={cn(
        "flex min-w-0 flex-col rounded-[5px] border border-white/10 bg-[#0a0a0b] text-white",
        className,
      )}
      {...props}
    />
  );
}

/** Mono index tag, e.g. `01 · COACH`. */
export function IndexTag({
  index,
  label,
  className,
}: {
  index?: number;
  label: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "shrink-0 font-mono text-[10px] uppercase tracking-[0.14em] text-white/35",
        className,
      )}
    >
      {index != null && (
        <>
          <span className="text-white/55">{formatIndex(index)}</span>
          <span className="px-1 text-white/20">·</span>
        </>
      )}
      {label}
    </span>
  );
}

export function PanelHeader({
  title,
  index,
  label,
  aside,
  className,
}: {
  title: ReactNode;
  index?: number;
  label?: ReactNode;
  /** Extra controls or status shown before the index tag. */
  aside?: ReactNode;
  className?: string;
}) {
  return (
    <header
      className={cn(
        "flex h-9 shrink-0 items-center justify-between gap-3 border-b border-white/[0.07] px-3",
        className,
      )}
    >
      <h3 className="min-w-0 truncate text-[12.5px] font-medium tracking-tight text-white/85">
        {title}
      </h3>
      <div className="flex min-w-0 items-center gap-2">
        {aside}
        {label != null && <IndexTag index={index} label={label} />}
      </div>
    </header>
  );
}

/** Small square badge in the accent colour, e.g. the turn number. */
export function SquareBadge({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-grid h-6 min-w-6 shrink-0 place-items-center rounded-[3px] px-1.5 font-mono text-[11px] font-medium text-white",
        ACCENT_BG,
        className,
      )}
    >
      {children}
    </span>
  );
}

/** Thin corner brackets around an illustration, drawn over its edges. */
export function CornerFrame({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  const corner = "pointer-events-none absolute h-2.5 w-2.5 border-white/30";
  return (
    <div className={cn("relative", className)}>
      {children}
      <span aria-hidden className={cn(corner, "left-0 top-0 border-l border-t")} />
      <span aria-hidden className={cn(corner, "right-0 top-0 border-r border-t")} />
      <span aria-hidden className={cn(corner, "bottom-0 left-0 border-b border-l")} />
      <span aria-hidden className={cn(corner, "bottom-0 right-0 border-b border-r")} />
    </div>
  );
}

/** Small bordered button used across the battle screen. */
export const boxButtonClass =
  "inline-flex items-center gap-1.5 rounded-[4px] border border-white/10 bg-white/[0.03] px-2.5 py-1 text-[11.5px] text-white/75 transition-colors hover:border-white/25 hover:bg-white/[0.06] hover:text-white focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-white/40 disabled:cursor-not-allowed disabled:opacity-40";
