"use client";

import type { InputHTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";

interface StyledInputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  icon?: ReactNode;
}

export function StyledInput({
  label,
  icon,
  className,
  ...props
}: StyledInputProps) {
  return (
    <label className="grid gap-1.5">
      {label ? (
        <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-white/55">
          {label}
        </span>
      ) : null}
      <div className="relative">
        {icon ? (
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-white/35">
            {icon}
          </span>
        ) : null}
        <input
          {...props}
          className={cn(
            "h-12 w-full rounded-xl border border-white/12 bg-white/[0.03] px-3 text-[12px] text-white outline-none transition-colors placeholder:text-white/30 focus:border-[#0015ff]/70",
            icon && "pl-10",
            className,
          )}
        />
      </div>
    </label>
  );
}

interface StyledFieldsetProps {
  legend: string;
  className?: string;
  children: ReactNode;
}

export function StyledFieldset({
  legend,
  className,
  children,
}: StyledFieldsetProps) {
  return (
    <fieldset
      className={cn(
        "rounded-2xl border border-white/10 bg-white/[0.02] p-4",
        className,
      )}
    >
      <legend className="px-2 text-[11px] font-bold uppercase tracking-[0.16em] text-white/45">
        {legend}
      </legend>
      {children}
    </fieldset>
  );
}
