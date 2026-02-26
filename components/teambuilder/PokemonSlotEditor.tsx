"use client";

import { EVIVEditor } from "@/components/teambuilder/EVIVEditor";
import {
  COMMON_ITEMS,
  COMMON_MOVES,
  COMMON_SPECIES,
  getItemSpriteUrl,
  getPokemonFallbackSpriteUrl,
  getPokemonSpriteUrl,
} from "@/lib/teambuilder/catalog";
import { clampStat, remainingEvs, type PokemonSlot, type StatKey } from "@/lib/teambuilder/types";
import { useState } from "react";

interface PokemonSlotEditorProps {
  slot: PokemonSlot;
  slotIndex: number;
  onChange: (next: PokemonSlot) => void;
  onRemove: () => void;
}

const FIELD_CLASS =
  "rounded-md border border-white/10 bg-black/45 px-2.5 py-2 text-sm text-white outline-none placeholder:text-white/30 focus:border-white/20";

export function PokemonSlotEditor({ slot, slotIndex, onChange, onRemove }: PokemonSlotEditorProps) {
  const [spriteFallback, setSpriteFallback] = useState(false);
  const [itemIconHidden, setItemIconHidden] = useState(false);
  const update = <K extends keyof PokemonSlot>(key: K, value: PokemonSlot[K]) => {
    onChange({ ...slot, [key]: value });
  };

  const updateMove = (index: number, value: string) => {
    const moves = [...slot.moves];
    moves[index] = value;
    update("moves", moves);
  };

  const updateEV = (key: StatKey, value: number) => {
    update("evs", { ...slot.evs, [key]: clampStat(value, "ev") });
  };

  const updateIV = (key: StatKey, value: number) => {
    update("ivs", { ...slot.ivs, [key]: clampStat(value, "iv") });
  };

  const speciesList = COMMON_SPECIES.filter((name) =>
    slot.species.trim()
      ? name.toLowerCase().includes(slot.species.trim().toLowerCase())
      : true,
  ).slice(0, 8);
  const itemList = COMMON_ITEMS.filter((name) =>
    slot.item.trim() ? name.toLowerCase().includes(slot.item.trim().toLowerCase()) : true,
  ).slice(0, 8);
  const pokemonSprite = spriteFallback ? getPokemonFallbackSpriteUrl(slot.species) : getPokemonSpriteUrl(slot.species);
  const itemSprite = itemIconHidden ? null : getItemSpriteUrl(slot.item);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-xs tracking-[0.16em] text-white/40">POKEMON SLOT {slotIndex + 1}</div>
          <div className="text-sm text-white/75">
            {slot.species.trim() || "Unnamed Pokemon"}
            <span className="ml-2 text-xs text-white/45">EV Rem: {remainingEvs(slot)}</span>
          </div>
        </div>
        <button
          type="button"
          onClick={onRemove}
          className="rounded-md border border-white/10 bg-black/35 px-3 py-1.5 text-xs text-white/60 hover:bg-white/[0.03]"
        >
          Clear Slot
        </button>
      </div>

      <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-4">
        <label className="grid gap-1">
          <span className="text-xs text-white/45">Species</span>
          <input
            value={slot.species}
            onChange={(e) => {
              setSpriteFallback(false);
              update("species", e.target.value);
            }}
            className={FIELD_CLASS}
            placeholder="Charizard"
            list={`species-list-${slotIndex}`}
          />
          <datalist id={`species-list-${slotIndex}`}>
            {COMMON_SPECIES.map((name) => (
              <option key={name} value={name} />
            ))}
          </datalist>
        </label>
        <label className="grid gap-1">
          <span className="text-xs text-white/45">Nickname (optional)</span>
          <input value={slot.nickname ?? ""} onChange={(e) => update("nickname", e.target.value)} className={FIELD_CLASS} placeholder="Zard" />
        </label>
        <label className="grid gap-1">
          <span className="text-xs text-white/45">Item</span>
          <input
            value={slot.item}
            onChange={(e) => {
              setItemIconHidden(false);
              update("item", e.target.value);
            }}
            className={FIELD_CLASS}
            placeholder="Heavy-Duty Boots"
            list={`item-list-${slotIndex}`}
          />
          <datalist id={`item-list-${slotIndex}`}>
            {COMMON_ITEMS.map((name) => (
              <option key={name} value={name} />
            ))}
          </datalist>
        </label>
        <label className="grid gap-1">
          <span className="text-xs text-white/45">Ability</span>
          <input value={slot.ability} onChange={(e) => update("ability", e.target.value)} className={FIELD_CLASS} placeholder="Blaze" />
        </label>
      </div>

      <div className="grid gap-3 xl:grid-cols-[1fr_1fr]">
        <div className="rounded-xl border border-white/10 bg-white/[0.02] p-3">
          <div className="mb-2 text-xs tracking-[0.16em] text-white/40">POKEMON PREVIEW</div>
          <div className="flex items-center gap-3 rounded-lg border border-white/10 bg-black/35 p-3">
            <div className="flex h-16 w-16 items-center justify-center rounded-lg border border-white/10 bg-black/50">
              {pokemonSprite ? (
                <img
                  src={pokemonSprite}
                  alt={slot.species || "Pokemon sprite"}
                  className="h-14 w-14 object-contain"
                  onError={() => {
                    if (!spriteFallback) setSpriteFallback(true);
                  }}
                />
              ) : (
                <span className="text-xs text-white/30">No sprite</span>
              )}
            </div>
            <div className="min-w-0">
              <div className="truncate text-sm text-white">{slot.species || "Select a species"}</div>
              <div className="truncate text-xs text-white/45">{slot.nickname || "Nickname optional"}</div>
            </div>
          </div>
          {slot.species.trim() && speciesList.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1">
              {speciesList.map((name) => (
                <button
                  key={name}
                  type="button"
                  onClick={() => {
                    setSpriteFallback(false);
                    update("species", name);
                  }}
                  className="rounded-md border border-white/10 bg-black/35 px-2 py-1 text-[11px] text-white/65 hover:text-white"
                >
                  {name}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-xl border border-white/10 bg-white/[0.02] p-3">
          <div className="mb-2 text-xs tracking-[0.16em] text-white/40">ITEM PREVIEW</div>
          <div className="flex items-center gap-3 rounded-lg border border-white/10 bg-black/35 p-3">
            <div className="flex h-16 w-16 items-center justify-center rounded-lg border border-white/10 bg-black/50">
              {itemSprite ? (
                <img
                  src={itemSprite}
                  alt={slot.item || "Item icon"}
                  className="h-10 w-10 object-contain"
                  onError={() => setItemIconHidden(true)}
                />
              ) : (
                <span className="text-xs text-white/30">No icon</span>
              )}
            </div>
            <div className="min-w-0">
              <div className="truncate text-sm text-white">{slot.item || "Select an item"}</div>
              <div className="truncate text-xs text-white/45">Held item preview</div>
            </div>
          </div>
          {slot.item.trim() && itemList.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1">
              {itemList.map((name) => (
                <button
                  key={name}
                  type="button"
                  onClick={() => {
                    setItemIconHidden(false);
                    update("item", name);
                  }}
                  className="rounded-md border border-white/10 bg-black/35 px-2 py-1 text-[11px] text-white/65 hover:text-white"
                >
                  {name}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="rounded-xl border border-white/10 bg-white/[0.02] p-3">
        <div className="mb-3 text-xs tracking-[0.16em] text-white/40">MOVES (MAX 4)</div>
        <div className="grid gap-2 sm:grid-cols-2">
          {slot.moves.map((move, index) => (
            <label key={index} className="grid gap-1">
              <span className="text-xs text-white/45">Move {index + 1}</span>
              <input
                value={move}
                onChange={(e) => updateMove(index, e.target.value)}
                className={FIELD_CLASS}
                placeholder={["Flamethrower", "Air Slash", "Roost", "Focus Blast"][index]}
                list={`move-list-${slotIndex}-${index}`}
              />
              <datalist id={`move-list-${slotIndex}-${index}`}>
                {COMMON_MOVES.map((name) => (
                  <option key={name} value={name} />
                ))}
              </datalist>
            </label>
          ))}
        </div>
      </div>

      <EVIVEditor
        slot={slot}
        onEVChange={updateEV}
        onIVChange={updateIV}
        onNatureChange={(nature) => update("nature", nature)}
      />
    </div>
  );
}
