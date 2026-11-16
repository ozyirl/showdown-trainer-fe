"use client";

import { ItemIcon } from "@/components/item-icon";
import { SquareBadge } from "@/components/battle/panel";
import { SlotSprite } from "@/components/teambuilder/SlotSprite";
import { totalEvs, type PokemonSlot } from "@/lib/teambuilder/types";
import { cn } from "@/lib/utils";

const headClass =
  "px-2 py-1.5 text-left font-mono text-[9.5px] font-normal uppercase tracking-[0.14em] text-white/30";

/** Read-only table of every slot; a row click selects that slot. */
export function TeamOverview({
  slots,
  selectedSlotIndex,
  onSelectSlot,
}: {
  slots: PokemonSlot[];
  selectedSlotIndex: number;
  onSelectSlot: (index: number) => void;
}) {
  return (
    <table className="w-full table-fixed border-collapse text-[12px]">
      <thead>
        <tr className="border-b border-white/[0.07]">
          <th className={cn(headClass, "w-9")}>#</th>
          <th className={cn(headClass, "w-[38%] @min-[480px]:w-[24%]")}>Pokémon</th>
          <th className={cn(headClass, "w-10 @min-[480px]:w-[22%]")}>Item</th>
          <th className={cn(headClass, "hidden w-[18%] @min-[560px]:table-cell")}>Ability · Nature</th>
          <th className={headClass}>Moves</th>
          <th className={cn(headClass, "w-12 text-right")}>EVs</th>
        </tr>
      </thead>
      <tbody>
        {slots.map((slot, idx) => {
          const species = slot.species.trim();
          const selected = idx === selectedSlotIndex;
          const moves = slot.moves.map((m) => m.trim()).filter(Boolean);
          return (
            <tr
              key={idx}
              onClick={() => onSelectSlot(idx)}
              aria-selected={selected}
              className={cn(
                "cursor-pointer border-b border-white/[0.05] transition-colors",
                selected ? "bg-[#3b5bff]/[0.07]" : "hover:bg-white/[0.025]",
              )}
            >
              <td className="px-2 py-1">
                <SquareBadge
                  className={cn("h-5 min-w-5 px-1 text-[10px]", !selected && "bg-white/[0.08] text-white/55")}
                >
                  {idx + 1}
                </SquareBadge>
              </td>
              <td className="px-2 py-1">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelectSlot(idx);
                  }}
                  className="flex w-full min-w-0 items-center gap-1.5 text-left focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-white/40"
                >
                  <span className="grid size-7 shrink-0 place-items-center">
                    {species && <SlotSprite species={species} size={28} animated={false} />}
                  </span>
                  <span className={cn("truncate", species ? "text-white/85" : "font-mono text-[10px] uppercase tracking-[0.12em] text-white/25")}>
                    {slot.nickname?.trim() || species || "Empty"}
                  </span>
                </button>
              </td>
              <td className="px-2 py-1">
                {slot.item.trim() ? (
                  <span className="flex min-w-0 items-center gap-1.5 text-white/65">
                    <ItemIcon item={slot.item.trim()} className="-my-1" />
                    <span className="hidden truncate @min-[480px]:inline">{slot.item}</span>
                  </span>
                ) : (
                  <span className="text-white/20">—</span>
                )}
              </td>
              <td className="hidden truncate px-2 py-1 text-white/55 @min-[560px]:table-cell">
                {species ? (
                  <>
                    {slot.ability.trim() || "—"}
                    <span className="px-1 text-white/20">·</span>
                    <span className="text-white/40">{slot.nature}</span>
                  </>
                ) : (
                  <span className="text-white/20">—</span>
                )}
              </td>
              <td className="truncate px-2 py-1 text-white/55" title={moves.join(", ")}>
                {moves.length ? moves.join(" / ") : <span className="text-white/20">—</span>}
              </td>
              <td className="px-2 py-1 text-right font-mono text-[11px] tabular-nums text-white/45">
                {totalEvs(slot)}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
