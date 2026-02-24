"use client";

import { useQuery } from "@tanstack/react-query";
import { InteractiveBattle } from "./interactive-battle";
import { useState } from "react";

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

export default function Home() {
  const [mode, setMode] = useState<"demo" | "interactive">("interactive");
  const tabClass = (active: boolean) =>
    `rounded-full px-4 py-2 text-sm font-medium transition-colors border ${
      active
        ? "border-white/20 bg-white text-black"
        : "border-white/10 bg-white/[0.03] text-white/70 hover:bg-white/[0.06] hover:text-white"
    }`;

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
    <div className="min-h-screen bg-black text-white">
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8 rounded-2xl border border-white/10 bg-black/70 p-6 backdrop-blur">
          <div className="mb-6 flex items-center justify-between">
            <div className="text-sm font-medium tracking-tight text-white/90">
              Showdown Trainer
            </div>
            <div className="hidden text-xs text-white/40 sm:block">
              Local API · :5200
            </div>
          </div>
          <h1 className="mb-2 text-3xl font-semibold tracking-tight text-white sm:text-5xl">
            Pokemon Showdown Trainer
          </h1>
          <p className="text-sm text-white/60 sm:text-base">
            Battle simulator and interactive turn runner for Gen 9 OU
          </p>

          {/* Mode Toggle */}
          <div className="mt-6 flex flex-wrap gap-2">
            <button
              onClick={() => setMode("interactive")}
              className={tabClass(mode === "interactive")}
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

            {/* Footer */}
            <div className="mt-8 text-center text-xs text-white/40">
              Powered by Pokemon Showdown • NestJS API running on port 5200
            </div>
          </>
        )}
      </div>
    </div>
  );
}
