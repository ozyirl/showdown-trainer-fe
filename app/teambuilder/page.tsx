"use client";

import Link from "next/link";
import { useRef } from "react";
import TextCursorProximity from "@/components/fancy/text/text-cursor-proximity";

const heroStyles = {
  title: {
    filter: { from: "blur(0px)", to: "blur(5px)" },
  },
  details: {
    filter: { from: "blur(0px)", to: "blur(3px)" },
  },
} as const;

const roster = [
  { name: "Charizard", role: "Special breaker", types: ["Fire", "Flying"] },
  { name: "Great Tusk", role: "Hazard control", types: ["Ground", "Fighting"] },
  { name: "Gholdengo", role: "Spinblocker", types: ["Steel", "Ghost"] },
  { name: "Rotom-Wash", role: "Pivot", types: ["Electric", "Water"] },
  { name: "Kingambit", role: "Wincon", types: ["Dark", "Steel"] },
  { name: "Iron Valiant", role: "Speed control", types: ["Fairy", "Fighting"] },
];

const dexRows = [
  ["Alomomola", ["Water"], ["Regenerator"], "470"],
  ["Ceruledge", ["Fire", "Ghost"], ["Flash Fire", "Weak Armor"], "525"],
  ["Clefable", ["Fairy"], ["Magic Guard", "Unaware"], "483"],
  ["Corviknight", ["Flying", "Steel"], ["Pressure", "Mirror Armor"], "495"],
  ["Dragapult", ["Dragon", "Ghost"], ["Infiltrator", "Cursed Body"], "600"],
  ["Garganacl", ["Rock"], ["Purifying Salt"], "500"],
  ["Gholdengo", ["Steel", "Ghost"], ["Good as Gold"], "550"],
  ["Great Tusk", ["Ground", "Fighting"], ["Protosynthesis"], "570"],
];

const popularItems = [
  ["Heavy-Duty Boots", "Switch-in protection from hazards."],
  ["Choice Scarf", "Speed control for revenge kills and cleaner roles."],
  ["Leftovers", "Passive sustain for bulky pivots and walls."],
  ["Booster Energy", "Paradox activation for tempo and pressure."],
  ["Rocky Helmet", "Punishes contact-heavy physical attackers."],
];

const emptySlots = [
  "Slot 1",
  "Slot 2",
  "Slot 3",
  "Slot 4",
  "Slot 5",
  "Slot 6",
];

function TypePill({ type }: { type: string }) {
  return (
    <span className="rounded-full border border-white/10 bg-white/[0.03] px-2 py-0.5 text-[11px] text-white/70">
      {type}
    </span>
  );
}

export default function TeamBuilderPage() {
  const containerRef = useRef<HTMLDivElement>(null);
  const brandBlue = "#0015ff";

  return (
    <div className="min-h-screen overflow-x-hidden bg-black text-white" ref={containerRef}>
      <div className="pointer-events-none fixed inset-0 -z-10 bg-[radial-gradient(circle_at_20%_15%,rgba(0,21,255,0.18),transparent_38%),radial-gradient(circle_at_82%_12%,rgba(0,21,255,0.1),transparent_42%),radial-gradient(circle_at_45%_80%,rgba(0,21,255,0.08),transparent_45%)]" />
      <div className="pointer-events-none fixed inset-0 -z-10 opacity-20 [background-image:linear-gradient(to_right,rgba(255,255,255,0.05)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.04)_1px,transparent_1px)] [background-size:48px_48px]" />

      <div className="mx-auto max-w-[1500px] px-4 py-6 sm:px-6 lg:px-8">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 backdrop-blur">
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="rounded-lg border border-white/10 bg-white/[0.02] px-3 py-2 text-sm text-white/75 hover:bg-white/[0.05]"
            >
              ← Back
            </Link>
            <div>
              <div className="text-xs tracking-[0.2em] text-white/40">TEAMBUILDER</div>
              <div className="text-sm text-white/70">Modern UI concept (no functionality yet)</div>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button className="rounded-lg border border-white/10 bg-white/[0.02] px-3 py-2 text-sm text-white/75">Import / Export</button>
            <button
              className="rounded-lg border border-white/15 px-3 py-2 text-sm font-medium text-white shadow-[0_0_30px_-16px_rgba(0,21,255,0.9)]"
              style={{ backgroundColor: brandBlue }}
            >
              Save Team
            </button>
          </div>
        </div>

        <div className="mb-4 grid gap-4 xl:grid-cols-[320px_1fr]">
          <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 backdrop-blur">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-xs tracking-[0.18em] text-white/40">TEAM OVERVIEW</div>
                <div className="mt-1 text-lg font-semibold text-white">Untitled 1</div>
              </div>
              <div
                className="rounded-full border px-2.5 py-1 text-[11px]"
                style={{
                  borderColor: "rgba(0,21,255,0.24)",
                  backgroundColor: "rgba(0,21,255,0.08)",
                  color: "rgba(193, 204, 255, 0.95)",
                }}
              >
                Gen 9 OU
              </div>
            </div>
            <div className="mt-4 grid grid-cols-3 gap-2 text-xs">
              {[
                ["Members", "6 / 6"],
                ["Hazards", "2 setters"],
                ["Speed", "2 control"],
              ].map(([label, value]) => (
                <div key={label} className="rounded-lg border border-white/10 bg-black/35 px-3 py-2">
                  <div className="text-white/45">{label}</div>
                  <div className="mt-1 text-white/80">{value}</div>
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-3 backdrop-blur">
            <div className="grid gap-2 md:grid-cols-4">
              {["Team", "Pokédex", "Set Editor", "EVs"].map((tab, idx) => (
                <button
                  key={tab}
                  className={`rounded-xl border px-3 py-2 text-left text-sm transition-colors ${
                    idx === 0
                      ? "border-white/15 text-white"
                      : "border-white/10 bg-black/35 text-white/60 hover:text-white/80"
                  }`}
                  style={
                    idx === 0
                      ? {
                          background:
                            "linear-gradient(180deg, rgba(0,21,255,0.16), rgba(0,21,255,0.06))",
                          boxShadow: "0 0 0 1px rgba(0,21,255,0.14) inset",
                        }
                      : undefined
                  }
                >
                  {tab}
                </button>
              ))}
            </div>
          </section>
        </div>

        <div className="grid gap-4 xl:grid-cols-[320px_1fr]">
          <aside className="space-y-4">
            <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 backdrop-blur">
              <div className="mb-3 flex items-center justify-between">
                <div className="text-sm font-medium text-white/80">Team Slots</div>
                <div className="text-xs text-white/40">OU</div>
              </div>
              <div className="space-y-2">
                {roster.map((mon, idx) => (
                  <button
                    key={mon.name}
                    className={`w-full rounded-xl border px-3 py-3 text-left transition-colors ${
                      idx === 0
                        ? "border-white/15 bg-white/[0.05]"
                        : "border-white/10 bg-black/35 hover:bg-white/[0.03]"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="text-sm font-medium text-white">{mon.name}</div>
                      <div className="text-[11px] text-white/40">#{idx + 1}</div>
                    </div>
                    <div className="mt-1 text-xs text-white/50">{mon.role}</div>
                    <div className="mt-2 flex flex-wrap gap-1">
                      {mon.types.map((type) => (
                        <TypePill key={type} type={type} />
                      ))}
                    </div>
                  </button>
                ))}
              </div>
              <button className="mt-3 w-full rounded-xl border border-dashed border-white/15 bg-black/30 px-3 py-3 text-sm text-white/60 hover:bg-white/[0.03]">
                + Add Pokémon
              </button>
            </section>

            <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 backdrop-blur">
              <div className="mb-3 flex items-center justify-between">
                <div className="text-sm font-medium text-white/80">Empty State Mock</div>
                <div className="text-xs text-white/40">Showdown-inspired</div>
              </div>
              <div className="space-y-2">
                {emptySlots.map((slot, idx) => (
                  <div
                    key={slot}
                    className="flex items-center justify-between rounded-xl border border-dashed border-white/10 bg-black/25 px-3 py-3"
                  >
                    <div className="text-sm text-white/50">{slot}</div>
                    <div className="text-xs text-white/35">{idx < 2 ? "Suggested" : "Empty"}</div>
                  </div>
                ))}
              </div>
              <div className="mt-3 rounded-xl border border-white/10 bg-black/35 p-3 text-xs leading-relaxed text-white/55">
                Start from scratch, import a PokéPaste, or choose a sample archetype. This is UI-only for now.
              </div>
            </section>

            <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 backdrop-blur">
              <div className="text-xs tracking-[0.18em] text-white/40">RESOURCES</div>
              <div className="mt-3 space-y-2 text-sm">
                {[
                  "Sample teams",
                  "Viability rankings",
                  "Speed tiers",
                  "Role compendium",
                  "Metagame discussion",
                ].map((item) => (
                  <a
                    key={item}
                    href="#"
                    className="block rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-white/70 hover:bg-white/[0.03]"
                  >
                    {item}
                  </a>
                ))}
              </div>
            </section>
          </aside>

          <main className="space-y-4">
            <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 backdrop-blur">
              <div className="mb-4 flex flex-wrap items-start justify-between gap-4">
                <div>
                  <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.02] px-3 py-1 text-xs tracking-[0.16em] text-white/50">
                    BUILD YOUR TEAM
                  </div>
                  <div className="max-w-3xl uppercase leading-[0.95] tracking-tight">
                    <TextCursorProximity
                      className="block text-3xl font-semibold text-white sm:text-4xl lg:text-5xl"
                      styles={heroStyles.title}
                      falloff="gaussian"
                      radius={100}
                      containerRef={containerRef}
                    >
                      Team Builder
                    </TextCursorProximity>
                    <TextCursorProximity
                      className="block text-3xl font-semibold sm:text-4xl lg:text-5xl"
                      styles={heroStyles.title}
                      falloff="gaussian"
                      radius={100}
                      containerRef={containerRef}
                      style={{ color: brandBlue }}
                    >
                      Draft · Refine · Export
                    </TextCursorProximity>
                  </div>
                  <p className="mt-3 max-w-2xl text-sm leading-relaxed text-white/55">
                    Search the dex, inspect abilities and stats, configure sets, and tune EVs in a cleaner high-contrast workflow.
                  </p>
                </div>
                <div className="grid gap-2 rounded-xl border border-white/10 bg-black/35 p-3 text-xs text-white/65 sm:grid-cols-2">
                  <div>Format: Gen 9 OU</div>
                  <div>Validation: Disabled</div>
                  <div>Privacy: Private</div>
                  <div>Autosave: On</div>
                </div>
              </div>

              <div className="grid gap-3 md:grid-cols-[1.2fr_1fr_1fr]">
                <div className="rounded-xl border border-white/10 bg-black/35 p-3">
                  <div className="text-xs text-white/45">Import</div>
                  <div className="mt-2 text-sm text-white/75">Paste text team or URL</div>
                  <div className="mt-3 rounded-lg border border-white/10 bg-black/50 px-3 py-2 text-xs text-white/45">
                    Paste team export, PokéPaste link, or sample template...
                  </div>
                </div>
                <div className="rounded-xl border border-white/10 bg-black/35 p-3">
                  <div className="text-xs text-white/45">Validation</div>
                  <div className="mt-2 text-sm text-white/75">Check legality for selected format</div>
                  <button className="mt-3 w-full rounded-lg border border-white/10 bg-white/[0.02] px-3 py-2 text-xs text-white/70">
                    Validate Team
                  </button>
                </div>
                <div className="rounded-xl border border-white/10 bg-black/35 p-3">
                  <div className="text-xs text-white/45">Export</div>
                  <div className="mt-2 text-sm text-white/75">Copy Showdown text / upload later</div>
                  <button
                    className="mt-3 w-full rounded-lg border border-white/15 px-3 py-2 text-xs font-medium text-white"
                    style={{
                      background:
                        "linear-gradient(180deg, rgba(0,21,255,0.22), rgba(0,21,255,0.12))",
                    }}
                  >
                    Generate Export
                  </button>
                </div>
              </div>
            </section>

            <section className="grid gap-4 2xl:grid-cols-[1.1fr_0.9fr]">
              <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 backdrop-blur">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="text-sm font-medium text-white/80">Pokédex Search</div>
                    <div className="text-xs text-white/45">Browse candidates for the active slot</div>
                  </div>
                  <div className="flex gap-2">
                    <button className="rounded-lg border border-white/10 bg-white/[0.02] px-3 py-2 text-xs text-white/70">Import from text</button>
                    <button className="rounded-lg border border-white/10 bg-white/[0.02] px-3 py-2 text-xs text-white/70">Filters</button>
                  </div>
                </div>
                <div className="mb-3 grid gap-3 md:grid-cols-[220px_160px_1fr]">
                  <input
                    readOnly
                    value="Search Pokémon"
                    className="rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-white/60 outline-none"
                  />
                  <button className="rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-left text-sm text-white/70">
                    Format: OU
                  </button>
                  <div className="rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-white/50">
                    Sort by BST · Type · Role · Speed
                  </div>
                </div>

                <div className="overflow-hidden rounded-xl border border-white/10 bg-black/40">
                  <div className="grid grid-cols-[1.4fr_1fr_1.5fr_90px] gap-3 border-b border-white/10 px-4 py-3 text-xs tracking-wide text-white/45">
                    <div>Pokémon</div>
                    <div>Types</div>
                    <div>Abilities</div>
                    <div className="text-right">BST</div>
                  </div>
                  <div className="max-h-[440px] overflow-y-auto">
                    {dexRows.map(([name, types, abilities, bst], idx) => (
                      <button
                        key={String(name)}
                        className={`grid w-full grid-cols-[1.4fr_1fr_1.5fr_90px] gap-3 px-4 py-3 text-left transition-colors ${
                          idx === 0
                            ? "bg-white/[0.04]"
                            : "hover:bg-white/[0.02]"
                        }`}
                      >
                        <div>
                          <div className="text-sm font-medium text-white">{name as string}</div>
                          <div className="text-xs text-white/45">OU</div>
                        </div>
                        <div className="flex flex-wrap gap-1 self-center">
                          {(types as string[]).map((type) => (
                            <TypePill key={`${name}-${type}`} type={type} />
                          ))}
                        </div>
                        <div className="self-center text-xs text-white/60">
                          {(abilities as string[]).join(" • ")}
                        </div>
                        <div className="self-center text-right text-sm text-white/70">
                          {bst as string}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 backdrop-blur">
                  <div className="mb-4 flex items-center justify-between gap-3">
                    <div className="text-sm font-medium text-white/80">Set Editor</div>
                    <div className="flex gap-2 text-xs">
                      <button className="rounded-lg border border-white/10 bg-white/[0.02] px-3 py-2 text-white/70">Copy</button>
                      <button className="rounded-lg border border-white/10 bg-white/[0.02] px-3 py-2 text-white/70">Move</button>
                      <button className="rounded-lg border border-white/10 bg-white/[0.02] px-3 py-2 text-white/70">Delete</button>
                    </div>
                  </div>

                  <div className="grid gap-4 xl:grid-cols-[220px_1fr]">
                    <div className="rounded-xl border border-white/10 bg-black/35 p-4">
                      <div className="mb-2 text-xs text-white/45">Nickname</div>
                      <div className="rounded-lg border border-white/10 bg-black/50 px-3 py-2 text-white/80">Charizard</div>
                      <div className="mt-4 flex items-center justify-center rounded-xl border border-white/10 bg-gradient-to-b from-white/[0.03] to-black p-4">
                        <img
                          src="https://play.pokemonshowdown.com/sprites/gen5ani/charizard.gif"
                          alt="Charizard"
                          className="h-28 w-28 object-contain"
                        />
                      </div>
                      <div className="mt-3 text-xs text-white/45">Types</div>
                      <div className="mt-2 flex gap-2">
                        <TypePill type="Fire" />
                        <TypePill type="Flying" />
                      </div>
                    </div>

                    <div className="space-y-4">
                      <div className="grid gap-3 md:grid-cols-3">
                        <div className="rounded-xl border border-white/10 bg-black/35 p-3">
                          <div className="text-xs text-white/45">Item</div>
                          <div className="mt-2 rounded-lg border border-white/10 bg-black/50 px-3 py-2 text-sm text-white/70">
                            Heavy-Duty Boots
                          </div>
                        </div>
                        <div className="rounded-xl border border-white/10 bg-black/35 p-3">
                          <div className="text-xs text-white/45">Ability</div>
                          <div className="mt-2 rounded-lg border border-white/10 bg-black/50 px-3 py-2 text-sm text-white/70">
                            Blaze
                          </div>
                        </div>
                        <div className="rounded-xl border border-white/10 bg-black/35 p-3">
                          <div className="text-xs text-white/45">Tera Type</div>
                          <div className="mt-2 rounded-lg border border-white/10 bg-black/50 px-3 py-2 text-sm text-white/70">
                            Fire
                          </div>
                        </div>
                      </div>

                      <div className="rounded-xl border border-white/10 bg-black/35 p-3">
                        <div className="mb-3 text-xs text-white/45">Moves</div>
                        <div className="grid gap-2 sm:grid-cols-2">
                          {["Flamethrower", "Air Slash", "Roost", "Focus Blast"].map((move) => (
                            <div
                              key={move}
                              className="rounded-lg border border-white/10 bg-black/50 px-3 py-2 text-sm text-white/75"
                            >
                              {move}
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                </section>

                <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 backdrop-blur">
                  <div className="mb-4 flex items-center justify-between gap-3">
                    <div>
                      <div className="text-sm font-medium text-white/80">EVs / IVs / Nature</div>
                      <div className="text-xs text-white/45">Stat tuning layout concept</div>
                    </div>
                    <div className="text-xs text-white/50">Remaining EVs: 508</div>
                  </div>
                  <div className="space-y-3">
                    {[
                      ["HP", 20],
                      ["Atk", 5],
                      ["Def", 8],
                      ["SpA", 85],
                      ["SpD", 12],
                      ["Spe", 70],
                    ].map(([stat, fill]) => (
                      <div key={String(stat)} className="grid grid-cols-[56px_1fr_44px] items-center gap-3">
                        <div className="text-xs text-white/60">{stat as string}</div>
                        <div className="h-2 rounded-full bg-white/10">
                          <div
                            className="h-2 rounded-full"
                            style={{
                              width: `${fill}%`,
                              background:
                                "linear-gradient(90deg, rgba(0,21,255,0.95), rgba(120,160,255,0.9))",
                            }}
                          />
                        </div>
                        <div className="text-right text-xs text-white/55">31</div>
                      </div>
                    ))}
                  </div>
                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    <div className="rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-white/70">Nature: Timid</div>
                    <div className="rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-white/70">EV Preset: Special Sweeper</div>
                  </div>
                </section>
              </div>
            </section>

            <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 backdrop-blur">
              <div className="mb-4 flex items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-medium text-white/80">Popular Items</div>
                  <div className="text-xs text-white/45">Contextual suggestions for the selected Pokémon</div>
                </div>
                <button className="rounded-lg border border-white/10 bg-white/[0.02] px-3 py-2 text-xs text-white/70">
                  View all items
                </button>
              </div>
              <div className="grid gap-2">
                {popularItems.map(([item, desc]) => (
                  <div
                    key={item}
                    className="grid gap-2 rounded-xl border border-white/10 bg-black/35 px-4 py-3 md:grid-cols-[220px_1fr]"
                  >
                    <div className="text-sm font-medium text-white">{item}</div>
                    <div className="text-sm text-white/55">{desc}</div>
                  </div>
                ))}
              </div>
            </section>
          </main>
        </div>
      </div>
    </div>
  );
}
