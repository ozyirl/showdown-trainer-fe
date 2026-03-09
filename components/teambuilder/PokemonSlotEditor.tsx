"use client";

import { EVIVEditor } from "@/components/teambuilder/EVIVEditor";
import { StatsPanel } from "@/components/stats-panel";
import { StyledFieldset, StyledInput } from "@/components/styled-input";
import {
  COMMON_ITEMS,
  COMMON_MOVES,
  COMMON_SPECIES,
  fetchPokemonDetails,
  getItemSpriteUrl,
  getPokemonFallbackSpriteUrl,
  getPokemonSpriteUrl,
  rankSearch,
  searchPokemonCatalog,
} from "@/lib/teambuilder/catalog";
import { clampStat, STAT_KEYS, type PokemonSlot, type StatKey } from "@/lib/teambuilder/types";
import { cn } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { Copy, FileUp, Leaf, Move, Package, Sparkles, Trash2, Zap } from "lucide-react";
import Image from "next/image";
import { useDeferredValue, useEffect, useState } from "react";
import type { LucideIcon } from "lucide-react";

interface PokemonSlotEditorProps {
  slot: PokemonSlot;
  slotIndex: number;
  onChange: (next: PokemonSlot) => void;
  onRemove: () => void;
}

interface ActionButton {
  label: string;
  icon: LucideIcon;
  danger?: boolean;
  onClick?: () => void;
}

type ActiveField =
  | { kind: "species" }
  | { kind: "item" }
  | { kind: "ability" }
  | { kind: "nature" }
  | { kind: "move"; index: number }
  | { kind: "eviv" }
  | null;

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
] as const;

const typeColorMap: Record<string, string> = {
  Electric: "bg-amber-500/15 text-amber-400 border-amber-500/30",
  Water: "bg-blue-500/15 text-blue-400 border-blue-500/30",
  Fire: "bg-orange-500/15 text-orange-400 border-orange-500/30",
  Grass: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  Poison: "bg-fuchsia-500/15 text-fuchsia-400 border-fuchsia-500/30",
  Flying: "bg-sky-500/15 text-sky-400 border-sky-500/30",
  Dragon: "bg-indigo-500/15 text-indigo-400 border-indigo-500/30",
  Ground: "bg-yellow-700/15 text-yellow-600 border-yellow-700/30",
  Ghost: "bg-indigo-400/15 text-indigo-300 border-indigo-400/30",
  Steel: "bg-slate-400/15 text-slate-300 border-slate-400/30",
  Dark: "bg-neutral-500/15 text-neutral-300 border-neutral-500/30",
  Normal: "bg-stone-400/15 text-stone-300 border-stone-400/30",
  Ice: "bg-cyan-400/15 text-cyan-300 border-cyan-400/30",
  Fighting: "bg-red-600/15 text-red-400 border-red-600/30",
  Psychic: "bg-pink-500/15 text-pink-400 border-pink-500/30",
  Fairy: "bg-rose-400/15 text-rose-300 border-rose-400/30",
  Bug: "bg-lime-500/15 text-lime-400 border-lime-500/30",
  Rock: "bg-yellow-800/15 text-yellow-700 border-yellow-800/30",
};

function normalizeAbilityInput(input: string) {
  return input.trim().toLowerCase();
}

function OptionalCatalogImage({
  src,
  alt,
  className,
  width,
  height,
}: {
  src: string;
  alt: string;
  className: string;
  width: number;
  height: number;
}) {
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    setHidden(false);
  }, [src]);

  if (!src || hidden) return null;

  return (
    <Image
      src={src}
      alt={alt}
      width={width}
      height={height}
      unoptimized
      className={className}
      onError={() => {
        setHidden(true);
      }}
    />
  );
}

export function PokemonSlotEditor({ slot, slotIndex, onChange, onRemove }: PokemonSlotEditorProps) {
  const [spriteFallback, setSpriteFallback] = useState(false);
  const [activeField, setActiveField] = useState<ActiveField>(null);
  const deferredSpeciesSearch = useDeferredValue(slot.species.trim());
  const deferredItemSearch = useDeferredValue(slot.item.trim());

  const update = <K extends keyof PokemonSlot>(key: K, value: PokemonSlot[K]) => {
    onChange({ ...slot, [key]: value });
  };

  const updateMove = (index: number, value: string) => {
    const moves = [...slot.moves];
    moves[index] = value;
    update("moves", moves);
  };

  const updateEV = (key: StatKey, value: number) => {
    const desired = clampStat(value, "ev");
    const otherTotal = STAT_KEYS.reduce((sum, statKey) => {
      if (statKey === key) return sum;
      return sum + slot.evs[statKey];
    }, 0);
    const maxForKey = Math.max(0, 510 - otherTotal);
    update("evs", { ...slot.evs, [key]: Math.min(desired, maxForKey) });
  };

  const updateIV = (key: StatKey, value: number) => {
    update("ivs", { ...slot.ivs, [key]: clampStat(value, "iv") });
  };

  const speciesSearchQuery = useQuery({
    queryKey: ["teambuilder", "species-search", deferredSpeciesSearch],
    queryFn: () => searchPokemonCatalog(deferredSpeciesSearch || "a", 80),
    enabled: deferredSpeciesSearch.length >= 1,
    staleTime: 60_000,
  });

  const speciesDetailsQuery = useQuery({
    queryKey: ["teambuilder", "species-details", slot.species.trim().toLowerCase()],
    queryFn: () => fetchPokemonDetails(slot.species),
    enabled: slot.species.trim().length >= 2,
    staleTime: 5 * 60_000,
  });

  const speciesOptions = (
    deferredSpeciesSearch
      ? (speciesSearchQuery.data?.map((row) => row.name) ?? [])
      : rankSearch(COMMON_SPECIES, slot.species, 80)
  ).slice(0, 80);

  const itemOptions = rankSearch(COMMON_ITEMS, deferredItemSearch || slot.item, 120);
  const defaultItemOptions = rankSearch(COMMON_ITEMS, "", 150);

  const currentMoveValue =
    activeField?.kind === "move"
      ? (slot.moves[activeField.index] ?? "")
      : (slot.moves.find((m) => m.trim()) ?? "");
  const moveOptions = rankSearch(COMMON_MOVES, currentMoveValue, 120);
  const defaultMoveOptions = rankSearch(COMMON_MOVES, "", 170);

  const abilityAll = speciesDetailsQuery.data?.abilities ? Object.values(speciesDetailsQuery.data.abilities) : [];
  const abilityQuery = normalizeAbilityInput(slot.ability);
  const abilityOptions = abilityAll
    .filter((ability) => (abilityQuery ? normalizeAbilityInput(ability).includes(abilityQuery) : true))
    .slice(0, 80);
  const defaultAbilityOptions = abilityAll.slice(0, 120);

  const pokemonSprite = spriteFallback ? getPokemonFallbackSpriteUrl(slot.species) : getPokemonSpriteUrl(slot.species);
  const speciesRows: Array<{ name: string; tier?: string; types?: string[] }> =
    speciesSearchQuery.data && speciesSearchQuery.data.length
      ? speciesSearchQuery.data.map((row) => ({ name: row.name, tier: row.tier, types: row.types }))
      : speciesOptions.map((name) => ({ name }));
  const defaultSpeciesRows = rankSearch(COMMON_SPECIES, "", 120).map((name) => ({ name }));

  const actionButtons: ActionButton[] = [
    { label: "Copy", icon: Copy },
    { label: "Import/Export", icon: FileUp },
    { label: "Move", icon: Move },
    { label: "Delete", icon: Trash2, danger: true, onClick: onRemove },
  ];

  return (
    <div className="rounded-xl border border-white/10 bg-black/30 p-5 backdrop-blur-sm">
      <div className="mb-5 flex items-center justify-between">
        <h3 className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-widest text-white/55">
          <span className="inline-flex size-6 items-center justify-center rounded-md bg-[#0015ff]/20 text-[11px] font-bold text-[#6e86ff]">
            {slotIndex + 1}
          </span>
          Pokemon Slot {slotIndex + 1}
        </h3>
        <div className="flex items-center gap-1">
          {actionButtons.map(({ label, icon: Icon, danger, onClick }) => (
            <button
              key={label}
              type="button"
              onClick={onClick}
              className={cn(
                "flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-all duration-200",
                "text-white/65 hover:bg-white/10 hover:text-white",
                danger && "hover:bg-red-500/10 hover:text-red-300",
              )}
            >
              <Icon className="size-3.5" />
              <span className="hidden sm:inline">{label}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[240px_1fr_240px_260px]">
        <StyledFieldset legend="Identity" className="flex flex-col gap-4">
          <StyledInput
            label="Nickname"
            value={slot.nickname ?? ""}
            onChange={(e) => update("nickname", e.target.value)}
            placeholder="Enter nickname..."
            icon={<Sparkles className="size-3.5" />}
          />

          <div className="flex items-center justify-center py-2">
            <div className="relative">
              <div className="absolute inset-0 rounded-full bg-[#0015ff]/10 blur-2xl" />
              {pokemonSprite ? (
                <Image
                  src={pokemonSprite}
                  alt={slot.species || "Pokemon"}
                  width={112}
                  height={112}
                  unoptimized
                  className="relative size-28 object-contain drop-shadow-lg"
                  onError={() => {
                    if (!spriteFallback) setSpriteFallback(true);
                  }}
                  style={{ imageRendering: "pixelated" }}
                />
              ) : (
                <div className="relative flex size-28 items-center justify-center rounded-full border border-white/10 text-sm text-white/40">
                  No sprite
                </div>
              )}
            </div>
          </div>

          <StyledInput
            label="Pokemon"
            value={slot.species}
            onFocus={() => setActiveField({ kind: "species" })}
            onChange={(e) => {
              setSpriteFallback(false);
              update("species", e.target.value);
            }}
            placeholder="Search pokemon..."
          />
        </StyledFieldset>

        <div className="flex flex-col gap-4">
          <StyledInput
            label="Item"
            value={slot.item}
            onFocus={() => setActiveField({ kind: "item" })}
            onChange={(e) => {
              update("item", e.target.value);
            }}
            placeholder="Search item..."
            icon={<Package className="size-3.5" />}
          />

          <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2.5">
            <div className="flex size-8 items-center justify-center rounded-md border border-white/10 bg-white/[0.02] text-[10px] text-white/40">
              {slot.item.trim() ? (
                <OptionalCatalogImage
                  src={getItemSpriteUrl(slot.item) ?? ""}
                  alt={slot.item || "Item"}
                  width={20}
                  height={20}
                  className="h-5 w-5 object-contain"
                />
              ) : (
                <Package className="size-3.5" />
              )}
            </div>
            <span className="text-sm text-white/65">{slot.item || "No selected item"}</span>
          </div>

          <StyledInput
            label="Ability"
            value={slot.ability}
            onFocus={() => setActiveField({ kind: "ability" })}
            onChange={(e) => update("ability", e.target.value)}
            placeholder="Search ability..."
            icon={<Zap className="size-3.5" />}
          />

          <StyledInput
            label="Nature"
            value={slot.nature}
            onFocus={() => setActiveField({ kind: "nature" })}
            onChange={(e) => update("nature", e.target.value)}
            placeholder="Search nature..."
            icon={<Leaf className="size-3.5" />}
          />

          <div className="flex items-center gap-2">
            {(speciesDetailsQuery.data?.types ?? []).map((type) => (
              <span
                key={type}
                className={cn(
                  "rounded-md border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider",
                  typeColorMap[type] || "bg-white/5 text-white/70 border-white/10",
                )}
              >
                {type}
              </span>
            ))}
          </div>
        </div>

        <StyledFieldset legend="Moves" className="flex flex-col gap-3">
          {[0, 1, 2, 3].map((i) => (
            <StyledInput
              key={i}
              value={slot.moves[i] || ""}
              onFocus={() => setActiveField({ kind: "move", index: i })}
              onChange={(e) => {
                const newMoves = [...slot.moves];
                newMoves[i] = e.target.value;
                onChange({ ...slot, moves: newMoves });
              }}
              placeholder={`Move ${i + 1}`}
            />
          ))}
        </StyledFieldset>

        <StatsPanel stats={slot.evs} onClick={() => setActiveField({ kind: "eviv" })} />
      </div>

      <section className="mt-5 min-h-[280px] rounded-xl border border-white/10 bg-black/20 p-3">
        <div className="mb-2 text-sm font-semibold text-white/80">
          {activeField?.kind === "species"
            ? "Pokemon"
            : activeField?.kind === "item"
              ? "Items"
              : activeField?.kind === "ability"
                ? "Abilities"
                : activeField?.kind === "nature"
                  ? "Natures"
                  : activeField?.kind === "move"
                    ? `Moves (${activeField.index + 1})`
                    : activeField?.kind === "eviv"
                      ? "EVs"
                      : "Focus a field"}
        </div>

        {!activeField && <div className="text-sm text-white/50">Click a field above to show relevant options here.</div>}

        {activeField?.kind === "species" && (
          <div className="space-y-1">
            {slot.species.trim() ? (
              <button
                type="button"
                onClick={() => {
                  setSpriteFallback(false);
                  update("species", slot.species.trim());
                }}
                className="mb-2 flex w-full items-center justify-between rounded-md border border-[#0015ff]/40 bg-[#0015ff]/10 px-3 py-2 text-left"
              >
                <span className="font-medium">{slot.species.trim()}</span>
                <span className="text-xs text-white/60">Selected</span>
              </button>
            ) : null}

            <div className="mb-1 text-xs text-white/50">Default Pokémon</div>
            {defaultSpeciesRows.slice(0, 60).map((row) => (
              <button
                key={`default-${row.name}`}
                type="button"
                onClick={() => {
                  setSpriteFallback(false);
                  update("species", row.name);
                }}
                className="flex w-full items-center justify-between rounded-md border border-white/10 bg-black/10 px-3 py-2 text-left hover:bg-white/10"
              >
                <span>{row.name}</span>
              </button>
            ))}

            {speciesRows.length > 0 ? <div className="mt-3 mb-1 text-xs text-white/50">Search Matches</div> : null}
            {speciesRows.slice(0, 50).map((row) => (
              <button
                key={`search-${row.name}`}
                type="button"
                onClick={() => {
                  setSpriteFallback(false);
                  update("species", row.name);
                }}
                className="flex w-full items-center justify-between rounded-md border border-white/15 bg-black/15 px-3 py-2 text-left hover:bg-white/10"
              >
                <span>{row.name}</span>
                <span className="text-xs text-white/55">{row.types?.join(" / ") ?? row.tier ?? ""}</span>
              </button>
            ))}
          </div>
        )}

        {activeField?.kind === "item" && (
          <div className="space-y-1">
            {slot.item.trim() ? (
              <button
                type="button"
                onClick={() => {
                  update("item", slot.item.trim());
                }}
                className="mb-2 flex w-full items-center gap-2 rounded-md border border-[#0015ff]/40 bg-[#0015ff]/10 px-3 py-2 text-left"
              >
                <OptionalCatalogImage
                  src={getItemSpriteUrl(slot.item.trim()) ?? ""}
                  alt={slot.item.trim()}
                  width={20}
                  height={20}
                  className="h-5 w-5 object-contain"
                />
                <span className="font-medium">{slot.item.trim()}</span>
                <span className="ml-auto text-xs text-white/60">Selected</span>
              </button>
            ) : null}

            <div className="mb-1 text-xs text-white/50">Default Items</div>
            {defaultItemOptions.slice(0, 100).map((item) => (
              <button
                key={`default-${item}`}
                type="button"
                onClick={() => {
                  update("item", item);
                }}
                className="flex w-full items-center gap-2 rounded-md border border-white/10 bg-black/10 px-3 py-2 text-left hover:bg-white/10"
              >
                <OptionalCatalogImage
                  src={getItemSpriteUrl(item) ?? ""}
                  alt={item}
                  width={20}
                  height={20}
                  className="h-5 w-5 object-contain"
                />
                <span>{item}</span>
              </button>
            ))}

            {itemOptions.length > 0 ? <div className="mt-3 mb-1 text-xs text-white/50">Search Matches</div> : null}
            {itemOptions.slice(0, 100).map((item) => (
              <button
                key={`search-${item}`}
                type="button"
                onClick={() => {
                  update("item", item);
                }}
                className="flex w-full items-center gap-2 rounded-md border border-white/15 bg-black/15 px-3 py-2 text-left hover:bg-white/10"
              >
                <OptionalCatalogImage
                  src={getItemSpriteUrl(item) ?? ""}
                  alt={item}
                  width={20}
                  height={20}
                  className="h-5 w-5 object-contain"
                />
                <span>{item}</span>
              </button>
            ))}
          </div>
        )}

        {activeField?.kind === "ability" && (
          <div className="space-y-1">
            {slot.ability.trim() ? (
              <button
                type="button"
                onClick={() => update("ability", slot.ability.trim())}
                className="mb-2 w-full rounded-md border border-[#0015ff]/40 bg-[#0015ff]/10 px-3 py-2 text-left"
              >
                <span className="font-medium">{slot.ability.trim()}</span>
                <span className="ml-2 text-xs text-white/60">Selected</span>
              </button>
            ) : null}

            {defaultAbilityOptions.length === 0 ? (
              <div className="text-sm text-white/50">Pick a Pokémon species first.</div>
            ) : (
              <>
                <div className="mb-1 text-xs text-white/50">Default Abilities</div>
                {defaultAbilityOptions.map((ability) => (
                  <button
                    key={`default-${ability}`}
                    type="button"
                    onClick={() => update("ability", ability)}
                    className="w-full rounded-md border border-white/10 bg-black/10 px-3 py-2 text-left hover:bg-white/10"
                  >
                    {ability}
                  </button>
                ))}
                {abilityOptions.length > 0 ? <div className="mt-3 mb-1 text-xs text-white/50">Search Matches</div> : null}
                {abilityOptions.map((ability) => (
                  <button
                    key={`search-${ability}`}
                    type="button"
                    onClick={() => update("ability", ability)}
                    className="w-full rounded-md border border-white/15 bg-black/15 px-3 py-2 text-left hover:bg-white/10"
                  >
                    {ability}
                  </button>
                ))}
              </>
            )}
          </div>
        )}

        {activeField?.kind === "nature" && (
          <div className="space-y-1">
            {slot.nature.trim() ? (
              <button
                type="button"
                onClick={() => update("nature", slot.nature.trim())}
                className="mb-2 w-full rounded-md border border-[#0015ff]/40 bg-[#0015ff]/10 px-3 py-2 text-left"
              >
                <span className="font-medium">{slot.nature.trim()}</span>
                <span className="ml-2 text-xs text-white/60">Selected</span>
              </button>
            ) : null}

            <div className="mb-1 text-xs text-white/50">Default Natures</div>
            {NATURES.map((nature) => (
              <button
                key={`nature-${nature}`}
                type="button"
                onClick={() => update("nature", nature)}
                className="w-full rounded-md border border-white/10 bg-black/10 px-3 py-2 text-left hover:bg-white/10"
              >
                {nature}
              </button>
            ))}
          </div>
        )}

        {activeField?.kind === "move" && (
          <div className="space-y-1">
            {(slot.moves[activeField.index] ?? "").trim() ? (
              <button
                type="button"
                onClick={() => updateMove(activeField.index, (slot.moves[activeField.index] ?? "").trim())}
                className="mb-2 w-full rounded-md border border-[#0015ff]/40 bg-[#0015ff]/10 px-3 py-2 text-left"
              >
                <span className="font-medium">{(slot.moves[activeField.index] ?? "").trim()}</span>
                <span className="ml-2 text-xs text-white/60">Selected</span>
              </button>
            ) : null}

            <div className="mb-1 text-xs text-white/50">Default Moves</div>
            {defaultMoveOptions.slice(0, 100).map((move) => (
              <button
                key={`default-${move}`}
                type="button"
                onClick={() => updateMove(activeField.index, move)}
                className="w-full rounded-md border border-white/10 bg-black/10 px-3 py-2 text-left hover:bg-white/10"
              >
                {move}
              </button>
            ))}
            {moveOptions.length > 0 ? <div className="mt-3 mb-1 text-xs text-white/50">Search Matches</div> : null}
            {moveOptions.slice(0, 100).map((move) => (
              <button
                key={`search-${move}`}
                type="button"
                onClick={() => updateMove(activeField.index, move)}
                className="w-full rounded-md border border-white/15 bg-black/15 px-3 py-2 text-left hover:bg-white/10"
              >
                {move}
              </button>
            ))}
          </div>
        )}

        {activeField?.kind === "eviv" && (
          <EVIVEditor
            slot={slot}
            onEVChange={updateEV}
            onIVChange={updateIV}
            onNatureChange={(nature) => update("nature", nature)}
            baseStats={speciesDetailsQuery.data?.baseStats ?? null}
            onFieldFocus={() => setActiveField({ kind: "eviv" })}
          />
        )}
      </section>
    </div>
  );
}
