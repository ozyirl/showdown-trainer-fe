"use client";

import { calculateStat, type BaseStats } from "@/lib/teambuilder/catalog";
import { clampStat, remainingEvs, STAT_KEYS, type PokemonSlot, type StatKey } from "@/lib/teambuilder/types";

interface EVIVEditorProps {
  slot: PokemonSlot;
  onEVChange: (key: StatKey, value: number) => void;
  onIVChange: (key: StatKey, value: number) => void;
  onNatureChange: (nature: string) => void;
  baseStats?: BaseStats | null;
  onFieldFocus?: () => void;
}

const NATURES = [
  "Hardy",
  "Lonely",
  "Brave",
  "Adamant",
  "Naughty",
  "Bold",
  "Docile",
  "Relaxed",
  "Impish",
  "Lax",
  "Timid",
  "Hasty",
  "Serious",
  "Jolly",
  "Naive",
  "Modest",
  "Mild",
  "Quiet",
  "Bashful",
  "Rash",
  "Calm",
  "Gentle",
  "Sassy",
  "Careful",
  "Quirky",
];

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
    <div className="grid grid-cols-[44px_88px_1fr_70px] items-center gap-2 text-xs">
      <div className="text-white/60">{label}</div>
      <input
        type="number"
        min={0}
        max={252}
        value={ev}
        onFocus={onFocus}
        onChange={(e) => onEV(clampStat(Number(e.target.value), "ev"))}
        className="rounded-md border border-white/10 bg-black/45 px-2 py-1 text-white outline-none focus:border-white/20"
      />
      <div className="relative">
        <div className="pointer-events-none absolute inset-x-0 top-1/2 h-3 -translate-y-1/2 rounded-full bg-white/10" />
        <div
          className="pointer-events-none absolute left-0 top-1/2 h-3 -translate-y-1/2 rounded-full"
          style={{
            width: `${Math.max(0, Math.min(100, (ev / 252) * 100))}%`,
            background: "linear-gradient(90deg, rgba(0,21,255,0.95), rgba(138,176,255,0.9))",
          }}
        />
        <input
          type="range"
          min={0}
          max={252}
          step={1}
          value={ev}
          onFocus={onFocus}
          onPointerDown={onFocus}
          onChange={(e) => onEV(Number(e.target.value))}
          className="relative z-10 h-8 w-full cursor-pointer appearance-none bg-transparent [&::-webkit-slider-runnable-track]:h-3 [&::-webkit-slider-runnable-track]:rounded-full [&::-webkit-slider-runnable-track]:bg-transparent [&::-webkit-slider-thumb]:mt-[-4px] [&::-webkit-slider-thumb]:h-5 [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border [&::-webkit-slider-thumb]:border-white/30 [&::-webkit-slider-thumb]:bg-black [&::-moz-range-track]:h-3 [&::-moz-range-track]:rounded-full [&::-moz-range-track]:bg-transparent [&::-moz-range-thumb]:h-5 [&::-moz-range-thumb]:w-5 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border [&::-moz-range-thumb]:border-white/30 [&::-moz-range-thumb]:bg-black"
        />
      </div>
      <input
        type="number"
        min={0}
        max={31}
        value={iv}
        onFocus={onFocus}
        onChange={(e) => onIV(clampStat(Number(e.target.value), "iv"))}
        className="rounded-md border border-white/10 bg-black/45 px-2 py-1 text-white outline-none focus:border-white/20"
      />
    </div>
  );
}

export function EVIVEditor({
  slot,
  onEVChange,
  onIVChange,
  onNatureChange,
  baseStats,
  onFieldFocus,
}: EVIVEditorProps) {
  const remaining = remainingEvs(slot);
  const overBudget = remaining < 0;

  return (
    <section className="rounded-xl border border-white/10 bg-white/[0.02] p-3">
      <div className="mb-3 flex items-center justify-between gap-2">
        <div>
          <div className="text-xs tracking-[0.16em] text-white/40">EV / IV TUNING</div>
          <div className="text-sm text-white/75">Showdown-style numeric editor</div>
        </div>
      <div className={`text-xs ${overBudget ? "text-red-300" : "text-white/60"}`}>
        Remaining EVs: {remaining}
      </div>
      </div>

      <div className="mb-2 grid grid-cols-[44px_88px_1fr_70px] gap-2 px-0.5 text-[11px] tracking-wide text-white/35">
        <div>Stat</div>
        <div>EV</div>
        <div>Bar</div>
        <div>IV</div>
      </div>

      <div className="space-y-2">
        {STAT_KEYS.map((key) => (
          <StatRow
            key={key}
            label={key.toUpperCase()}
            ev={slot.evs[key]}
            iv={slot.ivs[key]}
            onEV={(value) => onEVChange(key, value)}
            onIV={(value) => onIVChange(key, value)}
            onFocus={onFieldFocus}
          />
        ))}
      </div>

      <div className="mt-4 grid gap-2 sm:grid-cols-[100px_1fr] sm:items-center">
        <div className="text-xs text-white/50">Nature</div>
        <select
          value={slot.nature}
          onFocus={onFieldFocus}
          onChange={(e) => onNatureChange(e.target.value)}
          className="rounded-md border border-white/10 bg-black/45 px-3 py-2 text-sm text-white outline-none focus:border-white/20"
        >
          {NATURES.map((nature) => (
            <option key={nature} value={nature} className="bg-black text-white">
              {nature}
            </option>
          ))}
        </select>
      </div>

      {baseStats ? (
        <div className="mt-4 rounded-lg border border-white/10 bg-black/35 p-3">
          <div className="mb-2 text-xs tracking-[0.16em] text-white/40">STAT PREVIEW (LV 100)</div>
          <div className="grid grid-cols-[52px_52px_1fr_52px] gap-2 text-[11px] tracking-wide text-white/35">
            <div>Stat</div>
            <div>Base</div>
            <div>Final</div>
            <div>Nature</div>
          </div>
          <div className="mt-2 space-y-2">
            {STAT_KEYS.map((key) => {
              const base = baseStats[key];
              const value = calculateStat(key, base, slot.ivs[key], slot.evs[key], 100, slot.nature);
              const neutral = calculateStat(key, base, slot.ivs[key], slot.evs[key], 100, "Serious");
              const delta = value - neutral;
              return (
                <div key={`preview-${key}`} className="grid grid-cols-[52px_52px_1fr_52px] items-center gap-2 text-xs">
                  <div className="text-white/60">{key.toUpperCase()}</div>
                  <div className="text-white/50">{base}</div>
                  <div className="flex items-center gap-2">
                    <div className="h-2 flex-1 rounded-full bg-white/10">
                      <div
                        className="h-2 rounded-full"
                        style={{
                          width: `${Math.max(2, Math.min(100, (value / 500) * 100))}%`,
                          background: "linear-gradient(90deg, rgba(0,21,255,0.95), rgba(138,176,255,0.9))",
                        }}
                      />
                    </div>
                    <span className="w-10 text-right text-white/80">{value}</span>
                  </div>
                  <div className={delta > 0 ? "text-emerald-300" : delta < 0 ? "text-amber-300" : "text-white/35"}>
                    {delta > 0 ? "+" : delta < 0 ? "−" : "•"}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : null}
    </section>
  );
}
