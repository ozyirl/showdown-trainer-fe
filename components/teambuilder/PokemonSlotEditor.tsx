"use client";

import { ItemIcon } from "@/components/item-icon";
import {
  ACCENT_BG,
  CornerFrame,
  Panel,
  PanelHeader,
  SquareBadge,
  boxButtonClass,
} from "@/components/battle/panel";
import { EVIVEditor, natureEffect, STAT_LABELS } from "@/components/teambuilder/EVIVEditor";
import { SlotSprite } from "@/components/teambuilder/SlotSprite";
import { Field, SectionLabel, monoLabelClass } from "@/components/teambuilder/fields";
import {
  COMMON_ITEMS,
  COMMON_MOVES,
  COMMON_SPECIES,
  calculateStat,
  fetchPokemonDetails,
  rankSearch,
  searchPokemonCatalog,
} from "@/lib/teambuilder/catalog";
import {
  clampStat,
  STAT_KEYS,
  totalEvs,
  type PokemonSlot,
  type StatKey,
} from "@/lib/teambuilder/types";
import { cn } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { Copy, FileUp, Move, Package, Sparkles, Trash2, X } from "lucide-react";
import { useDeferredValue, useState, type ReactNode } from "react";
import type { LucideIcon } from "lucide-react";

interface PokemonSlotEditorProps {
  slot: PokemonSlot;
  slotIndex: number;
  onChange: (next: PokemonSlot) => void;
  onRemove: () => void;
  /** Shown in the options panel while no field is focused. */
  idleContent?: ReactNode;
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
  Electric: "text-amber-300 border-amber-400/30",
  Water: "text-blue-300 border-blue-400/30",
  Fire: "text-orange-300 border-orange-400/30",
  Grass: "text-emerald-300 border-emerald-400/30",
  Poison: "text-fuchsia-300 border-fuchsia-400/30",
  Flying: "text-sky-300 border-sky-400/30",
  Dragon: "text-indigo-300 border-indigo-400/30",
  Ground: "text-yellow-500 border-yellow-600/30",
  Ghost: "text-indigo-300 border-indigo-300/30",
  Steel: "text-slate-300 border-slate-400/30",
  Dark: "text-neutral-300 border-neutral-400/30",
  Normal: "text-stone-300 border-stone-400/30",
  Ice: "text-cyan-300 border-cyan-400/30",
  Fighting: "text-red-300 border-red-500/30",
  Psychic: "text-pink-300 border-pink-400/30",
  Fairy: "text-rose-300 border-rose-400/30",
  Bug: "text-lime-300 border-lime-400/30",
  Rock: "text-yellow-600 border-yellow-700/30",
};

function normalizeAbilityInput(input: string) {
  return input.trim().toLowerCase();
}

function sameName(a: string, b: string) {
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}

/** A labelled grid of option buttons inside the options panel. */
function OptionGroup({
  label,
  count,
  children,
}: {
  label: ReactNode;
  count?: number;
  children: ReactNode;
}) {
  return (
    <div className="grid gap-1.5">
      <SectionLabel count={count}>{label}</SectionLabel>
      <div className="grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-1">
        {children}
      </div>
    </div>
  );
}

function OptionButton({
  selected,
  onClick,
  icon,
  meta,
  children,
}: {
  selected?: boolean;
  onClick: () => void;
  icon?: ReactNode;
  meta?: ReactNode;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={cn(
        "flex h-8 min-w-0 items-center gap-2 rounded-[3px] border px-2 text-left text-[12px] transition-colors",
        selected
          ? "border-[#3b5bff]/70 bg-[#3b5bff]/[0.12] text-white"
          : "border-white/[0.07] text-white/75 hover:border-white/25 hover:bg-white/[0.04] hover:text-white",
      )}
    >
      {icon}
      <span className="min-w-0 flex-1 truncate">{children}</span>
      {meta != null && meta !== "" && (
        <span className="shrink-0 font-mono text-[10px] text-white/35">{meta}</span>
      )}
    </button>
  );
}

export function PokemonSlotEditor({ slot, slotIndex, onChange, onRemove, idleContent }: PokemonSlotEditorProps) {
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

  const speciesRows: Array<{ name: string; tier?: string; types?: string[] }> =
    speciesSearchQuery.data && speciesSearchQuery.data.length
      ? speciesSearchQuery.data.map((row) => ({ name: row.name, tier: row.tier, types: row.types }))
      : speciesOptions.map((name) => ({ name }));
  const defaultSpeciesRows = rankSearch(COMMON_SPECIES, "", 120).map((name) => ({ name }));

  const actionButtons: ActionButton[] = [
    { label: "Copy", icon: Copy },
    { label: "Import/Export", icon: FileUp },
    { label: "Move", icon: Move },
    { label: "Clear", icon: Trash2, danger: true, onClick: onRemove },
  ];

  const species = slot.species.trim();
  const types = speciesDetailsQuery.data?.types ?? [];
  const baseStats = speciesDetailsQuery.data?.baseStats ?? null;
  const evTotal = totalEvs(slot);
  const effect = natureEffect(slot.nature);
  const isActive = (kind: NonNullable<ActiveField>["kind"], index?: number) =>
    activeField?.kind === kind && (index == null || (activeField.kind === "move" && activeField.index === index));

  const optionsTitle =
    activeField?.kind === "species"
      ? "Pokémon"
      : activeField?.kind === "item"
        ? "Items"
        : activeField?.kind === "ability"
          ? "Abilities"
          : activeField?.kind === "nature"
            ? "Natures"
            : activeField?.kind === "move"
              ? `Move ${activeField.index + 1}`
              : activeField?.kind === "eviv"
                ? "EVs & IVs"
                : idleContent
                  ? "Team overview"
                  : "Options";
  const optionsQuery =
    activeField?.kind === "species"
      ? species
      : activeField?.kind === "item"
        ? slot.item.trim()
        : activeField?.kind === "ability"
          ? slot.ability.trim()
          : activeField?.kind === "move"
            ? currentMoveValue.trim()
            : "";

  return (
    <>
      <Panel className="@container shrink-0">
        <PanelHeader
          title={
            <span className="flex min-w-0 items-center gap-2">
              <SquareBadge className="h-5 min-w-5 px-1 text-[10px]">{slotIndex + 1}</SquareBadge>
              <span className="truncate">
                {slot.nickname?.trim() || species || "Empty slot"}
              </span>
              {slot.nickname?.trim() && species && (
                <span className="truncate font-mono text-[10.5px] font-normal text-white/40">{species}</span>
              )}
            </span>
          }
          index={3}
          label="SLOT"
          aside={
            <div className="flex items-center gap-1">
              {actionButtons.map(({ label, icon: Icon, danger, onClick }) => (
                <button
                  key={label}
                  type="button"
                  onClick={onClick}
                  title={label}
                  aria-label={label}
                  className={cn(
                    boxButtonClass,
                    "h-6 px-1.5 py-0 text-[11px]",
                    danger && "hover:border-red-400/40 hover:bg-red-500/10 hover:text-red-200",
                  )}
                >
                  <Icon className="size-3.5" />
                  <span className="hidden @min-[760px]:inline">{label}</span>
                </button>
              ))}
            </div>
          }
        />

        <div className="grid grid-cols-1 @min-[560px]:grid-cols-[156px_minmax(0,1fr)] @min-[640px]:grid-cols-[148px_minmax(0,1fr)_minmax(0,212px)] @min-[760px]:grid-cols-[164px_minmax(0,1fr)_minmax(0,228px)]">
          {/* Identity */}
          <div className="grid content-start gap-2.5 p-3">
            <CornerFrame className="grid h-[92px] place-items-center">
              {species ? (
                <SlotSprite
                  species={species}
                  size={88}
                  fallback={<span className={monoLabelClass}>No sprite</span>}
                />
              ) : (
                <span className={monoLabelClass}>No Pokémon</span>
              )}
            </CornerFrame>
            <Field
              label="Pokémon"
              value={slot.species}
              active={isActive("species")}
              onFocus={() => setActiveField({ kind: "species" })}
              onChange={(e) => update("species", e.target.value)}
              placeholder="Search Pokémon…"
            />
            <Field
              label="Nickname"
              value={slot.nickname ?? ""}
              onChange={(e) => update("nickname", e.target.value)}
              placeholder="Optional"
              icon={<Sparkles className="size-3.5" />}
            />
          </div>

          {/* Details and moves */}
          <div className="grid content-start gap-3 border-t border-white/[0.07] p-3 @min-[560px]:border-l @min-[560px]:border-t-0">
            <div className="grid grid-cols-2 gap-x-2 gap-y-2.5">
              <Field
                label="Item"
                value={slot.item}
                active={isActive("item")}
                onFocus={() => setActiveField({ kind: "item" })}
                onChange={(e) => update("item", e.target.value)}
                placeholder="Search item…"
                icon={<ItemIcon item={slot.item.trim()} fallback={<Package className="size-3.5" />} />}
              />
              <Field
                label="Ability"
                value={slot.ability}
                active={isActive("ability")}
                onFocus={() => setActiveField({ kind: "ability" })}
                onChange={(e) => update("ability", e.target.value)}
                placeholder="Search ability…"
              />
              <Field
                label={
                  <>
                    Nature
                    {effect && (
                      <span className="normal-case tracking-normal text-white/30">
                        {"  "}+{STAT_LABELS[effect.up]} −{STAT_LABELS[effect.down]}
                      </span>
                    )}
                  </>
                }
                value={slot.nature}
                active={isActive("nature")}
                onFocus={() => setActiveField({ kind: "nature" })}
                onChange={(e) => update("nature", e.target.value)}
                placeholder="Search nature…"
              />
              <div className="grid min-w-0 gap-1">
                <span className={monoLabelClass}>Type</span>
                <div className="flex h-8 items-center gap-1">
                  {types.length ? (
                    types.map((type) => (
                      <span
                        key={type}
                        className={cn(
                          "rounded-[3px] border px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-[0.1em]",
                          typeColorMap[type] || "border-white/10 text-white/70",
                        )}
                      >
                        {type}
                      </span>
                    ))
                  ) : (
                    <span className="font-mono text-[11px] text-white/25">—</span>
                  )}
                </div>
              </div>
            </div>

            <div className="grid gap-1">
              <SectionLabel count={`${slot.moves.filter((m) => m.trim()).length}/4`}>Moves</SectionLabel>
              <div className="grid grid-cols-2 gap-1.5">
                {[0, 1, 2, 3].map((i) => (
                  <label key={i} className="relative block min-w-0">
                    <span className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 font-mono text-[10px] text-white/30">
                      {i + 1}
                    </span>
                    <input
                      value={slot.moves[i] || ""}
                      onFocus={() => setActiveField({ kind: "move", index: i })}
                      onChange={(e) => updateMove(i, e.target.value)}
                      placeholder={`Move ${i + 1}`}
                      aria-label={`Move ${i + 1}`}
                      className={cn(
                        "h-8 w-full min-w-0 rounded-[4px] border border-white/10 bg-white/[0.02] pl-6 pr-2 text-[12.5px] text-white outline-none transition-colors placeholder:text-white/25 hover:border-white/20 focus:border-[#3b5bff]/70",
                        isActive("move", i) && "border-[#3b5bff]/60 bg-[#3b5bff]/[0.06]",
                      )}
                    />
                  </label>
                ))}
              </div>
            </div>
          </div>

          {/* Stats summary; opens the EV/IV editor below. */}
          <button
            type="button"
            onClick={() => setActiveField({ kind: "eviv" })}
            aria-pressed={isActive("eviv")}
            className={cn(
              "grid content-start gap-1.5 border-t border-white/[0.07] p-3 text-left transition-colors @min-[560px]:col-span-2 @min-[640px]:col-span-1 @min-[640px]:border-l @min-[640px]:border-t-0",
              isActive("eviv") ? "bg-[#3b5bff]/[0.06]" : "hover:bg-white/[0.02]",
            )}
          >
            <SectionLabel
              aside={
                <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-white/30">
                  EV{baseStats ? " · Stat" : ""}
                </span>
              }
            >
              Stats
            </SectionLabel>
            <div className="grid gap-[7px] pt-0.5">
              {STAT_KEYS.map((key) => {
                const ev = slot.evs[key];
                const up = effect?.up === key;
                const down = effect?.down === key;
                return (
                  <div key={key} className="grid grid-cols-[30px_minmax(0,1fr)_26px_auto] items-center gap-2">
                    <span
                      className={cn(
                        "font-mono text-[10.5px]",
                        up ? "text-emerald-300" : down ? "text-amber-300" : "text-white/50",
                      )}
                    >
                      {STAT_LABELS[key]}
                    </span>
                    <span className="h-1.5 bg-white/[0.07]">
                      <span
                        className={cn("block h-full", ev > 0 ? ACCENT_BG : "")}
                        style={{ width: `${Math.min(100, (ev / 252) * 100)}%` }}
                      />
                    </span>
                    <span
                      className={cn(
                        "text-right font-mono text-[11px] tabular-nums",
                        ev > 0 ? "text-white/85" : "text-white/25",
                      )}
                    >
                      {ev}
                    </span>
                    {baseStats && (
                      <span className="w-7 text-right font-mono text-[11px] tabular-nums text-white/45">
                        {calculateStat(key, baseStats[key], slot.ivs[key], ev, 100, slot.nature)}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
            <div className="mt-1 flex items-center justify-between border-t border-white/[0.07] pt-1.5">
              <span className={monoLabelClass}>Total</span>
              <span className={cn("font-mono text-[11.5px] tabular-nums", evTotal > 510 ? "text-red-300" : "text-white")}>
                {evTotal}
                <span className="text-white/35"> / 510</span>
              </span>
            </div>
          </button>
        </div>
      </Panel>

      <Panel className="@container h-[380px] shrink-0 lg:h-auto lg:min-h-[160px] lg:flex-1">
        <PanelHeader
          title={optionsTitle}
          index={4}
          label="OPTIONS"
          aside={
            !activeField ? (
              idleContent ? (
                <span className="hidden font-mono text-[10px] text-white/30 sm:inline">Focus a field for its options</span>
              ) : null
            ) : (
              <>
                {optionsQuery && (
                  <span className="max-w-40 truncate font-mono text-[10.5px] text-white/40">“{optionsQuery}”</span>
                )}
                <button
                  type="button"
                  onClick={() => setActiveField(null)}
                  aria-label="Close options"
                  className={cn(boxButtonClass, "h-6 px-1.5 py-0")}
                >
                  <X className="size-3.5" />
                </button>
              </>
            )
          }
        />

        <div className={cn("min-h-0 flex-1 overflow-y-auto", activeField || !idleContent ? "p-3" : "px-1 pb-1")}>
          {!activeField && idleContent}
          {!activeField && !idleContent && (
            <div className="grid h-full place-items-center">
              <p className="max-w-sm text-center font-mono text-[11px] leading-5 text-white/35">
                Focus a field to browse options here: Pokémon, item, ability, nature, a move, or the stats.
              </p>
            </div>
          )}

          {activeField?.kind === "species" && (
            <div className="grid gap-3">
              {species && speciesRows.length > 0 && (
                <OptionGroup label="Matches" count={Math.min(50, speciesRows.length)}>
                  {speciesRows.slice(0, 50).map((row) => (
                    <OptionButton
                      key={`search-${row.name}`}
                      selected={sameName(row.name, species)}
                      onClick={() => update("species", row.name)}
                      meta={row.types?.join("/") ?? row.tier ?? ""}
                    >
                      {row.name}
                    </OptionButton>
                  ))}
                </OptionGroup>
              )}
              <OptionGroup label="Common" count={60}>
                {defaultSpeciesRows.slice(0, 60).map((row) => (
                  <OptionButton
                    key={`default-${row.name}`}
                    selected={sameName(row.name, species)}
                    onClick={() => update("species", row.name)}
                  >
                    {row.name}
                  </OptionButton>
                ))}
              </OptionGroup>
            </div>
          )}

          {activeField?.kind === "item" && (
            <div className="grid gap-3">
              {slot.item.trim() && itemOptions.length > 0 && (
                <OptionGroup label="Matches" count={Math.min(100, itemOptions.length)}>
                  {itemOptions.slice(0, 100).map((item) => (
                    <OptionButton
                      key={`search-${item}`}
                      selected={sameName(item, slot.item)}
                      onClick={() => update("item", item)}
                      icon={<ItemIcon item={item} className="-my-1" />}
                    >
                      {item}
                    </OptionButton>
                  ))}
                </OptionGroup>
              )}
              <OptionGroup label="Common" count={Math.min(100, defaultItemOptions.length)}>
                {defaultItemOptions.slice(0, 100).map((item) => (
                  <OptionButton
                    key={`default-${item}`}
                    selected={sameName(item, slot.item)}
                    onClick={() => update("item", item)}
                    icon={<ItemIcon item={item} className="-my-1" />}
                  >
                    {item}
                  </OptionButton>
                ))}
              </OptionGroup>
            </div>
          )}

          {activeField?.kind === "ability" &&
            (defaultAbilityOptions.length === 0 ? (
              <p className="font-mono text-[11px] text-white/40">Pick a Pokémon species first.</p>
            ) : (
              <div className="grid gap-3">
                {abilityQuery && abilityOptions.length > 0 && (
                  <OptionGroup label="Matches" count={abilityOptions.length}>
                    {abilityOptions.map((ability) => (
                      <OptionButton
                        key={`search-${ability}`}
                        selected={sameName(ability, slot.ability)}
                        onClick={() => update("ability", ability)}
                      >
                        {ability}
                      </OptionButton>
                    ))}
                  </OptionGroup>
                )}
                <OptionGroup label={species ? `${species} abilities` : "Abilities"} count={defaultAbilityOptions.length}>
                  {defaultAbilityOptions.map((ability) => (
                    <OptionButton
                      key={`default-${ability}`}
                      selected={sameName(ability, slot.ability)}
                      onClick={() => update("ability", ability)}
                    >
                      {ability}
                    </OptionButton>
                  ))}
                </OptionGroup>
              </div>
            ))}

          {activeField?.kind === "nature" && (
            <OptionGroup label="Natures" count={NATURES.length}>
              {NATURES.map((nature) => {
                const fx = natureEffect(nature);
                return (
                  <OptionButton
                    key={`nature-${nature}`}
                    selected={sameName(nature, slot.nature)}
                    onClick={() => update("nature", nature)}
                    meta={fx ? `+${STAT_LABELS[fx.up]} −${STAT_LABELS[fx.down]}` : "neutral"}
                  >
                    {nature}
                  </OptionButton>
                );
              })}
            </OptionGroup>
          )}

          {activeField?.kind === "move" && (
            <div className="grid gap-3">
              {currentMoveValue.trim() && moveOptions.length > 0 && (
                <OptionGroup label="Matches" count={Math.min(100, moveOptions.length)}>
                  {moveOptions.slice(0, 100).map((move) => (
                    <OptionButton
                      key={`search-${move}`}
                      selected={sameName(move, slot.moves[activeField.index] ?? "")}
                      onClick={() => updateMove(activeField.index, move)}
                    >
                      {move}
                    </OptionButton>
                  ))}
                </OptionGroup>
              )}
              <OptionGroup label="Common" count={Math.min(100, defaultMoveOptions.length)}>
                {defaultMoveOptions.slice(0, 100).map((move) => (
                  <OptionButton
                    key={`default-${move}`}
                    selected={sameName(move, slot.moves[activeField.index] ?? "")}
                    onClick={() => updateMove(activeField.index, move)}
                  >
                    {move}
                  </OptionButton>
                ))}
              </OptionGroup>
            </div>
          )}

          {activeField?.kind === "eviv" && (
            <EVIVEditor
              slot={slot}
              onEVChange={updateEV}
              onIVChange={updateIV}
              baseStats={baseStats}
              onFieldFocus={() => setActiveField({ kind: "eviv" })}
            />
          )}
        </div>
      </Panel>
    </>
  );
}
