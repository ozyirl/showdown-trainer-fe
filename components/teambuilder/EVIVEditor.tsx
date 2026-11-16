"use client";

import { ACCENT_BG } from "@/components/battle/panel";
import { SectionLabel } from "@/components/teambuilder/fields";
import { calculateStat, getNatureModifier, type BaseStats } from "@/lib/teambuilder/catalog";
import { clampStat, remainingEvs, STAT_KEYS, type PokemonSlot, type StatKey } from "@/lib/teambuilder/types";
import { cn } from "@/lib/utils";

interface EVIVEditorProps {
  slot: PokemonSlot;
  onEVChange: (key: StatKey, value: number) => void;
  onIVChange: (key: StatKey, value: number) => void;
  baseStats?: BaseStats | null;
  onFieldFocus?: () => void;
}

export const STAT_LABELS: Record<StatKey, string> = {
  hp: "HP",
  atk: "Atk",
  def: "Def",
  spa: "SpA",
  spd: "SpD",
  spe: "Spe",
};

/** The stat a nature raises and lowers, or null for a neutral nature. */
export function natureEffect(nature: string): { up: StatKey; down: StatKey } | null {
  const keys = STAT_KEYS.filter((key) => key !== "hp");
  const up = keys.find((key) => getNatureModifier(nature, key) > 1);
  const down = keys.find((key) => getNatureModifier(nature, key) < 1);
  return up && down ? { up, down } : null;
}

const numberInputClass =
  "h-7 w-full min-w-0 rounded-[3px] border border-white/10 bg-white/[0.02] px-1.5 text-right font-mono text-[11.5px] tabular-nums text-white outline-none hover:border-white/20 focus:border-[#3b5bff]/70 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none";

const sliderClass =
  "relative z-10 h-6 w-full cursor-pointer appearance-none bg-transparent focus-visible:outline-none [&::-webkit-slider-runnable-track]:h-1.5 [&::-webkit-slider-runnable-track]:bg-transparent [&::-webkit-slider-thumb]:-mt-1 [&::-webkit-slider-thumb]:h-3.5 [&::-webkit-slider-thumb]:w-2 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-[1px] [&::-webkit-slider-thumb]:bg-white [&::-moz-range-track]:h-1.5 [&::-moz-range-track]:bg-transparent [&::-moz-range-thumb]:h-3.5 [&::-moz-range-thumb]:w-2 [&::-moz-range-thumb]:rounded-[1px] [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:bg-white";

function StatRow({
  label,
  ev,
  iv,
  onEV,
  onIV,
  onFocus,
}: {
  label: string;
  ev: number;
  iv: number;
  onEV: (value: number) => void;
  onIV: (value: number) => void;
  onFocus?: () => void;
}) {
  return (
    <div className="grid grid-cols-[32px_52px_minmax(0,1fr)_40px] items-center gap-2">
      <div className="font-mono text-[10.5px] text-white/55">{label}</div>
      <input
        type="number"
        min={0}
        max={252}
        value={ev}
        aria-label={`${label} EVs`}
        onFocus={onFocus}
        onChange={(e) => onEV(clampStat(Number(e.target.value), "ev"))}
        className={numberInputClass}
      />
      <div className="relative">
        <div className="pointer-events-none absolute inset-x-0 top-1/2 h-1.5 -translate-y-1/2 bg-white/[0.07]" />
        <div
          className={cn("pointer-events-none absolute left-0 top-1/2 h-1.5 -translate-y-1/2", ACCENT_BG)}
          style={{ width: `${Math.max(0, Math.min(100, (ev / 252) * 100))}%` }}
        />
        <input
          type="range"
          min={0}
          max={252}
          step={1}
          value={ev}
          aria-label={`${label} EV slider`}
          onFocus={onFocus}
          onPointerDown={onFocus}
          onChange={(e) => onEV(Number(e.target.value))}
          className={sliderClass}
        />
      </div>
      <input
        type="number"
        min={0}
        max={31}
        value={iv}
        aria-label={`${label} IVs`}
        onFocus={onFocus}
        onChange={(e) => onIV(clampStat(Number(e.target.value), "iv"))}
        className={numberInputClass}
      />
    </div>
  );
}

export function EVIVEditor({ slot, onEVChange, onIVChange, baseStats, onFieldFocus }: EVIVEditorProps) {
  const remaining = remainingEvs(slot);
  const overBudget = remaining < 0;
  const effect = natureEffect(slot.nature);

  return (
    <div className="grid gap-5 @min-[640px]:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)]">
      <div className="grid content-start gap-1.5">
        <SectionLabel
          aside={
            <span className={cn("font-mono text-[10.5px]", overBudget ? "text-red-300" : "text-white/50")}>
              {remaining} left
            </span>
          }
        >
          EV / IV
        </SectionLabel>
        <div className="grid grid-cols-[32px_52px_minmax(0,1fr)_40px] gap-2 font-mono text-[9.5px] uppercase tracking-[0.12em] text-white/25">
          <div>Stat</div>
          <div className="text-right">EV</div>
          <div>0 – 252</div>
          <div className="text-right">IV</div>
        </div>
        {STAT_KEYS.map((key) => (
          <StatRow
            key={key}
            label={STAT_LABELS[key]}
            ev={slot.evs[key]}
            iv={slot.ivs[key]}
            onEV={(value) => onEVChange(key, value)}
            onIV={(value) => onIVChange(key, value)}
            onFocus={onFieldFocus}
          />
        ))}
      </div>

      <div className="grid content-start gap-1.5">
        <SectionLabel
          aside={
            <span className="font-mono text-[10.5px] text-white/45">
              {slot.nature || "—"}
              {effect && (
                <span className="text-white/30">
                  {" "}
                  +{STAT_LABELS[effect.up]} −{STAT_LABELS[effect.down]}
                </span>
              )}
            </span>
          }
        >
          Lv 100 stats
        </SectionLabel>
        {baseStats ? (
          <>
            <div className="grid grid-cols-[32px_32px_minmax(0,1fr)_36px] gap-2 font-mono text-[9.5px] uppercase tracking-[0.12em] text-white/25">
              <div>Stat</div>
              <div className="text-right">Base</div>
              <div />
              <div className="text-right">Final</div>
            </div>
            {STAT_KEYS.map((key) => {
              const base = baseStats[key];
              const value = calculateStat(key, base, slot.ivs[key], slot.evs[key], 100, slot.nature);
              const up = effect?.up === key;
              const down = effect?.down === key;
              return (
                <div key={`preview-${key}`} className="grid h-7 grid-cols-[32px_32px_minmax(0,1fr)_36px] items-center gap-2">
                  <div className={cn("font-mono text-[10.5px]", up ? "text-emerald-300" : down ? "text-amber-300" : "text-white/55")}>
                    {STAT_LABELS[key]}
                  </div>
                  <div className="text-right font-mono text-[11px] tabular-nums text-white/40">{base}</div>
                  <div className="h-1.5 bg-white/[0.07]">
                    <div
                      className="h-full bg-white/60"
                      style={{ width: `${Math.max(2, Math.min(100, (value / 500) * 100))}%` }}
                    />
                  </div>
                  <div
                    className={cn(
                      "text-right font-mono text-[11.5px] tabular-nums",
                      up ? "text-emerald-300" : down ? "text-amber-300" : "text-white/85",
                    )}
                  >
                    {value}
                  </div>
                </div>
              );
            })}
          </>
        ) : (
          <p className="font-mono text-[11px] text-white/35">Pick a Pokémon to preview its stats.</p>
        )}
      </div>
    </div>
  );
}
