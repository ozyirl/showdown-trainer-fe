"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState, useTransition } from "react";

const API_URL = "http://localhost:5200/api";
const CPU_RESPONSE_DELAY_MS = 700;
const ACTION_ANIMATION_DELAY_MS = 650;

const sleep = (ms: number) =>
  new Promise((resolve) => setTimeout(resolve, ms));

type MoveAcceptedAction = {
  player: string;
  moveIndex: number;
  moveName: string;
  acceptedAt: string;
};

interface BattleState {
  battleId: string;
  p1Pokemon: {
    name: string;
    hp: number;
    maxHp: number;
    status: string | null;
  };
  p2Pokemon: {
    name: string;
    hp: number;
    maxHp: number;
    status: string | null;
  };
  availableMoves: {
    name: string;
    type: string;
    power: number | null;
    pp: number;
    maxPp: number;
  }[];
  turnLog: Array<
    | string
    | {
        player: string;
        moveIndex: number;
        moveName: string;
        acceptedAt: string;
      }
  >;
  isEnded: boolean;
  winner: string | null;
  currentTurn: number;
  waitingForMove: boolean;
  phase?: string;
  lastAction?:
    | string
    | MoveAcceptedAction
    | null;
}

export function InteractiveBattle() {
  const [battleId, setBattleId] = useState<string | null>(null);
  const [gameLog, setGameLog] = useState<string[]>([]);
  const [isTurnLocked, setIsTurnLocked] = useState(false);
  const [pendingMoveName, setPendingMoveName] = useState<string | null>(null);
  const [turnUiPhase, setTurnUiPhase] = useState<"idle" | "selected" | "cpu">(
    "idle"
  );
  const [displayHp, setDisplayHp] = useState<{ p1: number; p2: number } | null>(
    null
  );
  const [isTransitioning, startTransition] = useTransition();
  const turnStartHpRef = useRef<{ p1: number; p2: number } | null>(null);
  const processedTurnLogCountRef = useRef(0);

  const shouldSubmitCpuMove = (
    stateAfterP1: BattleState | undefined,
    turnBeforeSubmit: number | undefined
  ) => {
    if (!stateAfterP1 || stateAfterP1.isEnded) return false;

    if (
      typeof turnBeforeSubmit === "number" &&
      stateAfterP1.currentTurn > turnBeforeSubmit
    ) {
      return false;
    }

    if (
      stateAfterP1.lastAction &&
      typeof stateAfterP1.lastAction === "object" &&
      stateAfterP1.lastAction.player === "p2"
    ) {
      return false;
    }

    if (stateAfterP1.phase) {
      const phase = stateAfterP1.phase.toLowerCase();
      if (
        phase.includes("resolved") ||
        phase.includes("complete") ||
        phase.includes("result")
      ) {
        return false;
      }
    }

    return true;
  };

  const getMoveOrder = (
    stateBeforeTurn: BattleState | undefined,
    turnEntries: BattleState["turnLog"]
  ): Array<"p1" | "p2"> => {
    const p1Name = stateBeforeTurn?.p1Pokemon.name?.toLowerCase();
    const p2Name = stateBeforeTurn?.p2Pokemon.name?.toLowerCase();

    const orderedPlayers: Array<"p1" | "p2"> = [];

    for (const entry of turnEntries) {
      if (typeof entry !== "string") continue;
      const lower = entry.toLowerCase();
      if (!lower.includes(" used ")) continue;

      if (p1Name && lower.includes(p1Name) && !orderedPlayers.includes("p1")) {
        orderedPlayers.push("p1");
      } else if (
        p2Name &&
        lower.includes(p2Name) &&
        !orderedPlayers.includes("p2")
      ) {
        orderedPlayers.push("p2");
      }

      if (orderedPlayers.length === 2) break;
    }

    if (orderedPlayers.length === 2) return orderedPlayers;
    if (orderedPlayers.length === 1) {
      return orderedPlayers[0] === "p1" ? ["p1", "p2"] : ["p2", "p1"];
    }

    return ["p1", "p2"];
  };

  const animateTurnHp = async (
    stateBeforeTurn: BattleState | undefined,
    resolvedState: BattleState,
    turnEntries: BattleState["turnLog"]
  ) => {
    const startHp = turnStartHpRef.current ?? {
      p1: stateBeforeTurn?.p1Pokemon.hp ?? resolvedState.p1Pokemon.hp,
      p2: stateBeforeTurn?.p2Pokemon.hp ?? resolvedState.p2Pokemon.hp,
    };
    const finalHp = {
      p1: resolvedState.p1Pokemon.hp,
      p2: resolvedState.p2Pokemon.hp,
    };

    setDisplayHp(startHp);

    const order = getMoveOrder(stateBeforeTurn, turnEntries);
    let currentHp = { ...startHp };
    let didAnimate = false;

    for (const attacker of order) {
      const defender = attacker === "p1" ? "p2" : "p1";
      if (currentHp[defender] === finalHp[defender]) continue;

      didAnimate = true;
      currentHp = { ...currentHp, [defender]: finalHp[defender] };
      setDisplayHp(currentHp);
      await sleep(ACTION_ANIMATION_DELAY_MS);
    }

    if (!didAnimate && (currentHp.p1 !== finalHp.p1 || currentHp.p2 !== finalHp.p2)) {
      setDisplayHp(finalHp);
      await sleep(Math.floor(ACTION_ANIMATION_DELAY_MS / 2));
    } else {
      setDisplayHp(finalHp);
    }
  };

  const getNewTurnLogEntries = (turnLog: BattleState["turnLog"]) => {
    const processedCount = processedTurnLogCountRef.current;

    if (processedCount <= 0) return turnLog;
    if (turnLog.length < processedCount) return turnLog;

    return turnLog.slice(processedCount);
  };

  // Start new battle
  const startBattle = useMutation({
    mutationFn: async () => {
      const response = await fetch(`${API_URL}/battle/start`, {
        method: "POST",
      });
      if (!response.ok) throw new Error("Failed to start battle");
      return response.json() as Promise<BattleState>;
    },
    onSuccess: (data) => {
      setBattleId(data.battleId);
      setGameLog(["Battle started!", ""]);
      processedTurnLogCountRef.current = 0;
      setDisplayHp({
        p1: data.p1Pokemon.hp,
        p2: data.p2Pokemon.hp,
      });
    },
  });

  // Get battle state
  const { data: battleState, refetch: refetchState } = useQuery<BattleState>({
    queryKey: ["battle-state", battleId],
    queryFn: async () => {
      if (!battleId) throw new Error("No battle ID");
      const response = await fetch(`${API_URL}/battle/${battleId}/state`);
      if (!response.ok) throw new Error("Failed to fetch battle state");
      return response.json();
    },
    enabled: !!battleId,
    refetchInterval: (query) => {
      return query.state.data?.isEnded ? false : 2000;
    },
  });

  // Submit move
  const submitMove = useMutation({
    mutationFn: async ({
      moveIndex,
    }: {
      moveIndex: number;
      moveName: string;
    }) => {
      if (!battleId) throw new Error("No battle ID");
      const turnBeforeSubmit = battleState?.currentTurn;

      const p1Response = await fetch(`${API_URL}/battle/${battleId}/move`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ player: "p1", moveIndex }),
      });
      if (!p1Response.ok) throw new Error("Failed to submit p1 move");

      setTurnUiPhase("cpu");
      const stateAfterP1Result = await refetchState();
      const stateAfterP1 = stateAfterP1Result.data;
      await sleep(CPU_RESPONSE_DELAY_MS);

      const latestBeforeCpuResult = await refetchState();
      const latestBeforeCpu = latestBeforeCpuResult.data ?? stateAfterP1;

      if (!shouldSubmitCpuMove(latestBeforeCpu, turnBeforeSubmit)) {
        if (latestBeforeCpu) return latestBeforeCpu;
        const latest = await refetchState();
        if (latest.data) return latest.data;
        throw new Error("Failed to fetch updated battle state");
      }

      const randomMove = Math.floor(Math.random() * 4) + 1;
      const p2Response = await fetch(`${API_URL}/battle/${battleId}/move`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ player: "p2", moveIndex: randomMove }),
      });
      if (!p2Response.ok) {
        if (p2Response.status === 400) {
          const latest = await refetchState();
          if (latest.data) return latest.data;
          if (latestBeforeCpu) return latestBeforeCpu;
          if (stateAfterP1) return stateAfterP1;
        }
        throw new Error("Failed to submit p2 move");
      }

      return p2Response.json() as Promise<BattleState>;
    },
    onMutate: ({ moveName }) => {
      setIsTurnLocked(true);
      setPendingMoveName(moveName);
      setTurnUiPhase("selected");
      turnStartHpRef.current = battleState
        ? {
            p1: battleState.p1Pokemon.hp,
            p2: battleState.p2Pokemon.hp,
          }
        : null;
    },
    onSuccess: async (data) => {
      try {
        const newTurnEntries = getNewTurnLogEntries(data.turnLog);
        await animateTurnHp(battleState, data, newTurnEntries);
        if (newTurnEntries.length > 0) {
          const normalizedLog = newTurnEntries.map(formatTurnLogEntry);
          startTransition(() => {
            setGameLog((prev) => [...prev, ...normalizedLog, ""]);
          });
        }
        processedTurnLogCountRef.current = data.turnLog.length;
        await refetchState();
      } finally {
        startTransition(() => {
          setIsTurnLocked(false);
          setPendingMoveName(null);
          setTurnUiPhase("idle");
        });
        turnStartHpRef.current = null;
      }
    },
    onError: () => {
      setIsTurnLocked(false);
      setPendingMoveName(null);
      setTurnUiPhase("idle");
      turnStartHpRef.current = null;
    },
  });

  const getHPPercentage = (hp: number, maxHp: number) => {
    return Math.max(0, (hp / maxHp) * 100);
  };

  const getHPColor = (percentage: number) => {
    if (percentage > 50) return "bg-green-500";
    if (percentage > 25) return "bg-yellow-500";
    return "bg-red-500";
  };

  const getTypeColor = (type: string) => {
    const colors: Record<string, string> = {
      Fire: "bg-orange-500",
      Water: "bg-blue-500",
      Grass: "bg-green-500",
      Electric: "bg-yellow-400",
      Psychic: "bg-pink-500",
      Ghost: "bg-purple-600",
      Poison: "bg-purple-500",
      Dragon: "bg-indigo-600",
      Dark: "bg-gray-800",
      Flying: "bg-blue-300",
      Normal: "bg-gray-400",
    };
    return colors[type] || "bg-gray-500";
  };

  const formatTurnLogEntry = (
    entry: BattleState["turnLog"][number]
  ): string => {
    if (typeof entry === "string") return entry;
    const playerLabel = entry.player === "p1" ? "You" : "Opponent";
    return `${playerLabel} used ${entry.moveName} (move ${entry.moveIndex}).`;
  };

  const isMoveLocked = submitMove.isPending || isTurnLocked || isTransitioning;

  useEffect(() => {
    if (!battleState || isMoveLocked) return;
    setDisplayHp({
      p1: battleState.p1Pokemon.hp,
      p2: battleState.p2Pokemon.hp,
    });
  }, [battleState, isMoveLocked]);

  if (!battleId) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <h2 className="text-3xl font-bold text-white mb-6">
          Interactive Battle
        </h2>
        <button
          onClick={() => startBattle.mutate()}
          disabled={startBattle.isPending}
          className="px-8 py-4 bg-gradient-to-r from-green-500 to-blue-500 hover:from-green-600 hover:to-blue-600 text-white font-bold rounded-xl text-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg"
        >
          {startBattle.isPending ? "⚔️ Starting..." : "🎮 Start Battle!"}
        </button>
      </div>
    );
  }

  if (!battleState) {
    return (
      <div className="text-center py-12">
        <div className="inline-block animate-spin text-6xl mb-4">⚔️</div>
        <div className="text-white text-xl">Loading battle...</div>
      </div>
    );
  }

  const formatLastAction = (lastAction: BattleState["lastAction"]) => {
    if (!lastAction) return null;
    if (typeof lastAction === "string") return lastAction;
    return formatTurnLogEntry(lastAction);
  };
  const canSubmitPlayerMove =
    !isMoveLocked &&
    battleState.waitingForMove &&
    !battleState.isEnded;
  const turnStatusText =
    turnUiPhase === "selected" && pendingMoveName
      ? `${pendingMoveName} selected...`
      : turnUiPhase === "cpu"
      ? "Opponent is responding..."
      : formatLastAction(battleState.lastAction);

  return (
    <div className="space-y-6">
      {/* Battle Result */}
      {battleState.isEnded && (
        <div className="bg-gradient-to-r from-yellow-500/20 to-orange-500/20 border border-yellow-500/50 rounded-xl p-6">
          <div className="text-center">
            <div className="text-4xl font-bold text-white mb-2">
              {battleState.winner} Wins!
            </div>
            <button
              onClick={() => {
                setBattleId(null);
                setGameLog([]);
                processedTurnLogCountRef.current = 0;
                startBattle.mutate();
              }}
              className="mt-4 px-6 py-3 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white font-bold rounded-lg transition-all"
            >
              🔄 New Battle
            </button>
          </div>
        </div>
      )}

      {/* Pokemon Display */}
      <div className="grid md:grid-cols-2 gap-6">
        {/* Player 1 Pokemon */}
        <div className="bg-white/10 backdrop-blur-lg rounded-xl p-6 border border-white/20">
          <div className="text-center mb-4">
            <div className="text-lg font-semibold text-purple-300">
              Your Pokemon
            </div>
          </div>
          <div className="flex flex-col items-center gap-4">
            <img
              src={`https://play.pokemonshowdown.com/sprites/gen5ani/${battleState.p1Pokemon.name.toLowerCase()}.gif`}
              alt={battleState.p1Pokemon.name}
              className="w-32 h-32 object-contain"
              onError={(e) => {
                e.currentTarget.src = `https://play.pokemonshowdown.com/sprites/gen5/${battleState.p1Pokemon.name.toLowerCase()}.png`;
              }}
            />
            <div className="text-2xl font-bold text-white">
              {battleState.p1Pokemon.name}
            </div>
            {/* HP Bar */}
            <div className="w-full">
              <div className="flex justify-between text-sm text-white mb-1">
                <span>HP</span>
                <span>
                  {displayHp?.p1 ?? battleState.p1Pokemon.hp}/
                  {battleState.p1Pokemon.maxHp}
                </span>
              </div>
              <div className="w-full bg-gray-700 rounded-full h-4">
                <div
                  className={`h-4 rounded-full transition-all duration-500 ${getHPColor(
                    getHPPercentage(
                      displayHp?.p1 ?? battleState.p1Pokemon.hp,
                      battleState.p1Pokemon.maxHp
                    )
                  )}`}
                  style={{
                    width: `${getHPPercentage(
                      displayHp?.p1 ?? battleState.p1Pokemon.hp,
                      battleState.p1Pokemon.maxHp
                    )}%`,
                  }}
                ></div>
              </div>
            </div>
          </div>
        </div>

        {/* Player 2 Pokemon */}
        <div className="bg-white/10 backdrop-blur-lg rounded-xl p-6 border border-white/20">
          <div className="text-center mb-4">
            <div className="text-lg font-semibold text-orange-300">
              Opponent Pokemon
            </div>
          </div>
          <div className="flex flex-col items-center gap-4">
            <img
              src={`https://play.pokemonshowdown.com/sprites/gen5ani/${battleState.p2Pokemon.name.toLowerCase()}.gif`}
              alt={battleState.p2Pokemon.name}
              className="w-32 h-32 object-contain"
              onError={(e) => {
                e.currentTarget.src = `https://play.pokemonshowdown.com/sprites/gen5/${battleState.p2Pokemon.name.toLowerCase()}.png`;
              }}
            />
            <div className="text-2xl font-bold text-white">
              {battleState.p2Pokemon.name}
            </div>
            {/* HP Bar */}
            <div className="w-full">
              <div className="flex justify-between text-sm text-white mb-1">
                <span>HP</span>
                <span>
                  {displayHp?.p2 ?? battleState.p2Pokemon.hp}/
                  {battleState.p2Pokemon.maxHp}
                </span>
              </div>
              <div className="w-full bg-gray-700 rounded-full h-4">
                <div
                  className={`h-4 rounded-full transition-all duration-500 ${getHPColor(
                    getHPPercentage(
                      displayHp?.p2 ?? battleState.p2Pokemon.hp,
                      battleState.p2Pokemon.maxHp
                    )
                  )}`}
                  style={{
                    width: `${getHPPercentage(
                      displayHp?.p2 ?? battleState.p2Pokemon.hp,
                      battleState.p2Pokemon.maxHp
                    )}%`,
                  }}
                ></div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Move Selection */}
      {!battleState.isEnded && (
        <div className="bg-white/10 backdrop-blur-lg rounded-xl p-6 border border-white/20">
          <h3 className="text-xl font-bold text-white mb-4">
            🎯 Choose Your Move
          </h3>
          <div className="grid grid-cols-2 gap-4">
            {battleState.availableMoves.map((move, index) => (
              <button
                key={index}
                onClick={() =>
                  submitMove.mutate({ moveIndex: index + 1, moveName: move.name })
                }
                disabled={!canSubmitPlayerMove}
                className={`${getTypeColor(
                  move.type
                )} hover:opacity-80 text-white font-bold py-4 px-6 rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg`}
              >
                <div className="text-left">
                  <div className="text-lg">{move.name}</div>
                  <div className="text-sm opacity-80">
                    Type: {move.type}{" "}
                    {move.power ? `• Power: ${move.power}` : ""}
                  </div>
                  <div className="text-xs opacity-70">
                    PP: {move.pp}/{move.maxPp}
                  </div>
                </div>
              </button>
            ))}
          </div>
          {turnStatusText && (
            <div className="text-center mt-4 text-yellow-300 animate-pulse">
              ⚔️ {turnStatusText}
            </div>
          )}
        </div>
      )}

      {/* Battle Log */}
      <div className="bg-white/10 backdrop-blur-lg rounded-xl p-6 border border-white/20">
        <h3 className="text-xl font-bold text-white mb-4">📜 Battle Log</h3>
        <div className="bg-black/40 rounded-lg p-4 max-h-64 overflow-y-auto">
          <div className="font-mono text-sm text-green-300 space-y-1">
            {gameLog.map((line, index) => (
              <div key={index}>{line || "\u00A0"}</div>
            ))}
          </div>
        </div>
      </div>

      {/* Turn Counter */}
      <div className="text-center text-purple-300">
        Turn: {battleState.currentTurn}
      </div>
    </div>
  );
}
