"use client";

import { useState, type ReactNode } from "react";
import Image from "next/image";
import { Check } from "lucide-react";

import { ACCENT_BG, formatIndex } from "@/components/battle/panel";
import { cn } from "@/lib/utils";

/**
 * Small boxy form controls for the battle setup screen, in the same visual language as
 * `components/battle/panel.tsx`: 1px borders, 3-5px radii, mono labels and the one accent.
 */

const selectedTile = "border-[#3b5bff]/70 bg-[#3b5bff]/[0.14] text-white";
const idleTile =
  "border-white/10 bg-white/[0.02] text-white/60 hover:border-white/25 hover:bg-white/[0.05] hover:text-white/85";
const focusRing =
  "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-white/40";

/** Mono field label, e.g. `TEAM SOURCE`, with optional content on the right. */
export function FieldLabel({
  children,
  aside,
  className,
}: {
  children: ReactNode;
  aside?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "mb-1.5 flex items-baseline justify-between gap-2 font-mono text-[10px] uppercase tracking-[0.14em] text-white/40",
        className,
      )}
    >
      <span>{children}</span>
      {aside != null && (
        <span className="min-w-0 truncate normal-case tracking-normal text-white/35">
          {aside}
        </span>
      )}
    </div>
  );
}

export type ChoiceOption<T extends string> = {
  value: T;
  label: ReactNode;
  icon?: ReactNode;
  title?: string;
};

/** Equal-width segmented control (a radio group). */
export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  disabled,
  ariaLabel,
  className,
}: {
  options: ChoiceOption<T>[];
  value: T;
  onChange: (value: T) => void;
  disabled?: boolean;
  ariaLabel: string;
  className?: string;
}) {
  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      className={cn(
        "grid auto-cols-fr grid-flow-col gap-0.5 rounded-[4px] border border-white/10 bg-black/40 p-0.5",
        disabled && "opacity-40",
        className,
      )}
    >
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={selected}
            title={option.title}
            disabled={disabled}
            onClick={() => onChange(option.value)}
            className={cn(
              "inline-flex h-7 min-w-0 items-center justify-center gap-1.5 rounded-[3px] px-2 text-[12px] transition-colors disabled:cursor-not-allowed",
              focusRing,
              selected
                ? "bg-white/[0.09] text-white shadow-[inset_0_0_0_1px_rgba(255,255,255,0.12)]"
                : "text-white/50 hover:text-white/85",
            )}
          >
            {option.icon}
            <span className="truncate">{option.label}</span>
          </button>
        );
      })}
    </div>
  );
}

/** A grid of small bordered tiles, one of which is selected (a radio group). */
export function TileGroup<T extends string>({
  options,
  value,
  onChange,
  ariaLabel,
  className,
  tileClassName,
}: {
  options: ChoiceOption<T>[];
  value: T;
  onChange: (value: T) => void;
  ariaLabel: string;
  className?: string;
  tileClassName?: string;
}) {
  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      className={cn("grid gap-1", className)}
    >
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={selected}
            title={option.title}
            onClick={() => onChange(option.value)}
            className={cn(
              "h-7 min-w-0 truncate rounded-[4px] border px-2 text-[11.5px] transition-colors",
              focusRing,
              selected ? selectedTile : idleTile,
              tileClassName,
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

/** Square check indicator used by radio rows and cards. */
export function CheckSquare({ checked }: { checked: boolean }) {
  return (
    <span
      aria-hidden
      className={cn(
        "grid h-3.5 w-3.5 shrink-0 place-items-center rounded-[3px] border transition-colors",
        checked ? cn(ACCENT_BG, "border-transparent") : "border-white/25",
      )}
    >
      {checked && <Check className="h-2.5 w-2.5 text-white" strokeWidth={3} />}
    </span>
  );
}

/** A full-width radio row with a label and a one-line description. */
export function RadioRow({
  label,
  description,
  selected,
  disabled,
  onSelect,
  aside,
}: {
  label: ReactNode;
  description?: ReactNode;
  selected: boolean;
  disabled?: boolean;
  onSelect: () => void;
  aside?: ReactNode;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      disabled={disabled}
      onClick={onSelect}
      className={cn(
        "flex w-full min-w-0 items-start gap-2.5 rounded-[4px] border px-2.5 py-2 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-40",
        focusRing,
        selected ? selectedTile : idleTile,
      )}
    >
      <span className="pt-px">
        <CheckSquare checked={selected} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[12.5px] leading-tight text-white/90">
          {label}
        </span>
        {description && (
          <span className="mt-0.5 block text-[11px] leading-snug text-white/45">
            {description}
          </span>
        )}
      </span>
      {aside}
    </button>
  );
}

/** A selectable card with a mono index (`001`), a title and a description. */
export function OptionCard({
  index,
  icon,
  label,
  description,
  tag,
  selected,
  onSelect,
  art,
  className,
}: {
  index: number;
  icon?: ReactNode;
  label: ReactNode;
  description: ReactNode;
  tag?: ReactNode;
  selected: boolean;
  onSelect: () => void;
  /** Illustration shown on the left, e.g. the fly brain motif. */
  art?: ReactNode;
  className?: string;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onSelect}
      className={cn(
        "group relative flex min-w-0 items-stretch gap-3 rounded-[5px] border p-2.5 text-left transition-colors",
        focusRing,
        selected ? selectedTile : idleTile,
        className,
      )}
    >
      {art}
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="flex items-start justify-between gap-2">
          <span className="flex min-w-0 items-center gap-1.5 text-[12.5px] font-medium leading-tight text-white/90">
            {icon}
            <span className="truncate">{label}</span>
          </span>
          <span className="flex shrink-0 items-center gap-1.5">
            <span className="font-mono text-[10px] tracking-[0.08em] text-white/30">
              {String(index).padStart(3, "0")}
            </span>
            <CheckSquare checked={selected} />
          </span>
        </span>
        <span className="mt-1 text-[11px] leading-snug text-white/45">
          {description}
        </span>
        {tag && (
          <span className="mt-auto pt-1.5 font-mono text-[9.5px] uppercase tracking-[0.14em] text-white/35">
            {tag}
          </span>
        )}
      </span>
    </button>
  );
}

/** One key/value line of the setup recap. */
export function RecapRow({
  index,
  label,
  value,
  detail,
}: {
  index: number;
  label: string;
  value: ReactNode;
  detail?: ReactNode;
}) {
  return (
    <div className="flex min-w-0 items-baseline gap-2 border-b border-white/[0.06] py-1.5 last:border-b-0">
      <span className="w-[86px] shrink-0 font-mono text-[10px] uppercase tracking-[0.14em] text-white/35">
        <span className="text-white/50">{formatIndex(index)}</span>
        <span className="px-1 text-white/20">·</span>
        {label}
      </span>
      <span className="min-w-0 flex-1 truncate text-right text-[12px] text-white/85">
        {value}
        {detail && (
          <span className="ml-1.5 font-mono text-[10.5px] text-white/40">
            {detail}
          </span>
        )}
      </span>
    </div>
  );
}

function normalizeSpriteName(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[\s.':-]/g, "")
    .replace(/♀/g, "f")
    .replace(/♂/g, "m");
}

/** A small static Showdown sprite; renders an empty square if it fails to load. */
export function MiniSprite({
  name,
  size = 32,
  className,
}: {
  name: string;
  size?: number;
  className?: string;
}) {
  const src = `https://play.pokemonshowdown.com/sprites/gen5/${normalizeSpriteName(name)}.png`;
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  if (!name.trim() || failedSrc === src) {
    return (
      <span
        aria-hidden
        className={cn("inline-block shrink-0", className)}
        style={{ width: size, height: size }}
      />
    );
  }
  return (
    <Image
      src={src}
      alt={name}
      title={name}
      width={size}
      height={size}
      unoptimized
      className={cn("shrink-0 [image-rendering:pixelated]", className)}
      onError={() => setFailedSrc(src)}
    />
  );
}

/** An empty team slot, drawn as a dashed square with a mono glyph. */
export function SlotPlaceholder({
  children = "?",
  className,
}: {
  children?: ReactNode;
  className?: string;
}) {
  return (
    <span
      aria-hidden
      className={cn(
        "grid aspect-square min-w-0 place-items-center rounded-[4px] border border-dashed border-white/15 bg-white/[0.015] font-mono text-[11px] text-white/25",
        className,
      )}
    >
      {children}
    </span>
  );
}
