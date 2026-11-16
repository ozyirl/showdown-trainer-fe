"use client";

import { AlertTriangle, Plus } from "lucide-react";

import { ItemIcon } from "@/components/item-icon";
import { IndexTag, Panel, SquareBadge } from "@/components/battle/panel";
import { PokemonSlotEditor } from "@/components/teambuilder/PokemonSlotEditor";
import { SlotSprite } from "@/components/teambuilder/SlotSprite";
import { TeamOverview } from "@/components/teambuilder/TeamOverview";
import { inputBoxClass, monoLabelClass } from "@/components/teambuilder/fields";
import {
  createEmptySlot,
  validateTeam,
  type PokemonSlot,
  type Team,
} from "@/lib/teambuilder/types";
import { cn } from "@/lib/utils";

interface TeamEditorProps {
  team: Team | null;
  selectedSlotIndex: number;
  onSelectSlot: (index: number) => void;
  onTeamChange: (team: Team) => void;
  loading?: boolean;
}

function SlotTab({
  slot,
  index,
  selected,
  filled,
  onClick,
}: {
  slot: PokemonSlot;
  index: number;
  selected: boolean;
  /** False for the padding tabs past the end of `team.slots`. */
  filled: boolean;
  onClick: () => void;
}) {
  const species = slot.species.trim();
  const label = slot.nickname?.trim() || species;
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      title={label || `Slot ${index + 1}`}
      className={cn(
        "relative flex h-[76px] min-w-0 flex-col items-center justify-end rounded-[4px] border px-1.5 pb-1.5 pt-1 transition-colors",
        selected
          ? "border-[#3b5bff]/70 bg-[#3b5bff]/[0.08]"
          : filled
            ? "border-white/10 bg-[#0a0a0b] hover:border-white/25 hover:bg-white/[0.03]"
            : "border-dashed border-white/10 bg-[#0a0a0b] hover:border-white/25",
      )}
    >
      <SquareBadge
        className={cn(
          "absolute left-1 top-1 h-5 min-w-5 px-1 text-[10px]",
          !selected && "bg-white/[0.08] text-white/55",
        )}
      >
        {index + 1}
      </SquareBadge>
      {slot.item.trim() && (
        <span className="absolute right-1 top-1" title={slot.item}>
          <ItemIcon item={slot.item.trim()} />
        </span>
      )}
      <span className="grid h-10 w-10 place-items-center">
        {species ? (
          <SlotSprite
            species={species}
            size={40}
            fallback={<span className="font-mono text-[10px] text-white/30">?</span>}
          />
        ) : (
          <Plus className="size-4 text-white/25" />
        )}
      </span>
      <span
        className={cn(
          "mt-0.5 w-full truncate text-center text-[11.5px]",
          label ? (selected ? "text-white" : "text-white/75") : "font-mono text-[10px] uppercase tracking-[0.12em] text-white/30",
        )}
      >
        {label || "Empty"}
      </span>
    </button>
  );
}

export function TeamEditor({
  team,
  selectedSlotIndex,
  onSelectSlot,
  onTeamChange,
  loading,
}: TeamEditorProps) {
  if (!team) {
    return (
      <Panel className="min-h-[320px] flex-1 items-center justify-center p-8 text-center">
        <IndexTag index={2} label="TEAM" />
        <div className="mt-3 text-[14px] font-medium text-white/85">
          {loading ? "Loading team…" : "Select a team"}
        </div>
        {!loading && (
          <p className="mt-1.5 max-w-xs text-[12px] text-white/45">
            Choose a team from the list or create a new one to start editing.
          </p>
        )}
      </Panel>
    );
  }

  const slots = [...team.slots];
  while (slots.length < 6) slots.push(createEmptySlot());
  const activeSlot = slots[selectedSlotIndex] ?? slots[0];
  const validationErrors = validateTeam({ ...team, slots: team.slots });

  const updateRoot = <K extends keyof Team>(key: K, value: Team[K]) => {
    onTeamChange({ ...team, [key]: value });
  };

  const updateSlot = (index: number, next: PokemonSlot) => {
    const nextSlots = [...team.slots];
    if (index >= nextSlots.length) {
      while (nextSlots.length < index) nextSlots.push(createEmptySlot());
      nextSlots.push(next);
    } else {
      nextSlots[index] = next;
    }
    onTeamChange({ ...team, slots: nextSlots.slice(0, 6) });
  };

  const clearSlot = (index: number) => {
    const nextSlots = [...team.slots];
    if (index < nextSlots.length) nextSlots[index] = createEmptySlot();
    onTeamChange({ ...team, slots: nextSlots.slice(0, 6) });
  };

  return (
    <>
      <Panel className="shrink-0">
        <div className="grid gap-2 p-2.5 sm:grid-cols-[minmax(0,1fr)_minmax(0,150px)_minmax(0,1.4fr)_auto] sm:items-center">
          <label className="flex min-w-0 items-center gap-2">
            <span className={cn(monoLabelClass, "w-12 shrink-0 sm:w-auto")}>Name</span>
            <input
              value={team.name}
              onChange={(e) => updateRoot("name", e.target.value)}
              className={cn(inputBoxClass, "font-medium")}
            />
          </label>
          <label className="flex min-w-0 items-center gap-2">
            <span className={cn(monoLabelClass, "w-12 shrink-0 sm:w-auto")}>Format</span>
            <input
              value={team.format}
              onChange={(e) => updateRoot("format", e.target.value)}
              className={cn(inputBoxClass, "font-mono text-[12px]")}
              placeholder="gen9ou"
            />
          </label>
          <label className="flex min-w-0 items-center gap-2">
            <span className={cn(monoLabelClass, "w-12 shrink-0 sm:w-auto")}>Notes</span>
            <textarea
              value={team.notes ?? ""}
              onChange={(e) => updateRoot("notes", e.target.value)}
              rows={1}
              wrap="off"
              className={cn(inputBoxClass, "resize-none overflow-hidden py-[7px] leading-4")}
              placeholder="Matchup notes, leads, and gameplan…"
            />
          </label>
          <IndexTag index={2} label="TEAM" className="hidden sm:inline" />
        </div>
        {validationErrors.length > 0 && (
          <div
            className="flex items-center gap-2 border-t border-white/[0.07] px-3 py-1.5 text-[11px] text-amber-200/85"
            title={validationErrors.join("\n")}
          >
            <AlertTriangle className="size-3.5 shrink-0" />
            <span className="truncate">{validationErrors[0]}</span>
            {validationErrors.length > 1 && (
              <span className="shrink-0 font-mono text-[10px] text-amber-200/50">
                +{validationErrors.length - 1} more
              </span>
            )}
          </div>
        )}
      </Panel>

      <div className="grid shrink-0 grid-cols-3 gap-1.5 sm:grid-cols-6" role="group" aria-label="Team slots">
        {slots.map((slot, idx) => (
          <SlotTab
            key={`tab-${idx}`}
            slot={slot}
            index={idx}
            filled={idx < team.slots.length}
            selected={idx === selectedSlotIndex}
            onClick={() => onSelectSlot(idx)}
          />
        ))}
      </div>

      <PokemonSlotEditor
        slot={activeSlot}
        slotIndex={selectedSlotIndex}
        onChange={(next) => updateSlot(selectedSlotIndex, next)}
        onRemove={() => clearSlot(selectedSlotIndex)}
        idleContent={
          <TeamOverview
            slots={slots}
            selectedSlotIndex={selectedSlotIndex}
            onSelectSlot={onSelectSlot}
          />
        }
      />
    </>
  );
}
