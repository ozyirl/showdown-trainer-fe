"use client";

import { Copy, Plus, Search, Trash2 } from "lucide-react";

import {
  ACCENT_BG,
  Panel,
  PanelHeader,
  boxButtonClass,
  formatIndex,
} from "@/components/battle/panel";
import { SlotSprite } from "@/components/teambuilder/SlotSprite";
import { inputBoxClass } from "@/components/teambuilder/fields";
import type { Team } from "@/lib/teambuilder/types";
import { cn } from "@/lib/utils";

interface TeamListProps {
  teams: Team[];
  selectedTeamId: string | null;
  search: string;
  onSearchChange: (value: string) => void;
  onSelect: (id: string) => void;
  onCreate: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  loading: boolean;
  busyAction?: string | null;
  className?: string;
}

export function TeamList({
  teams,
  selectedTeamId,
  search,
  onSearchChange,
  onSelect,
  onCreate,
  onDuplicate,
  onDelete,
  loading,
  busyAction,
  className,
}: TeamListProps) {
  const filtered = teams.filter((team) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return (
      team.name.toLowerCase().includes(q) ||
      team.format.toLowerCase().includes(q) ||
      (team.notes ?? "").toLowerCase().includes(q)
    );
  });
  const selectedTeam = teams.find((team) => team.id === selectedTeamId);

  return (
    <Panel className={cn("min-h-0", className)}>
      <PanelHeader
        title="Teams"
        index={1}
        label="TEAMS"
      />

      <div className="grid shrink-0 gap-2 border-b border-white/[0.07] p-2.5">
        <label className="relative block">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-white/30" />
          <input
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search teams…"
            aria-label="Search teams"
            className={cn(inputBoxClass, "pl-8")}
          />
        </label>
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={onCreate}
            disabled={loading || busyAction === "create"}
            className={cn(
              boxButtonClass,
              "justify-center border-[#3b5bff]/60 text-white hover:border-[#3b5bff] hover:bg-[#3b5bff]/90",
              ACCENT_BG,
            )}
          >
            <Plus className="size-3.5" />
            {busyAction === "create" ? "Creating…" : "New"}
          </button>
          <button
            type="button"
            onClick={onDuplicate}
            disabled={!selectedTeamId || !!busyAction}
            className={cn(boxButtonClass, "justify-center")}
          >
            <Copy className="size-3.5" />
            {busyAction === "duplicate" ? "Copying…" : "Duplicate"}
          </button>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {loading ? (
          <div className="px-3 py-3 font-mono text-[11px] text-white/40">
            Loading teams…
          </div>
        ) : filtered.length === 0 ? (
          <div className="px-3 py-3 text-[12px] text-white/45">
            {teams.length === 0 ? "No teams yet. Create one." : "No teams found."}
          </div>
        ) : (
          <ul>
            {filtered.map((team, idx) => {
              const selected = team.id === selectedTeamId;
              const species = team.slots
                .map((slot) => slot.species.trim())
                .filter(Boolean);
              return (
                <li key={team.id} className="border-b border-white/[0.06]">
                  <button
                    type="button"
                    onClick={() => onSelect(team.id)}
                    aria-current={selected ? "true" : undefined}
                    className={cn(
                      "relative grid w-full gap-1 px-3 py-2.5 text-left transition-colors",
                      selected
                        ? "bg-white/[0.045]"
                        : "hover:bg-white/[0.025]",
                    )}
                  >
                    {selected && (
                      <span
                        aria-hidden
                        className={cn("absolute inset-y-0 left-0 w-[2px]", ACCENT_BG)}
                      />
                    )}
                    <span className="flex items-center justify-between gap-2">
                      <span
                        className={cn(
                          "truncate text-[12.5px] font-medium",
                          selected ? "text-white" : "text-white/80",
                        )}
                      >
                        {team.name}
                      </span>
                      <span className="shrink-0 font-mono text-[10px] text-white/30">
                        {formatIndex(idx + 1)}
                      </span>
                    </span>
                    <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-white/40">
                      {team.format || "custom"}
                      <span className="px-1 text-white/20">·</span>
                      {team.slots.length}/6
                    </span>
                    {species.length > 0 && (
                      <span className="flex h-6 items-center gap-0.5">
                        {species.slice(0, 6).map((name, i) => (
                          <SlotSprite
                            key={`${name}-${i}`}
                            species={name}
                            size={24}
                            animated={false}
                          />
                        ))}
                      </span>
                    )}
                    {team.notes?.trim() && (
                      <span className="truncate text-[11px] text-white/40">
                        {team.notes.trim()}
                      </span>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <footer className="flex shrink-0 items-center justify-between gap-2 border-t border-white/[0.07] px-2.5 py-2">
        <span className="min-w-0 truncate font-mono text-[10px] uppercase tracking-[0.12em] text-white/30">
          {selectedTeam ? selectedTeam.name : "No team selected"}
        </span>
        <button
          type="button"
          onClick={onDelete}
          disabled={!selectedTeamId || !!busyAction}
          className={cn(
            boxButtonClass,
            "shrink-0 hover:border-red-400/40 hover:bg-red-500/10 hover:text-red-200",
          )}
        >
          <Trash2 className="size-3.5" />
          {busyAction === "delete" ? "Deleting…" : "Delete"}
        </button>
      </footer>
    </Panel>
  );
}
