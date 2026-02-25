"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

const API_URL = "http://localhost:5200/api";
const SEARCH_DEBOUNCE_MS = 300;
const ACTION_DELAY_MS = 450;

type MoveAcceptedAction = {
  player: "p1" | "p2";
  moveIndex: number;
  moveName: string;
  acceptedAt?: string;
};

type BattlePokemonState = {
  name: string;
  hp: number;
  maxHp: number;
  hpPercent?: number | null;
  status: string | null;
};

type BattleMove = {
  name: string;
  type: string;
  power: number | null;
  pp: number;
  maxPp: number;
};

type BattleState = {
  battleId: string;
  p1Pokemon: BattlePokemonState;
  p2Pokemon: BattlePokemonState;
  availableMoves: BattleMove[];
  turnLog: Array<string | MoveAcceptedAction>;
  isEnded: boolean;
  winner: string | null;
  currentTurn: number;
  waitingForMove: boolean;
  phase?: "awaiting-moves" | "resolving" | "ended" | string;
  pendingPlayers?: Array<"p1" | "p2"> | string[];
  lastTurnEvents?: unknown[];
  lastCpuDecision?: {
    turn?: number;
    modelId?: string;
    latencyMs?: number;
    source?: "model" | "fallback" | string;
    moveName?: string;
    reasoning?: string;
    rawResponse?: unknown;
    error?: string;
  } | null;
  lastAction?: string | MoveAcceptedAction | null;
};

type PokemonSearchItem = {
  name: string;
  types: string[];
  tier?: string | null;
};

type PokemonDetails = {
  name: string;
  types: string[];
  tier?: string | null;
  baseStats?: Record<string, number>;
};

type MoveOption = {
  name: string;
  type?: string | null;
  basePower?: number | null;
  category?: string | null;
};

type PokemonMovesResponse = {
  moves: MoveOption[];
  recommendedMoves: string[];
};

type SideKey = "p1" | "p2";

type SideSetup = {
  query: string;
  selectedPokemon: PokemonSearchItem | null;
  selectedMoves: string[];
  autoMoves: boolean;
};

type BattleSetupState = {
  p1: SideSetup;
  p2: SideSetup;
  level: number;
  formatid: string;
};

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const panelClass =
  "rounded-2xl border border-white/10 bg-white/[0.03] p-6 backdrop-blur";

type InteractiveBattleProps = {
  initialBattleId?: string | null;
};

function useDebouncedValue<T>(value: T, delayMs: number) {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timeout = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timeout);
  }, [value, delayMs]);

  return debounced;
}

function normalizePokemonList(payload: unknown): PokemonSearchItem[] {
  const rawList = Array.isArray(payload)
    ? payload
    : Array.isArray((payload as { results?: unknown[] })?.results)
      ? (payload as { results: unknown[] }).results
      : Array.isArray((payload as { pokemon?: unknown[] })?.pokemon)
        ? (payload as { pokemon: unknown[] }).pokemon
        : [];

  const normalized: PokemonSearchItem[] = [];
  for (const item of rawList) {
    const data = item as Record<string, unknown>;
    const rawTypes = Array.isArray(data.types) ? data.types : [];
    const types = rawTypes.map((t) => String(t)).filter(Boolean);
    const name = String(data.name ?? "").trim();
    if (!name) continue;

    normalized.push({
      name,
      types,
      tier: data.tier ? String(data.tier) : null,
    });
  }
  return normalized;
}

function normalizePokemonDetails(payload: unknown): PokemonDetails | null {
  if (!payload || typeof payload !== "object") return null;
  const data = payload as Record<string, unknown>;
  const name = String(data.name ?? "").trim();
  if (!name) return null;

  return {
    name,
    types: Array.isArray(data.types)
      ? data.types.map((type) => String(type)).filter(Boolean)
      : [],
    tier: data.tier ? String(data.tier) : null,
    baseStats:
      data.baseStats && typeof data.baseStats === "object"
        ? (data.baseStats as Record<string, number>)
        : undefined,
  };
}

function normalizeMovePayload(payload: unknown): PokemonMovesResponse {
  const rawList = Array.isArray(payload)
    ? payload
    : Array.isArray((payload as { moves?: unknown[] })?.moves)
      ? (payload as { moves: unknown[] }).moves
      : Array.isArray((payload as { data?: unknown[] })?.data)
        ? (payload as { data: unknown[] }).data
        : [];
  const rawRecommended = Array.isArray(
    (payload as { recommendedMoves?: unknown[] })?.recommendedMoves,
  )
    ? (payload as { recommendedMoves: unknown[] }).recommendedMoves
    : [];

  const normalized: MoveOption[] = [];
  const recommendedMoves: string[] = [];
  const seen = new Set<string>();

  for (const item of rawRecommended) {
    const name = String(item ?? "").trim();
    if (!name || recommendedMoves.includes(name)) continue;
    recommendedMoves.push(name);
    if (recommendedMoves.length >= 4) break;
  }

  for (const item of rawList) {
    if (typeof item === "string") {
      const name = item.trim();
      if (!name || seen.has(name)) continue;
      seen.add(name);
      normalized.push({ name });
      continue;
    }
    const data = item as Record<string, unknown>;
    const name = String(data.name ?? data.id ?? "").trim();
    if (!name || seen.has(name)) continue;
    seen.add(name);
    normalized.push({
      name,
      type: data.type ? String(data.type) : null,
      basePower:
        typeof data.basePower === "number"
          ? data.basePower
          : typeof data.power === "number"
            ? data.power
            : null,
      category: data.category ? String(data.category) : null,
    });
  }

  if (recommendedMoves.length === 0) {
    for (const move of normalized.slice(0, 4)) recommendedMoves.push(move.name);
  }

  return { moves: normalized, recommendedMoves };
}

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url);
  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(body || `Request failed (${response.status})`);
  }
  return response.json() as Promise<T>;
}

async function fetchBattleState(battleId: string): Promise<BattleState> {
  return fetchJson<BattleState>(`${API_URL}/battle/${battleId}/state`);
}

async function postBattleMove(params: {
  battleId: string;
  player: "p1" | "p2";
  moveIndex: number;
}) {
  const response = await fetch(`${API_URL}/battle/${params.battleId}/move`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      player: params.player,
      moveIndex: params.moveIndex,
    }),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    const error = new Error(body || `Move submit failed (${response.status})`);
    (error as Error & { status?: number }).status = response.status;
    throw error;
  }

  return response.json() as Promise<BattleState>;
}

function formatTurnLogEntry(entry: BattleState["turnLog"][number]) {
  if (typeof entry === "string") return entry;
  const actor = entry.player === "p1" ? "You" : "Opponent";
  return `${actor} selected ${entry.moveName} (#${entry.moveIndex}).`;
}

function normalizeHpLogLine(line: string) {
  const match = line.match(/^(.+?) HP:\s*(\d+)\/(\d+)$/);
  if (!match) return null;

  const [, pokemon, currentRaw, maxRaw] = match;
  const current = Number(currentRaw);
  const max = Number(maxRaw);
  if (!Number.isFinite(current) || !Number.isFinite(max) || max <= 0)
    return line;

  const pct = Math.round((current / max) * 100);
  return `${pokemon} HP: ${Math.max(0, Math.min(100, pct))}/100`;
}

function buildDisplayLog(
  turnLog: BattleState["turnLog"],
  localActions: string[],
) {
  const merged = [...localActions, ...turnLog.map(formatTurnLogEntry)];
  const out: string[] = [];

  for (const line of merged) {
    const normalizedHp = normalizeHpLogLine(line);
    const next = normalizedHp ?? line;

    if (normalizedHp) {
      const name = normalizedHp.split(" HP:")[0];
      const last = out[out.length - 1];
      if (last && normalizeHpLogLine(last)?.startsWith(`${name} HP:`)) {
        out[out.length - 1] = next;
        continue;
      }
    }

    if (out[out.length - 1] === next) continue;
    out.push(next);
  }

  return out;
}

function diffTurnLogEntries(
  previous: BattleState["turnLog"] | undefined,
  next: BattleState["turnLog"],
) {
  const prevLen = previous?.length ?? 0;
  if (next.length >= prevLen) return next.slice(prevLen);
  return next;
}

function battleProgressSignature(state: BattleState | null | undefined) {
  if (!state) return null;
  return {
    currentTurn: state.currentTurn,
    turnLogLength: state.turnLog.length,
    lastTurnEventsLength: Array.isArray(state.lastTurnEvents)
      ? state.lastTurnEvents.length
      : 0,
    phase: state.phase ?? null,
  };
}

function stateHasAdvanced(
  before: BattleState | null | undefined,
  after: BattleState | null | undefined,
) {
  const b = battleProgressSignature(before);
  const a = battleProgressSignature(after);
  if (!b || !a) return false;
  return (
    a.currentTurn !== b.currentTurn ||
    a.turnLogLength > b.turnLogLength ||
    a.lastTurnEventsLength > b.lastTurnEventsLength ||
    (b.phase === "resolving" && a.phase !== "resolving")
  );
}

function hpPercentFromStatePokemon(pokemon: BattlePokemonState) {
  if (
    typeof pokemon.hpPercent === "number" &&
    Number.isFinite(pokemon.hpPercent)
  ) {
    return Math.max(0, Math.min(100, Math.round(pokemon.hpPercent)));
  }
  return hpPercent(pokemon.hp, pokemon.maxHp);
}

function parseCpuDecisionRawResponse(
  raw?: string,
): { moveIndex?: number; moveName?: string; reasoning?: string } | null {
  if (!raw || typeof raw !== "string") return null;
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    return {
      moveIndex:
        typeof parsed.moveIndex === "number"
          ? parsed.moveIndex
          : typeof parsed.choiceIndex === "number"
            ? parsed.choiceIndex
            : undefined,
      moveName:
        typeof parsed.moveName === "string"
          ? parsed.moveName
          : typeof parsed.move === "string"
            ? parsed.move
            : typeof parsed.choice === "string"
              ? parsed.choice
              : undefined,
      reasoning:
        typeof parsed.reasoning === "string"
          ? parsed.reasoning
          : typeof parsed.explanation === "string"
            ? parsed.explanation
            : typeof parsed.reason === "string"
              ? parsed.reason
              : undefined,
    };
  } catch {
    return null;
  }
}

function normalizeLastTurnEventsToLines(state: BattleState): string[] {
  const events = Array.isArray(state.lastTurnEvents)
    ? state.lastTurnEvents
    : [];
  const lines: string[] = [];

  for (const event of events) {
    if (typeof event === "string") {
      if (event.trim()) lines.push(event.trim());
      continue;
    }
    if (!event || typeof event !== "object") continue;
    const data = event as Record<string, unknown>;

    const textFields = ["display", "message", "text", "summary", "logLine"];
    let pushed = false;
    for (const key of textFields) {
      const value = data[key];
      if (typeof value === "string" && value.trim()) {
        lines.push(value.trim());
        pushed = true;
        break;
      }
    }
    if (pushed) continue;

    const actor =
      typeof data.actor === "string"
        ? data.actor
        : typeof data.player === "string"
          ? data.player
          : null;
    const moveName =
      typeof data.moveName === "string"
        ? data.moveName
        : typeof data.move === "string"
          ? data.move
          : null;
    const type =
      typeof data.type === "string"
        ? data.type.toLowerCase()
        : typeof data.kind === "string"
          ? data.kind.toLowerCase()
          : "";

    if (
      moveName &&
      (type.includes("move") || type.includes("use") || type === "")
    ) {
      const actorLabel =
        actor === "p1"
          ? state.p1Pokemon.name
          : actor === "p2"
            ? state.p2Pokemon.name
            : actor;
      if (actorLabel) {
        lines.push(`${actorLabel} used ${moveName}!`);
        continue;
      }
      lines.push(`Move used: ${moveName}`);
      continue;
    }

    if (typeof data.reason === "string" && data.reason.trim()) {
      lines.push(data.reason.trim());
    }
  }

  return buildDisplayLog(lines, []).filter(isNarrationLineRelevant);
}

function extractCpuReasoningText(decision: BattleState["lastCpuDecision"]) {
  if (!decision) return null;
  if (typeof decision.reasoning === "string" && decision.reasoning.trim()) {
    return decision.reasoning.trim();
  }

  const raw = decision.rawResponse;
  if (typeof raw === "string") {
    const parsed = parseCpuDecisionRawResponse(raw);
    if (parsed?.reasoning) return parsed.reasoning;
    return raw.trim() || null;
  }
  if (raw && typeof raw === "object") {
    const data = raw as Record<string, unknown>;
    const candidates = [
      data.reasoning,
      data.explanation,
      data.reason,
      data.summary,
      (data.message as Record<string, unknown> | undefined)?.content,
    ];
    for (const candidate of candidates) {
      if (typeof candidate === "string" && candidate.trim()) {
        return candidate.trim();
      }
    }
    try {
      return JSON.stringify(raw);
    } catch {
      return null;
    }
  }
  return null;
}

function isNarrationLineRelevant(line: string) {
  const lower = line.toLowerCase();
  if (normalizeHpLogLine(line)) return false;
  if (lower.includes(" pp")) return false;
  return true;
}

function getMoveActorFromLine(
  line: string,
  stateBefore: BattleState,
): "p1" | "p2" | null {
  const lower = line.toLowerCase();
  if (!lower.includes(" used ")) return null;
  if (lower.includes(stateBefore.p1Pokemon.name.toLowerCase())) return "p1";
  if (lower.includes(stateBefore.p2Pokemon.name.toLowerCase())) return "p2";
  if (lower.startsWith("you ")) return "p1";
  if (lower.startsWith("opponent ")) return "p2";
  return null;
}

function formatLastAction(lastAction: BattleState["lastAction"]) {
  if (!lastAction) return null;
  if (typeof lastAction === "string") return lastAction;
  return formatTurnLogEntry(lastAction);
}

function canPlayerAct(state: BattleState | null, isSubmitting: boolean) {
  if (!state || isSubmitting || state.isEnded || state.phase === "ended") {
    return false;
  }
  if (state.phase && state.phase !== "awaiting-moves") return false;
  if (Array.isArray(state.pendingPlayers)) {
    return state.pendingPlayers.includes("p1");
  }
  return state.waitingForMove === true;
}

function sideNeedsMove(state: BattleState | null, player: "p1" | "p2") {
  if (!state || state.isEnded || state.phase === "ended") return false;
  if (Array.isArray(state.pendingPlayers))
    return state.pendingPlayers.includes(player);
  if (player === "p1") return state.waitingForMove;
  return false;
}

function deriveStatusText(params: {
  state: BattleState | null;
  pendingMoveName: string | null;
  isSubmitting: boolean;
  errorMessage: string | null;
}) {
  const { state, pendingMoveName, isSubmitting, errorMessage } = params;

  if (errorMessage) return `Error: ${errorMessage}`;
  if (!state) return "Loading battle state...";
  if (state.isEnded || state.phase === "ended") {
    return state.winner ? `${state.winner} wins.` : "Battle ended.";
  }
  if (isSubmitting && pendingMoveName) {
    return `CPU is choosing a move... (${pendingMoveName} selected)`;
  }
  if (isSubmitting) return "CPU is choosing a move...";
  if (state.phase === "resolving") return "Resolving turn...";
  if (
    state.phase &&
    state.phase !== "awaiting-moves" &&
    !sideNeedsMove(state, "p1")
  ) {
    return "Waiting for forced action / recharge resolution...";
  }
  if (sideNeedsMove(state, "p2")) return "Waiting for opponent...";
  if (sideNeedsMove(state, "p1")) return "Choose your move.";
  return formatLastAction(state.lastAction) ?? "Battle in progress...";
}

function getHpBarClass(percentage: number) {
  if (percentage > 50) return "bg-white/80";
  if (percentage > 25) return "bg-white/55";
  return "bg-white/35";
}

function hpPercent(hp: number, maxHp: number) {
  if (maxHp <= 0) return 0;
  return Math.max(0, Math.min(100, (hp / maxHp) * 100));
}

function typeChipText(types: string[]) {
  return types.length ? types.join(" / ") : "Unknown type";
}

function MoveSelector(params: {
  title: string;
  moveOptions: MoveOption[];
  recommendedMoves: string[];
  isLoading: boolean;
  selectedMoves: string[];
  autoMoves: boolean;
  onToggleMove: (moveName: string) => void;
  onClearMoves: () => void;
  onSetAutoMoves: (value: boolean) => void;
}) {
  const {
    title,
    moveOptions,
    recommendedMoves,
    isLoading,
    selectedMoves,
    autoMoves,
    onToggleMove,
    onClearMoves,
    onSetAutoMoves,
  } = params;

  return (
    <div className="space-y-3 rounded-xl border border-white/10 bg-black/30 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="text-sm font-medium text-white/80">{title}</div>
          <div className="text-xs text-white/45">
            Select up to 4 moves or use auto-pick
          </div>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => onSetAutoMoves(true)}
            className={`rounded-md border px-2.5 py-1 text-xs transition-colors ${
              autoMoves
                ? "border-white/20 bg-white text-black"
                : "border-white/10 bg-white/[0.03] text-white/70 hover:bg-white/[0.06]"
            }`}
          >
            Auto-select moves
          </button>
          <button
            type="button"
            onClick={onClearMoves}
            className="rounded-md border border-white/10 bg-white/[0.03] px-2.5 py-1 text-xs text-white/70 transition-colors hover:bg-white/[0.06]"
          >
            Clear
          </button>
        </div>
      </div>

      {!autoMoves && (
        <div className="rounded-lg border border-white/10 bg-black/40 p-2 text-xs text-white/60">
          Selected ({selectedMoves.length}/4):{" "}
          {selectedMoves.length ? selectedMoves.join(", ") : "none"}
        </div>
      )}

      {isLoading && (
        <div className="text-sm text-white/55">Loading move list...</div>
      )}

      {!isLoading && !autoMoves && moveOptions.length > 0 && (
        <div className="max-h-56 space-y-1 overflow-y-auto rounded-lg border border-white/10 bg-black/40 p-2">
          {moveOptions.map((move) => {
            const selected = selectedMoves.includes(move.name);
            const disabled = !selected && selectedMoves.length >= 4;
            return (
              <button
                key={move.name}
                type="button"
                onClick={() => onToggleMove(move.name)}
                disabled={disabled}
                className={`flex w-full items-center justify-between rounded-md border px-3 py-2 text-left text-sm transition-colors ${
                  selected
                    ? "border-white/20 bg-white/10 text-white"
                    : "border-white/5 bg-transparent text-white/75 hover:border-white/15 hover:bg-white/[0.03]"
                } disabled:cursor-not-allowed disabled:opacity-40`}
              >
                <div className="min-w-0">
                  <div>{move.name}</div>
                  <div className="text-xs text-white/40">
                    {move.type ?? "Unknown"}
                    {typeof move.basePower === "number"
                      ? ` • BP ${move.basePower}`
                      : ""}
                    {move.category ? ` • ${move.category}` : ""}
                  </div>
                </div>
                <span className="text-xs text-white/45">
                  {selected
                    ? "Selected"
                    : recommendedMoves.includes(move.name)
                      ? "Recommended"
                      : "Add"}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {!isLoading && !autoMoves && moveOptions.length === 0 && (
        <div className="text-sm text-white/55">
          No moves found for this Pokémon.
        </div>
      )}
    </div>
  );
}

function PokemonSetupPanel(params: {
  side: SideKey;
  label: string;
  setup: SideSetup;
  onQueryChange: (value: string) => void;
  onSelectPokemon: (pokemon: PokemonSearchItem) => void;
  onClearPokemon: () => void;
  onToggleMove: (moveName: string) => void;
  onClearMoves: () => void;
  onSetAutoMoves: (value: boolean) => void;
  searchResults: PokemonSearchItem[];
  searchLoading: boolean;
  searchError: string | null;
  details: PokemonDetails | null;
  moves: MoveOption[];
  recommendedMoves: string[];
  movesLoading: boolean;
}) {
  const {
    label,
    setup,
    onQueryChange,
    onSelectPokemon,
    onClearPokemon,
    onToggleMove,
    onClearMoves,
    onSetAutoMoves,
    searchResults,
    searchLoading,
    searchError,
    details,
    moves,
    recommendedMoves,
    movesLoading,
  } = params;

  return (
    <div className={`${panelClass} space-y-4`}>
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-semibold text-white">{label}</h3>
          <p className="text-xs text-white/45">
            Search a Pokémon and optionally pick moves
          </p>
        </div>
        {setup.selectedPokemon && (
          <button
            type="button"
            onClick={onClearPokemon}
            className="rounded-md border border-white/10 bg-white/[0.03] px-2.5 py-1 text-xs text-white/70 hover:bg-white/[0.06]"
          >
            Clear Pokémon
          </button>
        )}
      </div>

      <div className="space-y-2">
        <label className="text-xs font-medium text-white/55">
          Pokémon search
        </label>
        <input
          value={setup.query}
          onChange={(e) => onQueryChange(e.target.value)}
          placeholder="Search Pokémon (e.g. Garchomp, Rotom)"
          className="w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-white outline-none placeholder:text-white/30 focus:border-white/20"
        />
      </div>

      {!!setup.query.trim() && (
        <div className="space-y-2">
          {searchLoading && (
            <div className="text-xs text-white/50">Searching...</div>
          )}
          {searchError && (
            <div className="text-xs text-white/50">{searchError}</div>
          )}
          {!searchLoading && !searchError && searchResults.length > 0 && (
            <div className="max-h-52 space-y-1 overflow-y-auto rounded-lg border border-white/10 bg-black/40 p-2">
              {searchResults.map((pokemon) => (
                <button
                  key={pokemon.name}
                  type="button"
                  onClick={() => onSelectPokemon(pokemon)}
                  className="w-full rounded-md border border-white/5 px-3 py-2 text-left transition-colors hover:border-white/15 hover:bg-white/[0.03]"
                >
                  <div className="text-sm font-medium text-white">
                    {pokemon.name}
                  </div>
                  <div className="text-xs text-white/45">
                    {typeChipText(pokemon.types)}
                    {pokemon.tier ? ` • ${pokemon.tier}` : ""}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {setup.selectedPokemon && (
        <div className="space-y-4">
          <div className="rounded-xl border border-white/10 bg-black/40 p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-sm font-medium text-white">
                  {setup.selectedPokemon.name}
                </div>
                <div className="text-xs text-white/45">
                  {typeChipText((details ?? setup.selectedPokemon).types)}
                  {(details?.tier ?? setup.selectedPokemon.tier)
                    ? ` • ${details?.tier ?? setup.selectedPokemon.tier}`
                    : ""}
                </div>
              </div>
              <div className="text-xs text-white/40">
                {setup.autoMoves
                  ? "Moves: auto"
                  : `Moves: ${setup.selectedMoves.length}/4`}
              </div>
            </div>
          </div>

          <MoveSelector
            title={`${setup.selectedPokemon.name} Moves`}
            moveOptions={moves}
            recommendedMoves={recommendedMoves}
            isLoading={movesLoading}
            selectedMoves={setup.selectedMoves}
            autoMoves={setup.autoMoves}
            onToggleMove={onToggleMove}
            onClearMoves={onClearMoves}
            onSetAutoMoves={onSetAutoMoves}
          />
        </div>
      )}
    </div>
  );
}

function BattleArena(params: {
  battleState: BattleState;
  visualHpPercents: { p1: number; p2: number } | null;
  displayedLogLines: string[];
  isTurnAnimating: boolean;
  isSubmittingMove: boolean;
  statusText: string;
  moveSubmitPending: boolean;
  moveSubmitError: string | null;
  onSubmitMove: (moveIndexOneBased: number, moveName: string) => void;
  onLeaveBattle: () => void;
}) {
  const {
    battleState,
    visualHpPercents,
    displayedLogLines,
    isTurnAnimating,
    isSubmittingMove,
    statusText,
    moveSubmitPending,
    moveSubmitError,
    onSubmitMove,
    onLeaveBattle,
  } = params;

  const playerCanAct =
    canPlayerAct(battleState, moveSubmitPending || isSubmittingMove) &&
    !isTurnAnimating;
  const currentHpPercents = {
    p1:
      isTurnAnimating && visualHpPercents
        ? visualHpPercents.p1
        : hpPercentFromStatePokemon(battleState.p1Pokemon),
    p2:
      isTurnAnimating && visualHpPercents
        ? visualHpPercents.p2
        : hpPercentFromStatePokemon(battleState.p2Pokemon),
  };
  const cpuReasoning = extractCpuReasoningText(battleState.lastCpuDecision);
  const parsedCpuRaw =
    typeof battleState.lastCpuDecision?.rawResponse === "string"
      ? parseCpuDecisionRawResponse(battleState.lastCpuDecision.rawResponse)
      : null;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/[0.03] px-5 py-4 backdrop-blur">
        <div>
          <div className="text-xs tracking-wide text-white/45">BATTLE</div>
          <div className="text-sm text-white/80">
            Turn {battleState.currentTurn} • {battleState.phase ?? "active"}
          </div>
        </div>
        <button
          type="button"
          onClick={onLeaveBattle}
          className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-white/75 hover:bg-white/[0.06]"
        >
          Back to Setup
        </button>
      </div>

      {battleState.isEnded && (
        <div className={`${panelClass} text-center`}>
          <div className="text-xs tracking-[0.18em] text-white/40">RESULT</div>
          <div className="mt-2 text-3xl font-semibold tracking-tight text-white">
            {battleState.winner ?? "Battle"} Wins
          </div>
          <div className="mt-2 text-sm text-white/55">Battle complete.</div>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        {[
          {
            key: "p1" as const,
            label: "Your Pokémon",
            p: battleState.p1Pokemon,
          },
          {
            key: "p2" as const,
            label: "Opponent",
            p: battleState.p2Pokemon,
          },
        ].map(({ key, label, p }) => (
          <div key={label} className={panelClass}>
            <div className="mb-4 text-sm font-medium text-white/60">
              {label}
            </div>
            <div className="flex flex-col items-center gap-4">
              <img
                src={`https://play.pokemonshowdown.com/sprites/gen5ani/${p.name.toLowerCase()}.gif`}
                alt={p.name}
                className="h-32 w-32 object-contain"
                onError={(e) => {
                  e.currentTarget.src = `https://play.pokemonshowdown.com/sprites/gen5/${p.name.toLowerCase()}.png`;
                }}
              />
              <div className="text-2xl font-semibold tracking-tight text-white">
                {p.name}
              </div>
              <div className="w-full space-y-1">
                <div className="flex justify-between text-xs text-white/60">
                  <span>HP</span>
                  <span>{currentHpPercents[key]}%</span>
                </div>
                <div className="h-3 w-full rounded-full bg-white/10">
                  <div
                    className={`h-3 rounded-full transition-all duration-500 ${getHpBarClass(
                      currentHpPercents[key],
                    )}`}
                    style={{
                      width: `${currentHpPercents[key]}%`,
                    }}
                  />
                </div>
                {p.status && (
                  <div className="text-xs uppercase tracking-wide text-white/45">
                    Status: {p.status}
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}

        <div className={panelClass}>
          <div className="mb-4 text-sm font-medium text-white/70">
            CPU Analysis
          </div>
          {battleState.lastCpuDecision ? (
            <div className="space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-2 text-xs text-white/55">
                <div>
                  Turn:{" "}
                  {battleState.lastCpuDecision.turn ?? battleState.currentTurn}
                </div>
                <div>
                  Source: {battleState.lastCpuDecision.source ?? "unknown"}
                </div>
                <div className="col-span-2 truncate">
                  Model: {battleState.lastCpuDecision.modelId ?? "n/a"}
                </div>
                <div>
                  Latency:{" "}
                  {typeof battleState.lastCpuDecision.latencyMs === "number"
                    ? `${battleState.lastCpuDecision.latencyMs}ms`
                    : "n/a"}
                </div>
                <div>
                  {battleState.lastCpuDecision.error ? "Warning" : "Status"}:{" "}
                  {battleState.lastCpuDecision.error ? "fallback/error" : "ok"}
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <span className="rounded-full border border-white/10 bg-white/[0.03] px-2 py-0.5 text-[11px] text-white/65">
                  {battleState.lastCpuDecision.source === "fallback"
                    ? "Fallback"
                    : "Model"}
                </span>
                {typeof battleState.lastCpuDecision.latencyMs === "number" &&
                  battleState.lastCpuDecision.latencyMs > 2000 && (
                    <span className="rounded-full border border-white/10 bg-white/[0.03] px-2 py-0.5 text-[11px] text-white/65">
                      Slow
                    </span>
                  )}
              </div>
              <div className="rounded-lg border border-white/10 bg-black/40 p-3">
                <div className="text-xs text-white/45">Selected move</div>
                <div className="mt-1 font-medium text-white">
                  {battleState.lastCpuDecision.moveName ??
                    parsedCpuRaw?.moveName ??
                    "Unknown"}
                </div>
              </div>
              {cpuReasoning && (
                <div className="rounded-lg border border-white/10 bg-black/40 p-3">
                  <div className="mb-1 text-xs text-white/45">Reasoning</div>
                  <div className="line-clamp-6 whitespace-pre-wrap text-xs leading-relaxed text-white/70">
                    {cpuReasoning}
                  </div>
                </div>
              )}
              {(battleState.lastCpuDecision.source === "fallback" ||
                battleState.lastCpuDecision.error) && (
                <div className="rounded-md border border-white/10 bg-white/[0.02] px-2.5 py-2 text-xs text-white/60">
                  CPU used fallback logic
                  {battleState.lastCpuDecision.error
                    ? `: ${battleState.lastCpuDecision.error}`
                    : "."}
                </div>
              )}
            </div>
          ) : (
            <div className="text-sm text-white/50">
              No CPU decision data yet.
            </div>
          )}
        </div>
      </div>

      {!battleState.isEnded && (
        <div className={panelClass}>
          <div className="mb-4 flex items-center justify-between gap-3">
            <h3 className="text-sm font-medium tracking-wide text-white/70">
              Choose Your Move
            </h3>
            <div className="text-xs text-white/45">
              {playerCanAct ? "Your turn" : "Move input locked"}
            </div>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {battleState.availableMoves.map((move, index) => (
              <button
                key={`${move.name}-${index}`}
                type="button"
                onClick={() => onSubmitMove(index + 1, move.name)}
                disabled={!playerCanAct}
                className="rounded-xl border border-white/10 bg-white/[0.02] px-4 py-3 text-left transition-colors hover:border-white/20 hover:bg-white/[0.04] disabled:cursor-not-allowed disabled:opacity-40"
              >
                <div className="text-sm font-medium tracking-tight text-white">
                  {move.name}
                </div>
                <div className="mt-1 text-xs text-white/55">
                  {move.type}
                  {move.power ? ` • Power ${move.power}` : ""}
                </div>
                <div className="mt-1 text-xs text-white/40">
                  PP {move.pp}/{move.maxPp}
                </div>
              </button>
            ))}
          </div>
          <div className="mt-4 rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-white/70">
            {statusText}
          </div>
          {moveSubmitError && (
            <div className="mt-3 rounded-lg border border-white/10 bg-white/[0.02] px-3 py-2 text-sm text-white/65">
              {moveSubmitError}
            </div>
          )}
        </div>
      )}

      <div className={panelClass}>
        <h3 className="mb-4 text-sm font-medium tracking-wide text-white/70">
          Battle Log
        </h3>
        <div className="max-h-72 overflow-y-auto rounded-xl border border-white/10 bg-black/50 p-4">
          <div className="space-y-1 font-mono text-sm text-white/80">
            <div>Battle started!</div>
            {displayedLogLines.map((line, index) => (
              <div key={`${index}-${line}`}>{line}</div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export function InteractiveBattle({
  initialBattleId = null,
}: InteractiveBattleProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [setup, setSetup] = useState<BattleSetupState>({
    p1: {
      query: "",
      selectedPokemon: null,
      selectedMoves: [],
      autoMoves: true,
    },
    p2: {
      query: "",
      selectedPokemon: null,
      selectedMoves: [],
      autoMoves: true,
    },
    level: 100,
    formatid: "gen9ou",
  });
  const [battleId, setBattleId] = useState<string | null>(initialBattleId);
  const [battleStateSnapshot, setBattleStateSnapshot] =
    useState<BattleState | null>(null);
  const [moveUiError, setMoveUiError] = useState<string | null>(null);
  const [pendingMoveName, setPendingMoveName] = useState<string | null>(null);
  const [displayedLogLines, setDisplayedLogLines] = useState<string[]>([]);
  const [visualHpPercents, setVisualHpPercents] = useState<{
    p1: number;
    p2: number;
  } | null>(null);
  const [isTurnAnimating, setIsTurnAnimating] = useState(false);
  const [animatedStatusText, setAnimatedStatusText] = useState<string | null>(
    null,
  );
  const [isSubmittingMove, setIsSubmittingMove] = useState(false);
  const isSubmittingMoveRef = useRef(false);

  const p1SearchDebounced = useDebouncedValue(
    setup.p1.query.trim(),
    SEARCH_DEBOUNCE_MS,
  );
  const p2SearchDebounced = useDebouncedValue(
    setup.p2.query.trim(),
    SEARCH_DEBOUNCE_MS,
  );

  const p1SearchQuery = useQuery({
    queryKey: ["pokemon-search", "p1", p1SearchDebounced],
    queryFn: async () => {
      const payload = await fetchJson<unknown>(
        `${API_URL}/battle/pokemon?q=${encodeURIComponent(p1SearchDebounced)}&limit=8`,
      );
      return normalizePokemonList(payload);
    },
    enabled: p1SearchDebounced.length >= 2,
    refetchOnWindowFocus: false,
  });

  const p2SearchQuery = useQuery({
    queryKey: ["pokemon-search", "p2", p2SearchDebounced],
    queryFn: async () => {
      const payload = await fetchJson<unknown>(
        `${API_URL}/battle/pokemon?q=${encodeURIComponent(p2SearchDebounced)}&limit=8`,
      );
      return normalizePokemonList(payload);
    },
    enabled: p2SearchDebounced.length >= 2,
    refetchOnWindowFocus: false,
  });

  const p1DetailsQuery = useQuery({
    queryKey: ["pokemon-details", setup.p1.selectedPokemon?.name],
    queryFn: async () => {
      const payload = await fetchJson<unknown>(
        `${API_URL}/battle/pokemon/${encodeURIComponent(setup.p1.selectedPokemon!.name)}`,
      );
      return normalizePokemonDetails(payload);
    },
    enabled: !!setup.p1.selectedPokemon?.name,
    refetchOnWindowFocus: false,
  });

  const p2DetailsQuery = useQuery({
    queryKey: ["pokemon-details", setup.p2.selectedPokemon?.name],
    queryFn: async () => {
      const payload = await fetchJson<unknown>(
        `${API_URL}/battle/pokemon/${encodeURIComponent(setup.p2.selectedPokemon!.name)}`,
      );
      return normalizePokemonDetails(payload);
    },
    enabled: !!setup.p2.selectedPokemon?.name,
    refetchOnWindowFocus: false,
  });

  const p1MovesQuery = useQuery({
    queryKey: ["pokemon-moves", setup.p1.selectedPokemon?.name],
    queryFn: async () => {
      const payload = await fetchJson<unknown>(
        `${API_URL}/battle/pokemon/${encodeURIComponent(
          setup.p1.selectedPokemon!.name,
        )}/moves?limit=120`,
      );
      return normalizeMovePayload(payload);
    },
    enabled: !!setup.p1.selectedPokemon?.name,
    refetchOnWindowFocus: false,
  });

  const p2MovesQuery = useQuery({
    queryKey: ["pokemon-moves", setup.p2.selectedPokemon?.name],
    queryFn: async () => {
      const payload = await fetchJson<unknown>(
        `${API_URL}/battle/pokemon/${encodeURIComponent(
          setup.p2.selectedPokemon!.name,
        )}/moves?limit=120`,
      );
      return normalizeMovePayload(payload);
    },
    enabled: !!setup.p2.selectedPokemon?.name,
    refetchOnWindowFocus: false,
  });

  const stateQuery = useQuery({
    queryKey: ["battle-state", battleId],
    queryFn: async () => {
      if (!battleId) throw new Error("No battle ID");
      return fetchBattleState(battleId);
    },
    enabled: !!battleId,
    refetchOnWindowFocus: false,
    refetchInterval: (query) => {
      const state = query.state.data as BattleState | undefined;
      if (!battleId) return false;
      if (!state) return 1200;
      if (state.isEnded || state.phase === "ended") return false;
      if (state.phase === "resolving") return 700;
      if (sideNeedsMove(state, "p2")) return 900;
      return 1200;
    },
  });

  const liveBattleState = stateQuery.data ?? battleStateSnapshot;
  const p1RecommendedMoves = p1MovesQuery.data?.recommendedMoves ?? [];
  const p2RecommendedMoves = p2MovesQuery.data?.recommendedMoves ?? [];

  const p1ResolvedSelectedMoves =
    setup.p1.autoMoves && setup.p1.selectedMoves.length === 0
      ? p1RecommendedMoves.slice(0, 4)
      : setup.p1.selectedMoves;
  const p2ResolvedSelectedMoves =
    setup.p2.autoMoves && setup.p2.selectedMoves.length === 0
      ? p2RecommendedMoves.slice(0, 4)
      : setup.p2.selectedMoves;

  const p1ResolvedAutoMoves =
    setup.p1.autoMoves && p1ResolvedSelectedMoves.length === 0;
  const p2ResolvedAutoMoves =
    setup.p2.autoMoves && p2ResolvedSelectedMoves.length === 0;

  const startBattleMutation = useMutation({
    mutationFn: async () => {
      const body = {
        p1Pokemon: setup.p1.selectedPokemon?.name,
        p2Pokemon: setup.p2.selectedPokemon?.name,
        p1Moves: p1ResolvedAutoMoves ? undefined : p1ResolvedSelectedMoves,
        p2Moves: p2ResolvedAutoMoves ? undefined : p2ResolvedSelectedMoves,
        level: setup.level,
        formatid: setup.formatid,
      };

      const response = await fetch(`${API_URL}/battle/start`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const text = await response.text().catch(() => "");
        throw new Error(text || "Failed to start battle");
      }

      return response.json() as Promise<BattleState>;
    },
    onSuccess: (state) => {
      setBattleId(state.battleId);
      if (pathname !== `/battle/${state.battleId}`) {
        router.push(`/battle/${state.battleId}`);
      }
      setBattleStateSnapshot(state);
      setMoveUiError(null);
      setPendingMoveName(null);
      setDisplayedLogLines([]);
      setVisualHpPercents({
        p1: hpPercentFromStatePokemon(state.p1Pokemon),
        p2: hpPercentFromStatePokemon(state.p2Pokemon),
      });
      setIsTurnAnimating(false);
      setAnimatedStatusText(null);
      setIsSubmittingMove(false);
      isSubmittingMoveRef.current = false;
    },
  });

  const submitMoveMutation = useMutation({
    mutationFn: async ({
      moveIndexOneBased,
      moveName,
    }: {
      moveIndexOneBased: number;
      moveName: string;
    }) => {
      if (!battleId) throw new Error("No active battle");

      const stateBeforeTurn = liveBattleState ?? battleStateSnapshot;

      setMoveUiError(null);
      setPendingMoveName(moveName);
      setAnimatedStatusText(`Move selected: ${moveName}`);
      setIsSubmittingMove(true);
      isSubmittingMoveRef.current = true;

      try {
        const resolvedState = await postBattleMove({
          battleId,
          player: "p1",
          moveIndex: moveIndexOneBased,
        });
        return {
          resolvedState,
          stateBeforeTurn,
          recoveredFromConflict: false,
        };
      } catch (error) {
        const status = (error as Error & { status?: number }).status;
        if (status !== 400 && status !== 409) throw error;

        const recoveredState = await fetchBattleState(battleId);
        if (stateHasAdvanced(stateBeforeTurn, recoveredState)) {
          return {
            resolvedState: recoveredState,
            stateBeforeTurn,
            recoveredFromConflict: true,
          };
        }

        if (status === 409) {
          const err = new Error("Turn is already resolving...");
          (err as Error & { status?: number }).status = 409;
          throw err;
        }

        if (sideNeedsMove(recoveredState, "p1")) {
          const err = new Error(
            "That move is no longer legal this turn. Please choose again.",
          );
          (err as Error & { status?: number }).status = 400;
          throw err;
        }

        return {
          resolvedState: recoveredState,
          stateBeforeTurn,
          recoveredFromConflict: true,
        };
      }
    },
    onSuccess: async ({ resolvedState, stateBeforeTurn }) => {
      setBattleStateSnapshot(resolvedState);
      setPendingMoveName(null);
      setIsTurnAnimating(true);
      setAnimatedStatusText("Resolving turn...");

      const eventNarration = normalizeLastTurnEventsToLines(resolvedState);
      const prevTurnLog = stateBeforeTurn?.turnLog;
      const newEntries = diffTurnLogEntries(prevTurnLog, resolvedState.turnLog);
      const fallbackNarration = buildDisplayLog(newEntries, []).filter(
        isNarrationLineRelevant,
      );
      const cleanedNarration =
        eventNarration.length > 0 ? eventNarration : fallbackNarration;
      setDisplayedLogLines(buildDisplayLog(stateBeforeTurn?.turnLog ?? [], []));

      let nextP1 = stateBeforeTurn
        ? hpPercentFromStatePokemon(stateBeforeTurn.p1Pokemon)
        : hpPercentFromStatePokemon(resolvedState.p1Pokemon);
      let nextP2 = stateBeforeTurn
        ? hpPercentFromStatePokemon(stateBeforeTurn.p2Pokemon)
        : hpPercentFromStatePokemon(resolvedState.p2Pokemon);
      const finalP1 = hpPercentFromStatePokemon(resolvedState.p1Pokemon);
      const finalP2 = hpPercentFromStatePokemon(resolvedState.p2Pokemon);

      setVisualHpPercents({ p1: nextP1, p2: nextP2 });

      for (const line of cleanedNarration) {
        setDisplayedLogLines((prev) =>
          prev[prev.length - 1] === line ? prev : [...prev, line],
        );
        setAnimatedStatusText(line);

        const actor = stateBeforeTurn
          ? getMoveActorFromLine(line, stateBeforeTurn)
          : null;
        if (actor === "p1" && nextP2 !== finalP2) {
          await sleep(ACTION_DELAY_MS);
          nextP2 = finalP2;
          setVisualHpPercents({ p1: nextP1, p2: nextP2 });
        } else if (actor === "p2" && nextP1 !== finalP1) {
          await sleep(ACTION_DELAY_MS);
          nextP1 = finalP1;
          setVisualHpPercents({ p1: nextP1, p2: nextP2 });
        }

        await sleep(ACTION_DELAY_MS);
      }

      if (nextP1 !== finalP1 || nextP2 !== finalP2) {
        setVisualHpPercents({ p1: finalP1, p2: finalP2 });
      }

      setIsTurnAnimating(false);
      setAnimatedStatusText(null);
      setIsSubmittingMove(false);
      isSubmittingMoveRef.current = false;
    },
    onError: async (error) => {
      setPendingMoveName(null);
      setIsTurnAnimating(false);
      setAnimatedStatusText(null);
      setIsSubmittingMove(false);
      isSubmittingMoveRef.current = false;
      setMoveUiError((error as Error).message || "Failed to submit move");
      if (battleId) {
        try {
          const recovered = await fetchBattleState(battleId);
          setBattleStateSnapshot(recovered);
        } catch {
          // Keep UI recoverable even if refetch fails.
        }
      }
    },
  });

  const updateSide = (
    side: SideKey,
    updater: (prev: SideSetup) => SideSetup,
  ) => {
    setSetup((prev) => ({ ...prev, [side]: updater(prev[side]) }));
  };

  const handleSelectPokemon = (side: SideKey, pokemon: PokemonSearchItem) => {
    updateSide(side, (prev) => ({
      ...prev,
      selectedPokemon: pokemon,
      query: pokemon.name,
      selectedMoves: [],
      autoMoves: true,
    }));
  };

  const handleToggleMove = (side: SideKey, moveName: string) => {
    updateSide(side, (prev) => {
      const exists = prev.selectedMoves.includes(moveName);
      if (exists) {
        return {
          ...prev,
          autoMoves: false,
          selectedMoves: prev.selectedMoves.filter((m) => m !== moveName),
        };
      }
      if (prev.selectedMoves.length >= 4) return { ...prev, autoMoves: false };
      return {
        ...prev,
        autoMoves: false,
        selectedMoves: [...prev.selectedMoves, moveName],
      };
    });
  };

  const setupReady = !!setup.p1.selectedPokemon && !!setup.p2.selectedPokemon;

  const derivedStatusText = deriveStatusText({
    state: liveBattleState,
    pendingMoveName,
    isSubmitting:
      submitMoveMutation.isPending || isTurnAnimating || isSubmittingMove,
    errorMessage: moveUiError,
  });
  const statusText = animatedStatusText ?? derivedStatusText;
  const resolvedLogLines = liveBattleState
    ? buildDisplayLog(liveBattleState.turnLog, [])
    : [];
  const battleLogLines = isTurnAnimating ? displayedLogLines : resolvedLogLines;

  if (battleId && !liveBattleState) {
    return (
      <div className="space-y-6">
        <div className={panelClass}>
          <div className="text-sm font-medium text-white/70">Loading Battle</div>
          <div className="mt-2 text-sm text-white/55">
            Restoring battle state for <span className="font-mono">{battleId}</span>...
          </div>
          {stateQuery.error && (
            <div className="mt-4 rounded-lg border border-white/10 bg-white/[0.02] px-3 py-2 text-sm text-white/65">
              {(stateQuery.error as Error).message}
            </div>
          )}
          <div className="mt-4 flex gap-2">
            <button
              type="button"
              onClick={() => stateQuery.refetch()}
              className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-white/75 hover:bg-white/[0.06]"
            >
              Retry
            </button>
            <button
              type="button"
              onClick={() => router.push("/")}
              className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-white/75 hover:bg-white/[0.06]"
            >
              Back to Setup
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (battleId && liveBattleState) {
    return (
      <BattleArena
        battleState={liveBattleState}
        visualHpPercents={visualHpPercents}
        displayedLogLines={battleLogLines}
        isTurnAnimating={isTurnAnimating}
        isSubmittingMove={isSubmittingMove}
        statusText={statusText}
        moveSubmitPending={submitMoveMutation.isPending}
        moveSubmitError={moveUiError}
        onSubmitMove={(moveIndexOneBased, moveName) => {
          if (isSubmittingMoveRef.current) return;
          if (
            !canPlayerAct(
              liveBattleState,
              submitMoveMutation.isPending ||
                isTurnAnimating ||
                isSubmittingMove,
            )
          )
            return;
          submitMoveMutation.mutate({ moveIndexOneBased, moveName });
        }}
        onLeaveBattle={() => {
          setBattleId(null);
          setBattleStateSnapshot(null);
          setPendingMoveName(null);
          setMoveUiError(null);
          setDisplayedLogLines([]);
          setVisualHpPercents(null);
          setIsTurnAnimating(false);
          setAnimatedStatusText(null);
          setIsSubmittingMove(false);
          isSubmittingMoveRef.current = false;
          if (pathname !== "/") router.push("/");
        }}
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-2">
        <PokemonSetupPanel
          side="p1"
          label="Player Pokémon (P1)"
          setup={setup.p1}
          onQueryChange={(value) =>
            updateSide("p1", (prev) => ({ ...prev, query: value }))
          }
          onSelectPokemon={(pokemon) => handleSelectPokemon("p1", pokemon)}
          onClearPokemon={() =>
            updateSide("p1", () => ({
              query: "",
              selectedPokemon: null,
              selectedMoves: [],
              autoMoves: true,
            }))
          }
          onToggleMove={(moveName) => handleToggleMove("p1", moveName)}
          onClearMoves={() =>
            updateSide("p1", (prev) => ({
              ...prev,
              selectedMoves: [],
              autoMoves: false,
            }))
          }
          onSetAutoMoves={(value) =>
            updateSide("p1", (prev) => ({ ...prev, autoMoves: value }))
          }
          searchResults={p1SearchQuery.data ?? []}
          searchLoading={p1SearchQuery.isFetching}
          searchError={
            p1SearchQuery.error ? (p1SearchQuery.error as Error).message : null
          }
          details={p1DetailsQuery.data ?? null}
          moves={p1MovesQuery.data?.moves ?? []}
          recommendedMoves={p1MovesQuery.data?.recommendedMoves ?? []}
          movesLoading={p1MovesQuery.isFetching}
        />

        <PokemonSetupPanel
          side="p2"
          label="CPU Pokémon (P2)"
          setup={setup.p2}
          onQueryChange={(value) =>
            updateSide("p2", (prev) => ({ ...prev, query: value }))
          }
          onSelectPokemon={(pokemon) => handleSelectPokemon("p2", pokemon)}
          onClearPokemon={() =>
            updateSide("p2", () => ({
              query: "",
              selectedPokemon: null,
              selectedMoves: [],
              autoMoves: true,
            }))
          }
          onToggleMove={(moveName) => handleToggleMove("p2", moveName)}
          onClearMoves={() =>
            updateSide("p2", (prev) => ({
              ...prev,
              selectedMoves: [],
              autoMoves: false,
            }))
          }
          onSetAutoMoves={(value) =>
            updateSide("p2", (prev) => ({ ...prev, autoMoves: value }))
          }
          searchResults={p2SearchQuery.data ?? []}
          searchLoading={p2SearchQuery.isFetching}
          searchError={
            p2SearchQuery.error ? (p2SearchQuery.error as Error).message : null
          }
          details={p2DetailsQuery.data ?? null}
          moves={p2MovesQuery.data?.moves ?? []}
          recommendedMoves={p2MovesQuery.data?.recommendedMoves ?? []}
          movesLoading={p2MovesQuery.isFetching}
        />
      </div>

      <div className={panelClass}>
        <div className="mb-4 text-sm font-medium tracking-wide text-white/70">
          Battle Summary
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          {[
            { label: "P1", data: setup.p1 },
            { label: "P2", data: setup.p2 },
          ].map(({ label, data }) => (
            <div
              key={label}
              className="rounded-xl border border-white/10 bg-black/40 p-4"
            >
              <div className="text-xs tracking-wide text-white/45">{label}</div>
              <div className="mt-1 text-sm font-medium text-white">
                {data.selectedPokemon?.name ?? "Not selected"}
              </div>
              {data.selectedPokemon && (
                <div className="mt-1 text-xs text-white/50">
                  {data.autoMoves
                    ? "Moves: auto-select"
                    : data.selectedMoves.length
                      ? `Moves: ${data.selectedMoves.join(", ")}`
                      : "Moves: none selected (backend may reject if auto is off)"}
                </div>
              )}
            </div>
          ))}
        </div>

        {startBattleMutation.error && (
          <div className="mt-4 rounded-lg border border-white/10 bg-white/[0.02] px-3 py-2 text-sm text-white/65">
            {(startBattleMutation.error as Error).message}
          </div>
        )}

        <div className="mt-5 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => startBattleMutation.mutate()}
            disabled={!setupReady || startBattleMutation.isPending}
            className="rounded-lg border border-white/15 bg-white px-4 py-2 text-sm font-medium text-black transition-colors hover:bg-white/90 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {startBattleMutation.isPending ? "Starting..." : "Start Battle"}
          </button>
          {!setupReady && (
            <div className="self-center text-xs text-white/45">
              Select Pokémon for both P1 and P2 to continue.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
