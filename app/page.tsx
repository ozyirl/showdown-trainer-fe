"use client";

import { useQuery } from "@tanstack/react-query";
import TextCursorProximity from "@/components/fancy/text/text-cursor-proximity";
import { InteractiveBattle } from "./interactive-battle";
import { useRef, useState } from "react";

const API_URL = "http://localhost:5200/api";

interface BattleLog {
  rawLog: string[];
  formattedLog: string;
  winner: string | null;
  turns: number;
}

interface PokemonInfo {
  name: string;
  num: number;
  types: string[];
  baseStats: {
    hp: number;
    atk: number;
    def: number;
    spa: number;
    spd: number;
    spe: number;
  };
  abilities: Record<string, string>;
  weightkg: number;
  tier: string;
}

const proximityStyles = {
  title: {
    filter: {
      from: "blur(0px)",
      to: "blur(6px)",
    },
  },
  details: {
    filter: {
      from: "blur(0px)",
      to: "blur(3px)",
    },
  },
} as const;

export default function Home() {
  const [mode, setMode] = useState<"demo" | "interactive">("interactive");
  const heroRef = useRef<HTMLDivElement>(null);
  const brandBlue = "#0015ff";
  const tabClass = (active: boolean) =>
    `rounded-full px-4 py-2 text-sm font-medium transition-colors border ${
      active
        ? "border-white/20 text-white shadow-[0_0_40px_-18px_rgba(0,21,255,0.95)]"
        : "border-white/10 bg-white/[0.02] text-white/70 hover:border-white/20 hover:text-white"
    }`;
  const bentoCard =
    "rounded-2xl border border-white/10 bg-gradient-to-b from-white/[0.03] to-white/[0.01] p-6 backdrop-blur";

  // Fetch battle simulation
  const {
    data: battleData,
    isLoading: battleLoading,
    error: battleError,
    refetch: refetchBattle,
  } = useQuery<BattleLog>({
    queryKey: ["battle"],
    queryFn: async () => {
      const response = await fetch(`${API_URL}/battle/simulate`);
      if (!response.ok) throw new Error("Failed to fetch battle");
      return response.json();
    },
    enabled: mode === "demo",
  });

  // Fetch Gengar info
  const { data: gengarData } = useQuery<PokemonInfo>({
    queryKey: ["pokemon", "gengar"],
    queryFn: async () => {
      const response = await fetch(`${API_URL}/battle/pokemon/gengar`);
      if (!response.ok) throw new Error("Failed to fetch Pokemon");
      return response.json();
    },
    enabled: mode === "demo",
  });

  // Fetch Charizard info
  const { data: charizardData } = useQuery<PokemonInfo>({
    queryKey: ["pokemon", "charizard"],
    queryFn: async () => {
      const response = await fetch(`${API_URL}/battle/pokemon/charizard`);
      if (!response.ok) throw new Error("Failed to fetch Pokemon");
      return response.json();
    },
    enabled: mode === "demo",
  });

  return (
    <div className="min-h-screen overflow-x-hidden bg-black text-white">
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <div className="pointer-events-none fixed inset-0 -z-10 bg-[radial-gradient(circle_at_20%_15%,rgba(0,21,255,0.18),transparent_38%),radial-gradient(circle_at_78%_18%,rgba(0,21,255,0.12),transparent_42%),radial-gradient(circle_at_50%_90%,rgba(0,21,255,0.08),transparent_45%)]" />

        {/* Bento Header */}
        <div className="mb-8 grid grid-cols-1 gap-4 lg:grid-cols-12 lg:auto-rows-min" ref={heroRef}>
          <div className={`${bentoCard} relative overflow-hidden lg:col-span-7`}>
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_65%_15%,rgba(0,21,255,0.18),transparent_45%)]" />
            <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.05)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.04)_1px,transparent_1px)] bg-[size:40px_40px] opacity-25" />
            <div className="relative">
              <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/15 px-3 py-1 text-xs tracking-[0.16em] text-white/85">
                SHOWDOWN TRAINER
              </div>
              <div className="max-w-2xl uppercase leading-[0.95] tracking-tight">
                <TextCursorProximity
                  className="block text-3xl font-semibold text-white sm:text-5xl lg:text-6xl"
                  styles={proximityStyles.title}
                  falloff="gaussian"
                  radius={110}
                  containerRef={heroRef}
                >
                  Build Your Team
                </TextCursorProximity>
                <TextCursorProximity
                  className="block text-3xl font-semibold sm:text-5xl lg:text-6xl"
                  styles={proximityStyles.title}
                  falloff="gaussian"
                  radius={110}
                  containerRef={heroRef}
                  style={{ color: brandBlue }}
                >
                  Train With AI
                </TextCursorProximity>
              </div>
              <p className="mt-4 max-w-xl text-base leading-relaxed text-white/60">
                Blue-black battle workspace for teambuilding, Elite Four runs,
                AI-vs-AI simulation, live battle guidance, and practice against an AI trainer.
              </p>

              <div className="mt-8 flex flex-wrap gap-2">
                <button
                  onClick={() => setMode("interactive")}
                  className={tabClass(mode === "interactive")}
                  style={mode === "interactive" ? { backgroundColor: brandBlue } : undefined}
                >
                  Interactive Battle
                </button>
                <button
                  onClick={() => setMode("demo")}
                  className={tabClass(mode === "demo")}
                >
                  Auto Battle Demo
                </button>
              </div>

              <div className="mt-6 grid gap-2 sm:grid-cols-2">
                {[
                  "Teambuilder",
                  "Battle AI",
                  "AI vs AI",
                  "Live AI Trainer Recommendations",
                ].map((item) => (
                  <TextCursorProximity
                    key={item}
                    className="rounded-lg border border-white/10 bg-black/45 px-3 py-2 text-sm text-white/70"
                    styles={proximityStyles.details}
                    falloff="exponential"
                    radius={75}
                    containerRef={heroRef}
                  >
                    {item}
                  </TextCursorProximity>
                ))}
              </div>
            </div>
          </div>

          <div className={`${bentoCard} lg:col-span-5`}>
            <div className="text-xs tracking-[0.18em] text-white/40">CORE MODES</div>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {[
                {
                  title: "Teambuilder",
                  desc: "Create custom teams and move sets before queueing into battles.",
                },
                {
                  title: "Battle AI",
                  desc: "Fight an AI trainer and get live CPU reasoning after each turn.",
                },
                {
                  title: "AI vs AI",
                  desc: "Simulate matchups automatically to test strategy and move quality.",
                },
                {
                  title: "Live Recommendations",
                  desc: "AI trainer suggestions during battle based on current board state.",
                },
              ].map((card, i) => (
                <div
                  key={card.title}
                  className={`rounded-xl border p-4 ${
                    i === 1 || i === 3
                      ? "border-white/15"
                      : "border-white/10 bg-black/35"
                  }`}
                  style={i === 1 || i === 3 ? { backgroundColor: "rgba(0,21,255,0.08)" } : undefined}
                >
                  <div className="text-sm font-semibold text-white">{card.title}</div>
                  <p className="mt-2 text-xs leading-relaxed text-white/55">
                    {card.desc}
                  </p>
                </div>
              ))}
            </div>
          </div>

          <div className={`${bentoCard} lg:col-span-4`}>
            <div className="text-xs tracking-[0.18em] text-white/40">ELITE FOUR MODE</div>
            <div className="mt-3 text-2xl font-semibold tracking-tight text-white">
              Fight Elite 4 • Any Region
            </div>
            <p className="mt-2 text-sm leading-relaxed text-white/55">
              Planned progression mode with region presets, staged teams, and run tracking.
            </p>
            <div className="mt-5 space-y-2">
              {["Kanto", "Johto", "Hoenn", "Sinnoh", "Unova", "Paldea"].map(
                (region) => (
                  <div
                    key={region}
                    className="flex items-center justify-between rounded-lg border border-white/10 bg-black/35 px-3 py-2 text-sm"
                  >
                    <span className="text-white/75">{region}</span>
                    <span className="text-xs" style={{ color: "rgba(153, 168, 255, 0.9)" }}>Elite 4 + Champion</span>
                  </div>
                ),
              )}
            </div>
          </div>

          <div className={`${bentoCard} lg:col-span-8`}>
            <div className="mb-3 flex items-center justify-between gap-2">
              <div className="text-xs tracking-[0.18em] text-white/40">
                AI TRAINER PANEL
              </div>
              <div
                className="rounded-full border px-2 py-1 text-[11px]"
                style={{
                  borderColor: "rgba(0,21,255,0.22)",
                  backgroundColor: "rgba(0,21,255,0.08)",
                  color: "rgba(173, 186, 255, 0.95)",
                }}
              >
                Live recommendations from AI
              </div>
            </div>
            <div className="grid gap-4 md:grid-cols-[1.2fr_1fr]">
              <div className="rounded-xl border border-white/10 bg-black/40 p-4">
                <div className="text-xs text-white/45">Decision Summary</div>
                <div className="mt-2 text-lg font-semibold text-white">
                  Selected move: Thunderbolt
                </div>
                <p className="mt-2 text-sm leading-relaxed text-white/55">
                  High-confidence neutral hit with KO pressure while preserving safer lines than Focus Blast into a resist pivot.
                </p>
                <div className="mt-4 flex flex-wrap gap-2">
                  {["Model", "Turn 7", "Latency 842ms"].map((badge) => (
                    <span
                      key={badge}
                      className="rounded-full border border-white/10 bg-white/[0.02] px-2.5 py-1 text-xs text-white/60"
                    >
                      {badge}
                    </span>
                  ))}
                </div>
              </div>
              <div
                className="rounded-xl border border-white/10 bg-gradient-to-b to-black p-4"
                style={{
                  backgroundImage:
                    "linear-gradient(to bottom, rgba(0,21,255,0.10), rgba(0,0,0,1))",
                }}
              >
                <div className="text-xs" style={{ color: "rgba(173, 186, 255, 0.95)" }}>
                  Turn Flow
                </div>
                <div className="mt-3 space-y-2">
                  {[
                    "You selected Shadow Ball",
                    "CPU chooses a response",
                    "Turn resolves sequentially",
                    "Logs + HP update from backend state",
                  ].map((step, i) => (
                    <div
                      key={step}
                      className="flex items-center gap-2 rounded-lg border border-white/10 bg-black/45 px-3 py-2 text-xs text-white/70"
                    >
                      <span
                        className="flex h-5 w-5 items-center justify-center rounded-full border text-[10px]"
                        style={{
                          borderColor: "rgba(0,21,255,0.3)",
                          backgroundColor: "rgba(0,21,255,0.08)",
                          color: "rgba(173, 186, 255, 0.95)",
                        }}
                      >
                        {i + 1}
                      </span>
                      <span>{step}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Interactive Battle */}
        {mode === "interactive" && <InteractiveBattle />}

        {/* Demo Mode */}
        {mode === "demo" && (
          <>
            {/* Pokemon Cards */}
            <div className="grid md:grid-cols-2 gap-6 mb-8">
              {/* Gengar Card */}
              {gengarData && (
                <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 backdrop-blur">
                  <div className="flex items-center gap-4 mb-4">
                    <div className="relative">
                      <img
                        src={`https://play.pokemonshowdown.com/sprites/gen5ani/${gengarData.name.toLowerCase()}.gif`}
                        alt={gengarData.name}
                        className="w-24 h-24 object-contain"
                        onError={(e) => {
                          e.currentTarget.src = `https://play.pokemonshowdown.com/sprites/gen5/${gengarData.name.toLowerCase()}.png`;
                        }}
                      />
                    </div>
                    <div>
                      <h2 className="text-2xl font-semibold text-white">
                        {gengarData.name}
                      </h2>
                      <div className="flex gap-2 mt-2">
                        {gengarData.types.map((type) => (
                          <span
                            key={type}
                            className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-xs font-medium text-white/75"
                          >
                            {type}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-3 mt-4">
                    <div className="rounded-xl border border-white/10 bg-black/40 p-3 text-center">
                      <div className="text-xs text-white/45">HP</div>
                      <div className="text-xl font-semibold text-white">
                        {gengarData.baseStats.hp}
                      </div>
                    </div>
                    <div className="rounded-xl border border-white/10 bg-black/40 p-3 text-center">
                      <div className="text-xs text-white/45">SpA</div>
                      <div className="text-xl font-semibold text-white">
                        {gengarData.baseStats.spa}
                      </div>
                    </div>
                    <div className="rounded-xl border border-white/10 bg-black/40 p-3 text-center">
                      <div className="text-xs text-white/45">Spe</div>
                      <div className="text-xl font-semibold text-white">
                        {gengarData.baseStats.spe}
                      </div>
                    </div>
                  </div>
                  <div className="mt-4 text-sm text-white/55">
                    Tier: {gengarData.tier} • Weight: {gengarData.weightkg}kg
                  </div>
                </div>
              )}

              {/* Charizard Card */}
              {charizardData && (
                <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 backdrop-blur">
                  <div className="flex items-center gap-4 mb-4">
                    <div className="relative">
                      <img
                        src={`https://play.pokemonshowdown.com/sprites/gen5ani/${charizardData.name.toLowerCase()}.gif`}
                        alt={charizardData.name}
                        className="w-24 h-24 object-contain"
                        onError={(e) => {
                          e.currentTarget.src = `https://play.pokemonshowdown.com/sprites/gen5/${charizardData.name.toLowerCase()}.png`;
                        }}
                      />
                    </div>
                    <div>
                      <h2 className="text-2xl font-semibold text-white">
                        {charizardData.name}
                      </h2>
                      <div className="flex gap-2 mt-2">
                        {charizardData.types.map((type) => (
                          <span
                            key={type}
                            className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-xs font-medium text-white/75"
                          >
                            {type}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-3 mt-4">
                    <div className="rounded-xl border border-white/10 bg-black/40 p-3 text-center">
                      <div className="text-xs text-white/45">HP</div>
                      <div className="text-xl font-semibold text-white">
                        {charizardData.baseStats.hp}
                      </div>
                    </div>
                    <div className="rounded-xl border border-white/10 bg-black/40 p-3 text-center">
                      <div className="text-xs text-white/45">SpA</div>
                      <div className="text-xl font-semibold text-white">
                        {charizardData.baseStats.spa}
                      </div>
                    </div>
                    <div className="rounded-xl border border-white/10 bg-black/40 p-3 text-center">
                      <div className="text-xs text-white/45">Spe</div>
                      <div className="text-xl font-semibold text-white">
                        {charizardData.baseStats.spe}
                      </div>
                    </div>
                  </div>
                  <div className="mt-4 text-sm text-white/55">
                    Tier: {charizardData.tier} • Weight:{" "}
                    {charizardData.weightkg}kg
                  </div>
                </div>
              )}
            </div>

            {/* Battle Simulation */}
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 backdrop-blur">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-semibold text-white">
                  Battle Simulation
                </h2>
                <button
                  onClick={() => refetchBattle()}
                  disabled={battleLoading}
                  className="rounded-lg border border-white/15 bg-white px-4 py-2 text-sm font-medium text-black transition-colors hover:bg-white/90 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {battleLoading ? "Battling..." : "New Battle"}
                </button>
              </div>

              {battleError && (
                <div className="mb-4 rounded-lg border border-white/10 bg-white/[0.03] p-4 text-sm text-white/70">
                  Error loading battle: {(battleError as Error).message}
                </div>
              )}

              {battleLoading && (
                <div className="text-center py-12">
                  <div className="mb-4 inline-block animate-spin text-4xl text-white/80">
                    ⚔️
                  </div>
                  <div className="text-lg text-white/70">
                    Battle in progress...
                  </div>
                </div>
              )}

              {battleData && (
                <>
                  {/* Battle Result */}
                  <div className="mb-6 rounded-xl border border-white/10 bg-black/40 p-6">
                    <div className="text-center">
                      <div className="mb-2 text-xs font-medium tracking-[0.2em] text-white/40">
                        BATTLE RESULT
                      </div>
                      <div className="mb-2 text-3xl font-semibold text-white">
                        {battleData.winner} Wins!
                      </div>
                      <div className="text-sm text-white/55">
                        Battle completed in {battleData.turns} turn
                        {battleData.turns !== 1 ? "s" : ""}
                      </div>
                    </div>
                  </div>

                  {/* Battle Log */}
                  <div>
                    <h3 className="mb-4 text-sm font-medium tracking-wide text-white/70">
                      Battle Log
                    </h3>
                    <div className="rounded-xl border border-white/10 bg-black/50 p-6 font-mono text-sm">
                      <pre className="whitespace-pre-wrap leading-relaxed text-white/80">
                        {battleData.formattedLog}
                      </pre>
                    </div>
                  </div>
                </>
              )}
            </div>

          </>
        )}

        <div className="mt-8 text-center text-xs text-white/35">
          Powered by Pokemon Showdown • NestJS API running on port 5200
        </div>
      </div>
    </div>
  );
}
