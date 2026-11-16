"use client";

import type { ComponentProps, ReactNode } from "react";

import { cn } from "@/lib/utils";

/** Boxy form pieces shared by the teambuilder panels. */

export const monoLabelClass =
  "font-mono text-[10px] uppercase tracking-[0.14em] text-white/40";

export const inputBoxClass =
  "h-8 w-full min-w-0 rounded-[4px] border border-white/10 bg-white/[0.02] px-2.5 text-[12.5px] text-white outline-none transition-colors placeholder:text-white/25 hover:border-white/20 focus:border-[#3b5bff]/70 focus:bg-white/[0.03]";

/** Labelled single-line input. `active` keeps the accent border while its options are shown. */
export function Field({
  label,
  icon,
  active,
  className,
  inputClassName,
  ...props
}: ComponentProps<"input"> & {
  label: ReactNode;
  icon?: ReactNode;
  active?: boolean;
  inputClassName?: string;
}) {
  return (
    <label className={cn("grid min-w-0 gap-1", className)}>
      <span className={monoLabelClass}>{label}</span>
      <span className="relative block min-w-0">
        {icon && (
          <span className="pointer-events-none absolute left-1.5 top-1/2 grid size-6 -translate-y-1/2 place-items-center text-white/35">
            {icon}
          </span>
        )}
        <input
          {...props}
          className={cn(
            inputBoxClass,
            icon && "pl-8",
            active && "border-[#3b5bff]/60 bg-[#3b5bff]/[0.06]",
            inputClassName,
          )}
        />
      </span>
    </label>
  );
}

/** Small mono section label with an optional count, e.g. `MOVES · 4`. */
export function SectionLabel({
  children,
  count,
  aside,
  className,
}: {
  children: ReactNode;
  count?: ReactNode;
  aside?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex items-center justify-between gap-2", className)}>
      <span className={monoLabelClass}>
        {children}
        {count != null && (
          <>
            <span className="px-1 text-white/20">·</span>
            <span className="text-white/55">{count}</span>
          </>
        )}
      </span>
      {aside}
    </div>
  );
}
