"use client";

import { cn } from "@/lib/utils";

interface StatsPanelProps {
  stats: {
    hp: number;
    atk: number;
    def: number;
    spa: number;
    spd: number;
    spe: number;
  };
  onClick?: () => void;
}

const statConfig = [
  { key: "hp" as const, label: "HP", color: "bg-emerald-500", maxColor: "text-emerald-400" },
  { key: "atk" as const, label: "ATK", color: "bg-red-500", maxColor: "text-red-400" },
  { key: "def" as const, label: "DEF", color: "bg-blue-500", maxColor: "text-blue-400" },
  { key: "spa" as const, label: "SpA", color: "bg-indigo-400", maxColor: "text-indigo-400" },
  { key: "spd" as const, label: "SpD", color: "bg-amber-500", maxColor: "text-amber-400" },
  { key: "spe" as const, label: "SPE", color: "bg-pink-500", maxColor: "text-pink-400" },
];

export function StatsPanel({ stats, onClick }: StatsPanelProps) {
  const maxEV = 252;

  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full rounded-2xl border border-white/10 bg-white/[0.02] p-4 text-left backdrop-blur-sm transition-colors hover:border-[#0015ff]/40"
    >
      <div className="mb-4 flex items-center justify-between">
        <h4 className="text-[11px] font-bold uppercase tracking-widest text-white/45">
          Stats
        </h4>
        <span className="text-[11px] font-semibold uppercase tracking-wider text-white/45">
          EV
        </span>
      </div>
      <div className="flex flex-col gap-3.5">
        {statConfig.map(({ key, label, color, maxColor }) => {
          const value = stats[key];
          const percentage = Math.min((value / maxEV) * 100, 100);

          return (
            <div key={key} className="group flex items-center gap-3">
              <span className="w-8 text-xs font-bold text-white/55 transition-colors group-hover:text-white/90">
                {label}
              </span>
              <div className="relative h-2.5 flex-1 overflow-hidden rounded-full bg-white/10">
                <div
                  className={cn(
                    "absolute inset-y-0 left-0 rounded-full transition-all duration-500 ease-out",
                    color,
                  )}
                  style={{ width: `${percentage}%` }}
                />
                <div
                  className={cn(
                    "absolute inset-y-0 left-0 rounded-full opacity-30 blur-sm transition-all duration-500 ease-out",
                    color,
                  )}
                  style={{ width: `${percentage}%` }}
                />
              </div>
              <span
                className={cn(
                  "w-8 text-right text-xs font-semibold tabular-nums",
                  value > 0 ? maxColor : "text-white/30",
                )}
              >
                {value}
              </span>
            </div>
          );
        })}
      </div>
      <div className="mt-4 flex items-center justify-between border-t border-white/10 pt-3">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-white/45">
          Total
        </span>
        <span className="text-xs font-bold tabular-nums text-white">
          {Object.values(stats).reduce((a, b) => a + b, 0)}
          <span className="text-white/45"> / 510</span>
        </span>
      </div>
    </button>
  );
}
