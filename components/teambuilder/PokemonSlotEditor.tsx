"use client";

import { EVIVEditor } from "@/components/teambuilder/EVIVEditor";
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
import { clampStat, STAT_KEYS, remainingEvs, type PokemonSlot, type StatKey } from "@/lib/teambuilder/types";
import { useQuery } from "@tanstack/react-query";
import { useDeferredValue, useEffect, useState } from "react";

interface PokemonSlotEditorProps {
  slot: PokemonSlot;
  slotIndex: number;
  onChange: (next: PokemonSlot) => void;
  onRemove: () => void;
}

type ActiveField =
  | { kind: "species" }
  | { kind: "item" }
  | { kind: "ability" }
  | { kind: "move"; index: number }
  | { kind: "eviv" }
  | null;

const FIELD_CLASS =
  "rounded-md border border-white/20 bg-black/20 px-2.5 py-2 text-sm text-white outline-none placeholder:text-white/35 focus:border-[#0015ff]";

function normalizeAbilityInput(input: string) {
  return input.trim().toLowerCase();
}

export function PokemonSlotEditor({ slot, slotIndex, onChange, onRemove }: PokemonSlotEditorProps) {
  const [spriteFallback, setSpriteFallback] = useState(false);
  const [speciesSearch, setSpeciesSearch] = useState(slot.species);
  const [itemSearch, setItemSearch] = useState(slot.item);
  const [activeField, setActiveField] = useState<ActiveField>(null);

  const deferredSpeciesSearch = useDeferredValue(speciesSearch.trim());
  const deferredItemSearch = useDeferredValue(itemSearch.trim());

  useEffect(() => {
    setSpeciesSearch(slot.species);
  }, [slot.species]);

  useEffect(() => {
    setItemSearch(slot.item);
  }, [slot.item]);

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
    queryFn: () => searchPokemonCatalog(deferredSpeciesSearch || "a", 60),
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
      ? speciesSearchQuery.data?.map((row) => row.name) ?? []
      : rankSearch(COMMON_SPECIES, slot.species, 40)
  ).slice(0, 40);

  const itemOptions = rankSearch(COMMON_ITEMS, deferredItemSearch || slot.item, 80);
  const defaultItemOptions = rankSearch(COMMON_ITEMS, "", 120);
  const currentMoveValue =
    activeField?.kind === "move"
      ? slot.moves[activeField.index] ?? ""
      : slot.moves.find((m) => m.trim()) ?? "";
  const moveOptions = rankSearch(COMMON_MOVES, currentMoveValue, 80);
  const defaultMoveOptions = rankSearch(COMMON_MOVES, "", 160);

  const abilityAll = speciesDetailsQuery.data?.abilities
    ? Object.values(speciesDetailsQuery.data.abilities)
    : [];
  const abilityQuery = normalizeAbilityInput(slot.ability);
  const abilityOptions = abilityAll
    .filter((ability) => (abilityQuery ? normalizeAbilityInput(ability).includes(abilityQuery) : true))
    .slice(0, 40);
  const defaultAbilityOptions = abilityAll.slice(0, 80);

  const pokemonSprite = spriteFallback ? getPokemonFallbackSpriteUrl(slot.species) : getPokemonSpriteUrl(slot.species);
  const speciesRows: Array<{ name: string; tier?: string; types?: string[] }> =
    speciesSearchQuery.data && speciesSearchQuery.data.length
      ? speciesSearchQuery.data.map((row) => ({
          name: row.name,
          tier: row.tier,
          types: row.types,
        }))
      : speciesOptions.map((name) => ({ name }));
  const defaultSpeciesRows = rankSearch(COMMON_SPECIES, "", 80).map((name) => ({ name }));

  return (
    <div className="space-y-3">
      <div className="rounded-xl border border-white/20 bg-white/5 p-2">
        <div className="mb-2 flex items-center justify-between px-1">
          <div className="text-xs tracking-[0.16em] text-white/55">POKEMON SLOT {slotIndex + 1}</div>
          <div className="flex items-center gap-2">
            <button className="text-sm text-white/80 hover:text-white" type="button">Copy</button>
            <button className="text-sm text-white/80 hover:text-white" type="button">Import/Export</button>
            <button className="text-sm text-white/80 hover:text-white" type="button">Move</button>
            <button className="text-sm text-white/80 hover:text-white" type="button" onClick={onRemove}>Delete</button>
          </div>
        </div>

        <div className="grid gap-2 xl:grid-cols-[220px_1fr_270px_230px]">
          <div className="rounded-md border border-white/20 bg-white/5 p-2">
            <label className="mb-1 grid gap-1">
              <span className="text-xs font-semibold text-white/70">Nickname</span>
              <input
                value={slot.nickname ?? ""}
                onChange={(e) => update("nickname", e.target.value)}
                className={FIELD_CLASS}
                placeholder="Gengar"
              />
            </label>

            <div className="my-2 flex h-28 items-center justify-center rounded-md border border-white/15 bg-black/15">
              {pokemonSprite ? (
                <img
                  src={pokemonSprite}
                  alt={slot.species || "Pokemon"}
                  className="h-24 w-24 object-contain"
                  onError={() => {
                    if (!spriteFallback) setSpriteFallback(true);
                  }}
                />
              ) : (
                <span className="text-xs text-white/45">No sprite</span>
              )}
            </div>

            <label className="grid gap-1">
              <span className="text-xs font-semibold text-white/70">Pokemon</span>
              <input
                value={slot.species}
                onFocus={() => setActiveField({ kind: "species" })}
                onChange={(e) => {
                  setSpriteFallback(false);
                  setSpeciesSearch(e.target.value);
                  update("species", e.target.value);
                }}
                className={FIELD_CLASS}
                placeholder="Gengar"
                list={`species-list-${slotIndex}`}
              />
              <datalist id={`species-list-${slotIndex}`}>
                {(speciesOptions.length ? speciesOptions : COMMON_SPECIES.slice(0, 40)).map((name) => (
                  <option key={name} value={name} />
                ))}
              </datalist>
            </label>
          </div>

          <div className="space-y-2">
            <label className="grid gap-1">
              <span className="text-xs font-semibold text-white/70">Item</span>
              <input
                value={slot.item}
                onFocus={() => setActiveField({ kind: "item" })}
                onChange={(e) => {
                  setItemSearch(e.target.value);
                  update("item", e.target.value);
                }}
                className={FIELD_CLASS}
                list={`item-list-${slotIndex}`}
              />
              <datalist id={`item-list-${slotIndex}`}>
                {itemOptions.map((name) => (
                  <option key={name} value={name} />
                ))}
              </datalist>
            </label>

            <div className="rounded-md border border-white/20 bg-white/5 p-2">
              <div className="mb-1 text-xs font-semibold text-white/70">Selected Item</div>
              <div className="flex items-center gap-3 rounded border border-white/15 bg-black/15 p-2">
                <div className="flex h-12 w-12 items-center justify-center rounded border border-white/15 bg-black/20">
                  {slot.item.trim() ? (
                    <img
                      src={getItemSpriteUrl(slot.item) ?? ""}
                      alt={slot.item || "Item"}
                      className="h-8 w-8 object-contain"
                      onError={(e) => {
                        e.currentTarget.style.display = "none";
                      }}
                    />
                  ) : (
                    <span className="text-[10px] text-white/45">No item</span>
                  )}
                </div>
                <div className="min-w-0 text-sm text-white/80">{slot.item || "No selected item"}</div>
              </div>
            </div>

            <label className="grid gap-1">
              <span className="text-xs font-semibold text-white/70">Ability</span>
              <input
                value={slot.ability}
                onFocus={() => setActiveField({ kind: "ability" })}
                onChange={(e) => update("ability", e.target.value)}
                className={FIELD_CLASS}
                list={`ability-list-${slotIndex}`}
              />
              <datalist id={`ability-list-${slotIndex}`}>
                {abilityOptions.map((ability) => (
                  <option key={ability} value={ability} />
                ))}
              </datalist>
            </label>

            {(speciesDetailsQuery.data?.types ?? []).length > 0 && (
              <div className="flex flex-wrap gap-1">
                {(speciesDetailsQuery.data?.types ?? []).map((type) => (
                  <span key={type} className="rounded border border-white/20 bg-black/20 px-2 py-0.5 text-xs text-white/75">
                    {type}
                  </span>
                ))}
              </div>
            )}
          </div>

          <div className="rounded-md border border-white/20 bg-white/5 p-2">
            <div className="mb-1 text-xs font-semibold text-white/70">Moves</div>
            <div className="space-y-1.5">
              {[0, 1, 2, 3].map((index) => (
                <input
                  key={index}
                  value={slot.moves[index] ?? ""}
                  onFocus={() => setActiveField({ kind: "move", index })}
                  onChange={(e) => updateMove(index, e.target.value)}
                  className={FIELD_CLASS}
                  placeholder={`Move ${index + 1}`}
                  list={`move-list-${slotIndex}-${index}`}
                />
              ))}
              {[0, 1, 2, 3].map((index) => (
                <datalist id={`move-list-${slotIndex}-${index}`} key={`dl-${index}`}>
                  {rankSearch(COMMON_MOVES, slot.moves[index] ?? "", 80).map((name) => (
                    <option key={name} value={name} />
                  ))}
                </datalist>
              ))}
            </div>
          </div>

          <button
            type="button"
            onClick={() => setActiveField({ kind: "eviv" })}
            className="rounded-md border border-white/20 bg-white/5 p-2 text-left hover:border-[#0015ff]"
          >
            <div className="mb-1 flex items-center justify-between text-xs font-semibold text-white/70">
              <span>Stats</span>
              <span>EV</span>
            </div>
            <div className="space-y-1 text-sm text-white/80">
              {STAT_KEYS.map((stat) => (
                <div key={`stat-${stat}`} className="flex items-center justify-between gap-2">
                  <span>{stat === "spa" ? "SpA" : stat === "spd" ? "SpD" : stat.toUpperCase()}</span>
                  <div className="h-2 w-20 rounded bg-white/15">
                    <div className="h-2 rounded bg-[#0015ff]/80" style={{ width: `${Math.min(100, (slot.evs[stat] / 252) * 100)}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </button>
        </div>
      </div>

      <section className="min-h-[240px] rounded-xl border border-white/20 bg-white/5 p-3">
        <div className="mb-2 text-sm font-semibold text-white/80">
          {activeField?.kind === "species"
            ? "Pokemon"
            : activeField?.kind === "item"
            ? "Items"
            : activeField?.kind === "ability"
            ? "Abilities"
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
                  setSpeciesSearch(slot.species.trim());
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
                  setSpeciesSearch(row.name);
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
                  setSpeciesSearch(row.name);
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
                  setItemSearch(slot.item.trim());
                }}
                className="mb-2 flex w-full items-center gap-2 rounded-md border border-[#0015ff]/40 bg-[#0015ff]/10 px-3 py-2 text-left"
              >
                <img
                  src={getItemSpriteUrl(slot.item.trim()) ?? ""}
                  alt={slot.item.trim()}
                  className="h-5 w-5 object-contain"
                  onError={(e) => {
                    e.currentTarget.style.display = "none";
                  }}
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
                  setItemSearch(item);
                }}
                className="flex w-full items-center gap-2 rounded-md border border-white/10 bg-black/10 px-3 py-2 text-left hover:bg-white/10"
              >
                <img
                  src={getItemSpriteUrl(item) ?? ""}
                  alt={item}
                  className="h-5 w-5 object-contain"
                  onError={(e) => {
                    e.currentTarget.style.display = "none";
                  }}
                />
                <span>{item}</span>
              </button>
            ))}

            {itemOptions.length > 0 ? <div className="mt-3 mb-1 text-xs text-white/50">Search Matches</div> : null}
            {itemOptions.slice(0, 80).map((item) => (
              <button
                key={`search-${item}`}
                type="button"
                onClick={() => {
                  update("item", item);
                  setItemSearch(item);
                }}
                className="flex w-full items-center gap-2 rounded-md border border-white/15 bg-black/15 px-3 py-2 text-left hover:bg-white/10"
              >
                <img
                  src={getItemSpriteUrl(item) ?? ""}
                  alt={item}
                  className="h-5 w-5 object-contain"
                  onError={(e) => {
                    e.currentTarget.style.display = "none";
                  }}
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
            {moveOptions.slice(0, 80).map((move) => (
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
