"use client";

import { PokemonSlotEditor } from "@/components/teambuilder/PokemonSlotEditor";
import {
  getPokemonFallbackSpriteUrl,
  getPokemonSpriteUrl,
} from "@/lib/teambuilder/catalog";
import {
  createEmptySlot,
  remainingEvs,
  validateTeam,
  type PokemonSlot,
  type Team,
} from "@/lib/teambuilder/types";
import Image from "next/image";
import { useEffect, useState } from "react";

interface TeamEditorProps {
  team: Team | null;
  selectedSlotIndex: number;
  onSelectSlot: (index: number) => void;
  onTeamChange: (team: Team) => void;
  onAddSlot: () => void;
  statusText?: string | null;
  saveState?: "idle" | "saving" | "saved" | "error";
}

function slotLabel(slot: PokemonSlot, index: number) {
  if (slot.nickname?.trim()) return slot.nickname.trim();
  if (slot.species.trim()) return slot.species.trim();
  return `Slot ${index + 1}`;
}

function SlotTab({
  slot,
  index,
  selected,
  onClick,
}: {
  slot: PokemonSlot;
  index: number;
  selected: boolean;
  onClick: () => void;
}) {
  const sprite =
    getPokemonSpriteUrl(slot.species) ??
    getPokemonFallbackSpriteUrl(slot.species);
  const [spriteVisible, setSpriteVisible] = useState(true);

  useEffect(() => {
    setSpriteVisible(true);
  }, [sprite]);

  const displaySprite = sprite && spriteVisible;
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex min-h-16 items-center gap-2 border px-3 py-2 text-left transition-colors ${
        selected
          ? "border-white/20 bg-white/[0.05]"
          : "border-white/10 bg-black/30 hover:bg-white/[0.03]"
      }`}
    >
      <div className="flex h-10 w-10 items-center justify-center rounded-md border border-white/10 bg-black/40">
        {displaySprite ? (
          <Image
            src={sprite}
            alt={slot.species || `Slot ${index + 1}`}
            width={32}
            height={32}
            unoptimized
            className="h-8 w-8 object-contain"
            onError={() => {
              setSpriteVisible(false);
            }}
          />
        ) : (
          <span className="text-[10px] text-white/35">#{index + 1}</span>
        )}
      </div>
      <div className="min-w-0">
        <div className="truncate text-sm text-white">
          {slotLabel(slot, index)}
        </div>
        <div className="text-xs text-white/45">EV {remainingEvs(slot)}</div>
      </div>
    </button>
  );
}

export function TeamEditor({
  team,
  selectedSlotIndex,
  onSelectSlot,
  onTeamChange,
  onAddSlot,
  statusText,
  saveState = "idle",
}: TeamEditorProps) {
  const [screen, setScreen] = useState<"team" | "editor">("team");

  if (!team) {
    return (
      <section className="flex min-h-[640px] items-center justify-center rounded-2xl border border-white/10 bg-white/[0.03] p-8 text-center backdrop-blur">
        <div>
          <div className="text-lg font-medium text-white">Select a team</div>
          <p className="mt-2 text-sm text-white/55">
            Choose a team from the list or create a new one to start editing.
          </p>
        </div>
      </section>
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
    <section className="min-h-[640px] rounded-2xl border border-white/10 bg-white/[0.03] p-4 backdrop-blur">
      <div className="mb-4 grid gap-3 xl:grid-cols-[1.2fr_1fr_auto_auto] xl:items-end">
        <label className="grid gap-1">
          <span className="text-xs tracking-[0.16em] text-white/40">
            TEAM NAME
          </span>
          <input
            value={team.name}
            onChange={(e) => updateRoot("name", e.target.value)}
            className="rounded-lg border border-white/10 bg-black/45 px-3 py-2 text-sm text-white outline-none focus:border-white/20"
          />
        </label>
        <label className="grid gap-1">
          <span className="text-xs tracking-[0.16em] text-white/40">
            FORMAT
          </span>
          <input
            value={team.format}
            onChange={(e) => updateRoot("format", e.target.value)}
            className="rounded-lg border border-white/10 bg-black/45 px-3 py-2 text-sm text-white outline-none focus:border-white/20"
            placeholder="gen9ou"
          />
        </label>
      </div>

      <div className="space-y-4">
        <div className="overflow-hidden rounded-xl border border-white/10">
          <div className="flex items-stretch overflow-x-auto">
            {slots.map((slot, idx) => (
              <SlotTab
                key={`tab-${idx}`}
                slot={slot}
                index={idx}
                selected={idx === selectedSlotIndex}
                onClick={() => onSelectSlot(idx)}
              />
            ))}
            <button
              type="button"
              onClick={onAddSlot}
              disabled={team.slots.length >= 6}
              className="min-h-16 min-w-14 border-l border-white/10 bg-black/35 px-4 text-xl text-white/70 disabled:opacity-40"
            >
              +
            </button>
          </div>
        </div>

        <div className="rounded-xl border border-white/10 bg-black/30 p-3">
          <PokemonSlotEditor
            slot={activeSlot}
            slotIndex={selectedSlotIndex}
            onChange={(next) => updateSlot(selectedSlotIndex, next)}
            onRemove={() => clearSlot(selectedSlotIndex)}
          />
        </div>
      </div>

      <label className="mt-4 grid gap-1">
        <span className="text-xs tracking-[0.16em] text-white/40">NOTES</span>
        <textarea
          value={team.notes ?? ""}
          onChange={(e) => updateRoot("notes", e.target.value)}
          rows={2}
          className="resize-none rounded-lg border border-white/10 bg-black/45 px-3 py-2 text-sm text-white outline-none placeholder:text-white/30 focus:border-white/20"
          placeholder="Matchup notes, leads, and gameplan..."
        />
      </label>

      <div className="mt-4 grid gap-3 lg:grid-cols-[1fr_auto] lg:items-center">
        <div className="rounded-xl border border-white/10 bg-black/35 p-3 text-sm">
          <div className="text-xs tracking-[0.16em] text-white/40">STATUS</div>
          <div className="mt-1 text-white/70">
            {statusText ?? "Ready"}

            {saveState === "saved" && " • Saved"}
            {saveState === "error" && " • Save failed"}
          </div>
          {validationErrors.length > 0 && (
            <ul className="mt-2 list-disc pl-4 text-xs text-amber-200/90">
              {validationErrors.slice(0, 4).map((error) => (
                <li key={error}>{error}</li>
              ))}
            </ul>
          )}
        </div>
        <div className="text-xs text-white/40">
          Two-screen flow · tabbed slot editing · contextual search panel
        </div>
      </div>
    </section>
  );
}
