"use client";

import type { Team } from "@/lib/teambuilder/types";

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

  return (
    <aside className="flex min-h-[640px] flex-col rounded-2xl border border-white/10 bg-white/[0.03] backdrop-blur">
      <div className="border-b border-white/10 p-3">
        <div className="mb-2 text-xs tracking-[0.16em] text-white/40">TEAMS</div>
        <input
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Search teams..."
          className="w-full rounded-lg border border-white/10 bg-black/45 px-3 py-2 text-sm text-white outline-none placeholder:text-white/30 focus:border-white/20"
        />
        <div className="mt-2 grid grid-cols-2 gap-2">
          <button
            onClick={onCreate}
            disabled={loading || busyAction === "create"}
            className="rounded-lg border border-white/15 px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
            style={{ background: "linear-gradient(180deg, rgba(0,21,255,0.2), rgba(0,21,255,0.1))" }}
          >
            {busyAction === "create" ? "Creating..." : "+ New"}
          </button>
          <button
            onClick={onDuplicate}
            disabled={!selectedTeamId || !!busyAction}
            className="rounded-lg border border-white/10 bg-black/35 px-3 py-2 text-sm text-white/70 disabled:opacity-40"
          >
            Duplicate
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-2">
        {loading ? (
          <div className="p-3 text-sm text-white/50">Loading teams...</div>
        ) : filtered.length === 0 ? (
          <div className="rounded-xl border border-dashed border-white/10 bg-black/25 p-3 text-sm text-white/50">
            No teams found.
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map((team) => {
              const selected = team.id === selectedTeamId;
              return (
                <button
                  key={team.id}
                  onClick={() => onSelect(team.id)}
                  className={`w-full rounded-xl border p-3 text-left transition-colors ${
                    selected
                      ? "border-white/20 bg-white/[0.05]"
                      : "border-white/10 bg-black/30 hover:bg-white/[0.03]"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="truncate text-sm font-medium text-white">{team.name}</div>
                    <div className="text-[11px] text-white/40">{team.slots.length}/6</div>
                  </div>
                  <div className="mt-1 text-xs uppercase tracking-[0.12em] text-white/45">{team.format || "custom"}</div>
                  <div className="mt-2 line-clamp-2 text-xs text-white/45">
                    {(team.notes || "No notes yet.").trim()}
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      <div className="border-t border-white/10 p-2">
        <button
          onClick={onDelete}
          disabled={!selectedTeamId || !!busyAction}
          className="w-full rounded-lg border border-white/10 bg-black/35 px-3 py-2 text-sm text-white/60 hover:bg-white/[0.03] disabled:opacity-40"
        >
          {busyAction === "delete" ? "Deleting..." : "Delete selected team"}
        </button>
      </div>
    </aside>
  );
}
