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
    <div className="min-h-screen bg-gradient-to-br from-indigo-900 via-purple-900 to-pink-900 p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-5xl font-bold text-white mb-2">
            Pokemon Showdown Trainer
          </h1>
          <p className="text-purple-200">Battle Simulator • Gen 9 OU Format</p>

          {/* Mode Toggle */}
          <div className="flex justify-center gap-4 mt-6">
            <button
              onClick={() => setMode("interactive")}
              className={`px-6 py-2 rounded-lg font-bold transition-all ${
                mode === "interactive"
                  ? "bg-blue-500 text-white"
                  : "bg-white/10 text-white/60 hover:bg-white/20"
              }`}
            >
              🎮 Interactive Battle
            </button>
            <button
              onClick={() => setMode("demo")}
              className={`px-6 py-2 rounded-lg font-bold transition-all ${
                mode === "demo"
                  ? "bg-blue-500 text-white"
                  : "bg-white/10 text-white/60 hover:bg-white/20"
              }`}
            >
              🤖 Auto Battle Demo
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
                <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-6 border border-white/20">
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
                      <h2 className="text-3xl font-bold text-white">
                        {gengarData.name}
                      </h2>
                      <div className="flex gap-2 mt-2">
                        {gengarData.types.map((type) => (
                          <span
                            key={type}
                            className="px-3 py-1 bg-purple-500/50 rounded-full text-white text-sm font-semibold"
                          >
                            {type}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-3 mt-4">
                    <div className="bg-black/20 rounded-lg p-3 text-center">
                      <div className="text-purple-300 text-xs">HP</div>
                      <div className="text-white font-bold text-xl">
                        {gengarData.baseStats.hp}
                      </div>
                    </div>
                    <div className="bg-black/20 rounded-lg p-3 text-center">
                      <div className="text-purple-300 text-xs">SpA</div>
                      <div className="text-white font-bold text-xl">
                        {gengarData.baseStats.spa}
                      </div>
                    </div>
                    <div className="bg-black/20 rounded-lg p-3 text-center">
                      <div className="text-purple-300 text-xs">Spe</div>
                      <div className="text-white font-bold text-xl">
                        {gengarData.baseStats.spe}
                      </div>
                    </div>
                  </div>
                  <div className="mt-4 text-purple-200 text-sm">
                    Tier: {gengarData.tier} • Weight: {gengarData.weightkg}kg
                  </div>
                </div>
              )}

              {/* Charizard Card */}
              {charizardData && (
                <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-6 border border-white/20">
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
                      <h2 className="text-3xl font-bold text-white">
                        {charizardData.name}
                      </h2>
                      <div className="flex gap-2 mt-2">
                        {charizardData.types.map((type) => (
                          <span
                            key={type}
                            className="px-3 py-1 bg-orange-500/50 rounded-full text-white text-sm font-semibold"
                          >
                            {type}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-3 mt-4">
                    <div className="bg-black/20 rounded-lg p-3 text-center">
                      <div className="text-orange-300 text-xs">HP</div>
                      <div className="text-white font-bold text-xl">
                        {charizardData.baseStats.hp}
                      </div>
                    </div>
                    <div className="bg-black/20 rounded-lg p-3 text-center">
                      <div className="text-orange-300 text-xs">SpA</div>
                      <div className="text-white font-bold text-xl">
                        {charizardData.baseStats.spa}
                      </div>
                    </div>
                    <div className="bg-black/20 rounded-lg p-3 text-center">
                      <div className="text-orange-300 text-xs">Spe</div>
                      <div className="text-white font-bold text-xl">
                        {charizardData.baseStats.spe}
                      </div>
                    </div>
                  </div>
                  <div className="mt-4 text-orange-200 text-sm">
                    Tier: {charizardData.tier} • Weight:{" "}
                    {charizardData.weightkg}kg
                  </div>
                </div>
              )}
            </div>

            {/* Battle Simulation */}
            <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-6 border border-white/20">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold text-white">
                  Battle Simulation
                </h2>
                <button
                  onClick={() => refetchBattle()}
                  disabled={battleLoading}
                  className="px-6 py-3 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white font-bold rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg"
                >
                  {battleLoading ? "⚔️ Battling..." : "🎮 New Battle"}
                </button>
              </div>

              {battleError && (
                <div className="bg-red-500/20 border border-red-500 text-red-200 p-4 rounded-lg mb-4">
                  Error loading battle: {(battleError as Error).message}
                </div>
              )}

              {battleLoading && (
                <div className="text-center py-12">
                  <div className="inline-block animate-spin text-6xl mb-4">
                    ⚔️
                  </div>
                  <div className="text-white text-xl">
                    Battle in progress...
                  </div>
                </div>
              )}

              {battleData && (
                <>
                  {/* Battle Result */}
                  <div className="bg-gradient-to-r from-yellow-500/20 to-orange-500/20 border border-yellow-500/50 rounded-xl p-6 mb-6">
                    <div className="text-center">
                      <div className="text-yellow-300 text-sm font-semibold mb-2">
                        BATTLE RESULT
                      </div>
                      <div className="text-4xl font-bold text-white mb-2">
                        {battleData.winner} Wins!
                      </div>
                      <div className="text-purple-200">
                        Battle completed in {battleData.turns} turn
                        {battleData.turns !== 1 ? "s" : ""}
                      </div>
                    </div>
                  </div>

                  {/* Battle Log */}
                  <div>
                    <h3 className="text-xl font-bold text-white mb-4">
                      📜 Battle Log
                    </h3>
                    <div className="bg-black/40 rounded-xl p-6 font-mono text-sm">
                      <pre className="text-green-300 whitespace-pre-wrap leading-relaxed">
                        {battleData.formattedLog}
                      </pre>
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Footer */}
            <div className="text-center mt-8 text-purple-300 text-sm">
              Powered by Pokemon Showdown • NestJS API running on port 5200
            </div>
          </>
        )}
      </div>
    </div>
  );
}
