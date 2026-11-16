"use client";

import { Fragment, type ReactNode } from "react";
import Link from "next/link";
import { Shuffle } from "lucide-react";

import {
  IndexTag,
  SquareBadge,
  boxButtonClass,
} from "@/components/battle/panel";
import {
  CheckSquare,
  MiniSprite,
  SlotPlaceholder,
} from "@/components/battle-setup/controls";
import type { Team } from "@/lib/teambuilder/types";
import { cn } from "@/lib/utils";

const TEAM_SIZE = 6;

function filledSlots(team: Team) {
  return team.slots.filter((slot) => slot.species.trim()).slice(0, TEAM_SIZE);
}

/** Side heading used in the teams panel: `[P1] Ojas · 6/6`. */
export function SideHeading({
  badge,
  title,
  aside,
  accent,
}: {
  badge: string;
  title: ReactNode;
  aside?: ReactNode;
  accent?: boolean;
}) {
  return (
    <div className="mb-2 flex min-w-0 items-center justify-between gap-2">
      <div className="flex min-w-0 items-center gap-2">
        <SquareBadge
          className={cn(
            "h-5 min-w-5 px-1 text-[10px]",
            !accent && "bg-white/[0.08] text-white/70",
          )}
        >
          {badge}
        </SquareBadge>
        <span className="truncate text-[12.5px] font-medium text-white/85">
          {title}
        </span>
      </div>
      {aside != null && <IndexTag label={aside} />}
    </div>
  );
}

function MetaLine({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex min-w-0 items-baseline justify-between gap-2 border-t border-white/[0.06] pt-1.5 first:border-t-0 first:pt-0">
      <span className="shrink-0 font-mono text-[10px] uppercase tracking-[0.14em] text-white/35">
        {label}
      </span>
      <span className="min-w-0 truncate text-[12px] text-white/75">
        {value}
      </span>
    </div>
  );
}

/** Both sides get Showdown random teams: six unknown slots each. */
export function RandomTeamsPreview({
  playerName,
  formatId,
  battleTypeLabel,
  sides,
}: {
  playerName: string;
  formatId: string;
  battleTypeLabel: string;
  /** Who plays each side, e.g. `You` and `Fly CNS model`, plus the coach. */
  sides: { p1Control: string; p2Control: string; coach: string };
}) {
  const sideBoxes = [
    {
      badge: "P1",
      title: playerName,
      accent: true,
      meta: [
        { label: "Played by", value: sides.p1Control },
        { label: "Coach", value: sides.coach },
      ],
    },
    {
      badge: "P2",
      title: "CPU",
      accent: false,
      meta: [
        { label: "Played by", value: sides.p2Control },
        { label: "Team", value: battleTypeLabel },
      ],
    },
  ];
  return (
    <div className="flex h-full min-h-0 flex-col justify-center gap-3 p-3">
      <div className="grid items-center gap-3 md:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)]">
        {sideBoxes.map((side, sideIndex) => (
          <Fragment key={side.badge}>
            {sideIndex === 1 && (
              <span className="mx-auto grid h-7 w-7 place-items-center rounded-[3px] border border-white/10 font-mono text-[10px] uppercase tracking-[0.08em] text-white/45">
                vs
              </span>
            )}
            <div className="min-w-0 rounded-[5px] border border-white/[0.07] bg-white/[0.012] p-3">
              <SideHeading
                badge={side.badge}
                title={side.title}
                accent={side.accent}
                aside="6 · random"
              />
              <div className="grid grid-cols-6 gap-1.5">
                {Array.from({ length: TEAM_SIZE }, (_, slot) => (
                  <SlotPlaceholder key={slot}>{slot + 1}</SlotPlaceholder>
                ))}
              </div>
              <div className="mt-3 space-y-1.5">
                {side.meta.map((line) => (
                  <MetaLine
                    key={line.label}
                    label={line.label}
                    value={line.value}
                  />
                ))}
              </div>
            </div>
          </Fragment>
        ))}
      </div>
      <div className="flex min-w-0 items-start gap-2 rounded-[4px] border border-white/[0.07] bg-white/[0.015] px-2.5 py-2 text-[11.5px] leading-snug text-white/50">
        <Shuffle className="mt-px h-3.5 w-3.5 shrink-0 text-white/35" />
        <span className="min-w-0">
          Showdown deals both sides a fresh {battleTypeLabel} team when the
          battle starts{" "}
          <span className="font-mono text-[10.5px] text-white/40">
            ({formatId})
          </span>
          . Switch the team source to pick saved teams or a single Pokémon.
        </span>
      </div>
    </div>
  );
}

/** Saved teams for one side as a list of selectable cards. */
export function SavedTeamPicker({
  badge,
  title,
  accent,
  teams,
  selectedId,
  onSelect,
}: {
  badge: string;
  title: string;
  accent?: boolean;
  teams: Team[];
  selectedId: string;
  onSelect: (teamId: string) => void;
}) {
  const selected = teams.find((team) => team.id === selectedId);
  return (
    <div className="flex min-h-0 min-w-0 flex-col">
      <SideHeading
        badge={badge}
        title={title}
        accent={accent}
        aside={
          selected
            ? `${filledSlots(selected).length}/${TEAM_SIZE} ready`
            : "Not selected"
        }
      />
      <div
        role="radiogroup"
        aria-label={`${title} saved team`}
        className="min-h-0 space-y-1.5"
      >
        {teams.map((team) => {
          const isSelected = team.id === selectedId;
          const slots = filledSlots(team);
          return (
            <button
              key={team.id}
              type="button"
              role="radio"
              aria-checked={isSelected}
              onClick={() => onSelect(team.id)}
              className={cn(
                "flex w-full min-w-0 items-center gap-2.5 rounded-[4px] border px-2.5 py-1.5 text-left transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-white/40",
                isSelected
                  ? "border-[#3b5bff]/70 bg-[#3b5bff]/[0.14]"
                  : "border-white/10 bg-white/[0.02] hover:border-white/25 hover:bg-white/[0.05]",
              )}
            >
              <CheckSquare checked={isSelected} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[12.5px] text-white/90">
                  {team.name || "Untitled team"}
                </span>
                <span className="block truncate font-mono text-[10px] uppercase tracking-[0.1em] text-white/35">
                  {team.format}
                  <span className="px-1 text-white/20">·</span>
                  {slots.length}/{TEAM_SIZE}
                </span>
              </span>
              <span className="flex shrink-0 items-center">
                {Array.from({ length: TEAM_SIZE }, (_, index) =>
                  slots[index] ? (
                    <MiniSprite
                      key={index}
                      name={slots[index].species}
                      size={28}
                      className="-mx-0.5"
                    />
                  ) : (
                    <span
                      key={index}
                      aria-hidden
                      className="mx-[5px] h-1 w-1 rounded-full bg-white/15"
                    />
                  ),
                )}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/** Shown in place of the pickers when there are no saved teams (or they failed). */
export function SavedTeamsEmpty({ message }: { message: string }) {
  return (
    <div className="flex h-full min-h-40 flex-col items-center justify-center gap-3 p-6 text-center">
      <div className="grid grid-cols-6 gap-1.5">
        {Array.from({ length: TEAM_SIZE }, (_, slot) => (
          <SlotPlaceholder key={slot} className="h-8 w-8">
            ·
          </SlotPlaceholder>
        ))}
      </div>
      <p className="max-w-sm text-[12px] text-white/55">{message}</p>
      <Link href="/teambuilder" className={boxButtonClass}>
        Open the teambuilder
      </Link>
    </div>
  );
}
