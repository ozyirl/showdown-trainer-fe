"use client";

import { useAuth, useUser } from "@clerk/nextjs";
import { useMutation, useQuery } from "@tanstack/react-query";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { createTeambuilderApiClient } from "@/lib/teambuilder/api-client";
import type { Team } from "@/lib/teambuilder/types";

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
  slot?: number;
  ident?: string;
  isActive?: boolean;
  fainted?: boolean;
  name: string;
  level?: number;
  hp: number;
  maxHp: number;
  hpPercent?: number | null;
  status: string | null;
  boosts?: Record<string, number> | null;
  item?: string | null;
  ability?: string | null;
  types?: string[] | null;
};

type BattleMove = {
  choice?: string;
  index?: number;
  name: string;
  type: string;
  power: number | null;
  accuracy: number | true | null;
  category: string | null;
  pp: number;
  maxPp: number;
};

type BattleSwitchOption = {
  choice: string;
  slot: number;
  name: string;
  level?: number;
  hp: number;
  maxHp: number;
  hpPercent: number;
  status: string | null;
  fainted: boolean;
  isActive: boolean;
  item: string | null;
  ability: string | null;
};

type BattleSideState = {
  active: BattlePokemonState | null;
  bench: BattlePokemonState[];
  team: BattlePokemonState[];
  faintedCount: number;
};

type BattleState = {
  battleId: string;
  sides?: {
    p1?: BattleSideState;
    p2?: BattleSideState;
  };
  p1Pokemon: BattlePokemonState;
  p2Pokemon: BattlePokemonState;
  availableMoves: BattleMove[];
  availableSwitches?: BattleSwitchOption[];
  canSwitch?: boolean;
  turnLog: Array<string | MoveAcceptedAction>;
  isEnded: boolean;
  winner: string | null;
  currentTurn: number;
  waitingForMove: boolean;
  phase?:
    | "team-preview"
    | "awaiting-actions"
    | "awaiting-forced-switch-p1"
    | "awaiting-forced-switch-p2"
    | "awaiting-event-ack"
    | "resolving"
    | "ended"
    | string;
  eventCursor?: number | null;
  awaitingAckEventSeq?: number | null;
  recentPlaybackEvents?: unknown[];
  pendingPlayers?: Array<"p1" | "p2"> | string[];
  lastTurnEvents?: unknown[];
  lastCpuDecision?: {
    turn?: number;
    modelId?: string;
    latencyMs?: number;
    source?: "model" | "fallback" | string;
    choice?: string;
    actionType?: string;
    moveName?: string;
    reasoning?: string;
    rawResponse?: unknown;
    error?: string;
  } | null;
  lastAction?: string | MoveAcceptedAction | null;
};

type CpuStreamDecisionSummary = {
  turn: number;
  choice: string;
  actionType: string;
  source: string;
  modelId: string;
  latencyMs: number;
  reasoning?: string;
  rawResponse?: string;
  error?: string;
};

type CpuStreamState = {
  text: string;
  isStreaming: boolean;
  isAvailable: boolean;
  error: string | null;
  decision: CpuStreamDecisionSummary | null;
};

type ActionSubmitError = {
  message: string;
  status?: number;
  legalChoices?: string[];
  legalMoves?: string[];
  legalSwitches?: string[];
};

type CopilotAlternative = {
  action: string;
  label: string;
  reason: string;
};

type CopilotGuidance = {
  recommendedAction: string;
  recommendedLabel: string;
  confidence: "high" | "medium" | "low";
  reasoning: string;
  safeAlternative: CopilotAlternative | null;
  aggressiveAlternative: CopilotAlternative | null;
  mainRisk: string;
  winConditionNote: string;
  disabled?: true;
};

type PlaybackEvent = {
  seq: number;
  turn: number;
  type: string;
  text: string;
  description?: string | null;
  actor?: string | null;
  target?: string | null;
  hpPercent?: number | null;
  deltaPercent?: number | null;
  currentHp?: number | null;
  maxHp?: number | null;
  deltaHp?: number | null;
  sourceType?: string | null;
  sourceName?: string | null;
  payload: unknown;
  timestamp: number;
};

type TurnLogGroup = {
  turn: number;
  events: PlaybackEvent[];
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

type TeamSourceMode = "random" | "saved" | "manual";
type CopilotMode = "off" | "coach" | "deep";
type CpuModelProfile = "fast" | "reasoning";
type GenerationKey =
  | "gen1"
  | "gen2"
  | "gen3"
  | "gen4"
  | "gen5"
  | "gen6"
  | "gen7"
  | "gen8"
  | "gen9";

type BattleSetupState = {
  teamSource: TeamSourceMode;
  generation: GenerationKey;
  randomBattleType: string;
  standardBattleType: string;
  copilotMode: CopilotMode;
  cpuModelProfile: CpuModelProfile;
  p1SavedTeamId: string;
  p2SavedTeamId: string;
  randomSeedInput: string;
  p1: SideSetup;
  p2: SideSetup;
  level: number;
};

type ActiveBattleUiState = {
  copilotEnabled: boolean;
  copilotMode: CopilotMode;
  cpuModelProfile: CpuModelProfile;
};

const DEFAULT_ACTIVE_BATTLE_UI: ActiveBattleUiState = {
  copilotEnabled: false,
  copilotMode: "off",
  cpuModelProfile: "fast",
};

type FormatOption = {
  value: string;
  label: string;
  description: string;
};

const GENERATION_OPTIONS: Array<{ value: GenerationKey; label: string }> = [
  { value: "gen1", label: "Gen 1" },
  { value: "gen2", label: "Gen 2" },
  { value: "gen3", label: "Gen 3" },
  { value: "gen4", label: "Gen 4" },
  { value: "gen5", label: "Gen 5" },
  { value: "gen6", label: "Gen 6" },
  { value: "gen7", label: "Gen 7" },
  { value: "gen8", label: "Gen 8" },
  { value: "gen9", label: "Gen 9" },
];

const RANDOM_BATTLE_OPTIONS: FormatOption[] = [
  {
    value: "randombattle",
    label: "Random Battle",
    description: "Standard Showdown random teams.",
  },
  {
    value: "unratedrandombattle",
    label: "Unrated Random",
    description: "Random teams without a ranked ladder format.",
  },
  {
    value: "freeforallrandombattle",
    label: "Free-for-All Random",
    description: "Free-for-all rules with generated teams.",
  },
  {
    value: "randombattleblitz",
    label: "Random Battle Blitz",
    description: "Random teams with a faster battle clock.",
  },
];

const STANDARD_BATTLE_OPTIONS: FormatOption[] = [
  { value: "ou", label: "OU", description: "Standard overused singles." },
  { value: "ubers", label: "Ubers", description: "High-power restricted format." },
  { value: "uu", label: "UU", description: "Underused singles." },
  { value: "ru", label: "RU", description: "Rarely used singles." },
  { value: "nu", label: "NU", description: "Never used singles." },
  { value: "pu", label: "PU", description: "Lower-tier singles." },
  { value: "lc", label: "LC", description: "Little Cup." },
  { value: "monotype", label: "Monotype", description: "Single-type team constraint." },
  { value: "cap", label: "CAP", description: "Create-A-Pokemon ruleset." },
  {
    value: "customgame",
    label: "Custom Game",
    description: "Flexible rules for testing and sandbox battles.",
  },
];

const COPILOT_MODE_OPTIONS: Array<{
  value: CopilotMode;
  label: string;
  description: string;
}> = [
  { value: "off", label: "Off", description: "Hide battle coach analysis." },
  {
    value: "coach",
    label: "Coach",
    description: "Show actionable turn-by-turn guidance.",
  },
  {
    value: "deep",
    label: "Deep Coach",
    description: "Show guidance and CPU reasoning context together.",
  },
];

const CPU_MODEL_OPTIONS: Array<{
  value: CpuModelProfile;
  label: string;
  description: string;
}> = [
  { value: "fast", label: "Fast model", description: "Lower-latency CPU turns." },
  {
    value: "reasoning",
    label: "Reasoning model",
    description: "Slower but more deliberate CPU decisions.",
  },
];

const CPU_THINKING_LABELS = [
  "Analyzing matchup...",
  "Evaluating legal moves...",
  "Checking type matchups...",
  "Estimating strongest legal move...",
  "Considering safe alternatives...",
];

function buildFormatId(generation: GenerationKey, format: string) {
  return `${generation}${format}`;
}

function resolveBattleFormats(setup: BattleSetupState) {
  if (setup.teamSource === "random") {
    return {
      formatid: buildFormatId(setup.generation, setup.randomBattleType),
      randomTeamFormatid: buildFormatId(setup.generation, setup.randomBattleType),
    };
  }

  return {
    formatid: buildFormatId(setup.generation, setup.standardBattleType),
    randomTeamFormatid: buildFormatId(setup.generation, "randombattle"),
  };
}

function battleUiPrefsStorageKey(battleId: string) {
  return `battle-ui-prefs-${battleId}`;
}

function readStoredBattleUiPrefs(
  battleId: string | null | undefined,
): ActiveBattleUiState | null {
  if (!battleId || typeof window === "undefined") return null;

  try {
    const raw = window.sessionStorage.getItem(battleUiPrefsStorageKey(battleId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<ActiveBattleUiState>;
    if (
      typeof parsed.copilotEnabled !== "boolean" ||
      (parsed.copilotMode !== "off" &&
        parsed.copilotMode !== "coach" &&
        parsed.copilotMode !== "deep") ||
      (parsed.cpuModelProfile !== "fast" &&
        parsed.cpuModelProfile !== "reasoning")
    ) {
      return null;
    }
    return {
      copilotEnabled: parsed.copilotEnabled,
      copilotMode: parsed.copilotMode,
      cpuModelProfile: parsed.cpuModelProfile,
    };
  } catch {
    return null;
  }
}

function writeStoredBattleUiPrefs(
  battleId: string,
  prefs: ActiveBattleUiState,
) {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(
      battleUiPrefsStorageKey(battleId),
      JSON.stringify(prefs),
    );
  } catch {
    // Ignore sessionStorage failures and keep runtime behavior functional.
  }
}

function teamToBattleRoster(team: Team | null | undefined, level: number) {
  if (!team) return [];

  return team.slots
    .filter((slot) => slot.species.trim())
    .slice(0, 6)
    .map((slot) => ({
      species: slot.species.trim(),
      nickname: slot.nickname?.trim() || undefined,
      item: slot.item.trim() || undefined,
      ability: slot.ability.trim() || undefined,
      moves: slot.moves.map((move) => move.trim()).filter(Boolean).slice(0, 4),
      nature: slot.nature.trim() || undefined,
      evs: slot.evs,
      ivs: slot.ivs,
      level,
    }));
}

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

function useCpuStream(battleId: string | null): CpuStreamState {
  const [buffer, setBuffer] = useState("");
  const [visibleLength, setVisibleLength] = useState(0);
  const [isStreaming, setIsStreaming] = useState(false);
  const [isAvailable, setIsAvailable] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [decision, setDecision] = useState<CpuStreamDecisionSummary | null>(null);

  useEffect(() => {
    if (!battleId) {
      setBuffer("");
      setVisibleLength(0);
      setIsStreaming(false);
      setError(null);
      setDecision(null);
      setIsAvailable(true);
      return;
    }

    if (typeof window === "undefined" || typeof window.EventSource === "undefined") {
      setIsAvailable(false);
      return;
    }

    setIsAvailable(true);
    const eventSource = new window.EventSource(
      `${API_URL}/battle/${battleId}/cpu-stream`,
    );

    const parseEvent = <T,>(event: MessageEvent<string>): T | null => {
      try {
        return JSON.parse(event.data) as T;
      } catch {
        return null;
      }
    };

    const handleStart = (event: MessageEvent<string>) => {
      const data = parseEvent<{ turn?: number }>(event);
      if (!data) return;
      setBuffer("");
      setVisibleLength(0);
      setIsStreaming(true);
      setError(null);
      setDecision(null);
    };

    const handleChunk = (event: MessageEvent<string>) => {
      const data = parseEvent<{ content?: string }>(event);
      if (!data?.content) return;
      setBuffer((current) => current + data.content);
      setIsStreaming(true);
    };

    const handleDone = (event: MessageEvent<string>) => {
      const data = parseEvent<CpuStreamDecisionSummary>(event);
      if (!data) return;
      setDecision(data);
      setIsStreaming(false);
      if (typeof data.rawResponse === "string" && data.rawResponse.length > 0) {
        setBuffer(data.rawResponse);
      }
    };

    const handleModelError = (event: MessageEvent<string>) => {
      const data = parseEvent<{ error?: string }>(event);
      setError(data?.error ?? "CPU stream failed");
      setIsStreaming(false);
    };

    eventSource.addEventListener("start", handleStart as EventListener);
    eventSource.addEventListener("chunk", handleChunk as EventListener);
    eventSource.addEventListener("done", handleDone as EventListener);
    eventSource.addEventListener("model-error", handleModelError as EventListener);

    return () => {
      eventSource.removeEventListener("start", handleStart as EventListener);
      eventSource.removeEventListener("chunk", handleChunk as EventListener);
      eventSource.removeEventListener("done", handleDone as EventListener);
      eventSource.removeEventListener(
        "model-error",
        handleModelError as EventListener,
      );
      eventSource.close();
    };
  }, [battleId]);

  useEffect(() => {
    if (visibleLength >= buffer.length) return;
    const timeout = window.setTimeout(() => {
      setVisibleLength((current) =>
        Math.min(buffer.length, current + Math.max(1, Math.ceil((buffer.length - current) / 10))),
      );
    }, 18);
    return () => window.clearTimeout(timeout);
  }, [buffer, visibleLength]);

  return {
    text: buffer.slice(0, visibleLength),
    isStreaming: isStreaming || visibleLength < buffer.length,
    isAvailable,
    error,
    decision,
  };
}

type CopilotHistoryEntry = {
  turn: number;
  phase: string;
  guidance: CopilotGuidance;
};

async function fetchCopilotGuidance(
  battleId: string,
): Promise<CopilotGuidance> {
  return fetchJson<CopilotGuidance>(`${API_URL}/battle/${battleId}/copilot`);
}

function useCopilotHistory(
  battleId: string | null,
  currentTurn: number,
  phase: string | undefined,
  shouldFetch: boolean,
) {
  const [history, setHistory] = useState<CopilotHistoryEntry[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const fetchedKeysRef = useRef(new Set<string>());
  const inflightKeyRef = useRef<string | null>(null);

  const requestKey = `${battleId}-${currentTurn}-${phase}`;

  useEffect(() => {
    if (!battleId || !shouldFetch) return;
    if (fetchedKeysRef.current.has(requestKey)) return;
    if (inflightKeyRef.current === requestKey) return;
    inflightKeyRef.current = requestKey;

    let cancelled = false;
    setIsLoading(true);

    fetchCopilotGuidance(battleId)
      .then((guidance) => {
        if (cancelled) return;
        fetchedKeysRef.current.add(requestKey);
        if (guidance.disabled) return;
        setHistory((prev) => [
          ...prev,
          { turn: currentTurn, phase: phase ?? "unknown", guidance },
        ]);
      })
      .catch(() => {
        // Allow retry on failure by not adding to fetchedKeysRef
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoading(false);
          if (inflightKeyRef.current === requestKey) {
            inflightKeyRef.current = null;
          }
        }
      });

    return () => {
      cancelled = true;
      if (inflightKeyRef.current === requestKey) {
        inflightKeyRef.current = null;
      }
    };
  }, [battleId, currentTurn, phase, shouldFetch, requestKey]);

  return { history, isLoading };
}

async function fetchBattleEvents(params: {
  battleId: string;
  afterSeq: number;
  limit?: number;
}): Promise<PlaybackEvent[]> {
  const payload = await fetchJson<unknown>(
    `${API_URL}/battle/${params.battleId}/events?afterSeq=${params.afterSeq}&limit=${params.limit ?? 100}`,
  );
  const rawEvents = Array.isArray(payload)
    ? payload
    : Array.isArray((payload as { events?: unknown[] })?.events)
      ? (payload as { events: unknown[] }).events
      : [];

  const out: PlaybackEvent[] = [];
  for (const rawEvent of rawEvents) {
    const normalized = normalizePlaybackEvent(rawEvent);
    if (normalized) out.push(normalized);
  }
  return out.sort((a, b) => a.seq - b.seq);
}

async function postBattleAck(params: { battleId: string; eventSeq: number }) {
  const response = await fetch(`${API_URL}/battle/${params.battleId}/ack`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ eventSeq: params.eventSeq }),
  });
  if (!response.ok) {
    const text = await response.text().catch(() => "");
    const error = new Error(text || `Ack failed (${response.status})`);
    (error as Error & { status?: number }).status = response.status;
    throw error;
  }
}

async function postBattleContinue(params: { battleId: string }) {
  const response = await fetch(`${API_URL}/battle/${params.battleId}/continue`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
  });
  if (!response.ok) {
    const text = await response.text().catch(() => "");
    const error = new Error(text || `Continue failed (${response.status})`);
    (error as Error & { status?: number }).status = response.status;
    throw error;
  }
  return response.json().catch(() => null);
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

function normalizePlaybackEvent(raw: unknown): PlaybackEvent | null {
  if (!raw || typeof raw !== "object") return null;
  const data = raw as Record<string, unknown>;
  const payload =
    data.payload && typeof data.payload === "object"
      ? (data.payload as Record<string, unknown>)
      : null;
  const seq = Number(data.seq);
  if (!Number.isFinite(seq)) return null;
  const type = String(data.type ?? data.kind ?? "event");
  const turnValue = Number(data.turn);
  const timestamp =
    typeof data.timestamp === "number"
      ? data.timestamp
      : typeof data.ts === "number"
        ? data.ts
        : Date.now();

  const text = extractReadableEventText(data, payload, type, seq);
  const description = pickStringValue(data, payload, "description");
  const actor = pickStringValue(data, payload, "actor");
  const target = pickStringValue(data, payload, "target");
  const sourceType = pickStringValue(data, payload, "sourceType");
  const sourceName = pickStringValue(data, payload, "sourceName");
  const hpPercent = pickNumberValue(data, payload, "hpPercent");
  const deltaPercent = pickNumberValue(data, payload, "deltaPercent");
  const currentHp = pickNumberValue(data, payload, "currentHp");
  const maxHp = pickNumberValue(data, payload, "maxHp");
  const deltaHp = pickNumberValue(data, payload, "deltaHp");

  return {
    seq,
    turn: Number.isFinite(turnValue) ? turnValue : 0,
    type,
    text,
    description,
    actor,
    target,
    hpPercent,
    deltaPercent,
    currentHp,
    maxHp,
    deltaHp,
    sourceType,
    sourceName,
    payload: raw,
    timestamp,
  };
}

function extractReadableEventText(
  data: Record<string, unknown>,
  payload: Record<string, unknown> | null,
  type: string,
  seq: number,
) {
  const readFromObject = (obj: Record<string, unknown> | null | undefined) => {
    if (!obj) return null;
    const textFields = [
      "text",
      "display",
      "message",
      "summary",
      "logLine",
      "description",
    ];
    for (const field of textFields) {
      const value = obj[field];
      if (typeof value === "string" && value.trim()) {
        return value.trim();
      }
    }
    return null;
  };

  const directText = readFromObject(data);
  if (directText) return directText;

  const payloadText = readFromObject(payload);
  if (payloadText) return payloadText;

  const details =
    payload?.details && typeof payload.details === "object"
      ? (payload.details as Record<string, unknown>)
      : null;
  const detailsText = readFromObject(details);
  if (detailsText) return detailsText;

  const actor =
    typeof data.actor === "string"
      ? data.actor
      : typeof payload?.actor === "string"
        ? payload.actor
        : null;
  const moveName =
    typeof data.moveName === "string"
      ? data.moveName
      : typeof payload?.moveName === "string"
        ? payload.moveName
        : typeof payload?.move === "string"
          ? payload.move
          : null;
  if (moveName && actor) return `${actor} used ${moveName}!`;
  if (moveName) return `Used ${moveName}!`;

  const reason =
    typeof data.reason === "string"
      ? data.reason
      : typeof payload?.reason === "string"
        ? payload.reason
        : null;
  if (reason?.trim()) return reason.trim();

  if (type.toUpperCase() === "TURN_START") {
    const turnNum = pickNumberValue(data, payload, "turn");
    if (typeof turnNum === "number") return `Turn ${turnNum}`;
    return `${type}#${seq}`;
  }
  if (type.toUpperCase() === "TURN_END") {
    const ended = pickNumberValue(data, payload, "endedTurn");
    if (typeof ended === "number") return `End of turn ${ended}`;
    return `Turn ended`;
  }
  if (type.toUpperCase() === "ITEM_HEAL") {
    const source = pickStringValue(data, payload, "sourceName") ?? "item";
    const delta = pickNumberValue(data, payload, "deltaPercent");
    if (typeof delta === "number") return `${formatSignedDelta(delta)} from ${source}`;
    return `Recovered HP from ${source}`;
  }
  if (type.toUpperCase() === "ABILITY_HEAL") {
    const source = pickStringValue(data, payload, "sourceName") ?? "ability";
    const delta = pickNumberValue(data, payload, "deltaPercent");
    if (typeof delta === "number") return `${formatSignedDelta(delta)} from ${source}`;
    return `Recovered HP from ${source}`;
  }
  if (type.toUpperCase() === "STATUS_TICK" || type.toUpperCase() === "WEATHER_TICK") {
    const source = pickStringValue(data, payload, "sourceName") ?? "effect";
    const delta = pickNumberValue(data, payload, "deltaPercent");
    if (typeof delta === "number") return `${formatSignedDelta(delta)} from ${source}`;
    return `HP changed from ${source}`;
  }

  return `${type}#${seq}`;
}

function pickStringValue(
  data: Record<string, unknown>,
  payload: Record<string, unknown> | null,
  key: string,
) {
  const direct = data[key];
  if (typeof direct === "string" && direct.trim()) return direct.trim();
  const nested = payload?.[key];
  if (typeof nested === "string" && nested.trim()) return nested.trim();
  return null;
}

function pickNumberValue(
  data: Record<string, unknown>,
  payload: Record<string, unknown> | null,
  key: string,
) {
  const direct = data[key];
  if (typeof direct === "number" && Number.isFinite(direct)) return direct;
  const nested = payload?.[key];
  if (typeof nested === "number" && Number.isFinite(nested)) return nested;
  if (typeof nested === "string") {
    const parsed = Number(nested);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function formatSignedDelta(delta: number) {
  const rounded = Math.round(delta);
  return `${rounded >= 0 ? "+" : ""}${rounded}%`;
}

async function postBattleAction(params: {
  battleId: string;
  player: "p1" | "p2";
  choice?: string;
  moveIndex?: number;
}) {
  const response = await fetch(`${API_URL}/battle/${params.battleId}/action`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      player: params.player,
      ...(params.choice ? { choice: params.choice } : {}),
      ...(typeof params.moveIndex === "number"
        ? { moveIndex: params.moveIndex }
        : {}),
    }),
  });

  if (!response.ok) {
    let payload: unknown = null;
    try {
      payload = await response.json();
    } catch {
      const txt = await response.text().catch(() => "");
      payload = txt || null;
    }
    const data = payload as Record<string, unknown> | null;
    const legalChoices =
      Array.isArray(data?.legalChoices) && data?.legalChoices
        ? data.legalChoices.map((value) => String(value))
        : Array.isArray(data?.legalOptions) && data?.legalOptions
          ? data.legalOptions.map((value) => String(value))
          : undefined;
    const legalMoves =
      Array.isArray(data?.legalMoves) && data?.legalMoves
        ? data.legalMoves.map((value) => String(value))
        : undefined;
    const legalSwitches =
      Array.isArray(data?.legalSwitches) && data?.legalSwitches
        ? data.legalSwitches.map((value) => String(value))
        : undefined;
    const message =
      typeof data?.message === "string"
        ? data.message
        : typeof payload === "string"
          ? payload
          : `Action submit failed (${response.status})`;
    const error = new Error(message) as Error & ActionSubmitError;
    error.status = response.status;
    error.legalChoices = legalChoices;
    error.legalMoves = legalMoves;
    error.legalSwitches = legalSwitches;
    throw error;
  }

  return response.json() as Promise<BattleState>;
}

function formatTurnLogEntry(entry: BattleState["turnLog"][number], p1Name = "You") {
  if (typeof entry === "string") return entry;
  const actor = entry.player === "p1" ? p1Name : "Opponent";
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
  p1Name = "You",
) {
  const merged = [...localActions, ...turnLog.map((e) => formatTurnLogEntry(e, p1Name))];
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

function formatLastAction(lastAction: BattleState["lastAction"], p1Name = "You") {
  if (!lastAction) return null;
  if (typeof lastAction === "string") return lastAction;
  return formatTurnLogEntry(lastAction, p1Name);
}

function canPlayerAct(state: BattleState | null, isSubmitting: boolean) {
  if (!state || isSubmitting || state.isEnded || state.phase === "ended") {
    return false;
  }
  if (state.awaitingAckEventSeq != null) return false;
  if (
    state.phase &&
    state.phase !== "awaiting-actions" &&
    state.phase !== "team-preview" &&
    state.phase !== "awaiting-forced-switch-p1"
  )
    return false;
  if (Array.isArray(state.pendingPlayers)) {
    return state.pendingPlayers.includes("p1");
  }
  return state.waitingForMove === true;
}

function sideNeedsMove(state: BattleState | null, player: "p1" | "p2") {
  if (!state || state.isEnded || state.phase === "ended") return false;
  if (player === "p1" && state.phase === "awaiting-forced-switch-p1")
    return true;
  if (player === "p2" && state.phase === "awaiting-forced-switch-p2")
    return true;
  if (Array.isArray(state.pendingPlayers))
    return state.pendingPlayers.includes(player);
  if (player === "p1") return state.waitingForMove;
  return false;
}

function deriveStatusText(params: {
  state: BattleState | null;
  pendingActionLabel: string | null;
  isSubmitting: boolean;
  errorMessage: string | null;
  p1Name?: string;
}) {
  const { state, pendingActionLabel, isSubmitting, errorMessage, p1Name } = params;

  if (errorMessage) return `Error: ${errorMessage}`;
  if (!state) return "Loading battle state...";
  if (state.isEnded || state.phase === "ended") {
    return state.winner ? `${state.winner} wins.` : "Battle ended.";
  }
  if (isSubmitting && pendingActionLabel) {
    return `CPU is choosing an action... (${pendingActionLabel} selected)`;
  }
  if (isSubmitting) return "CPU is choosing an action...";
  if (state.awaitingAckEventSeq != null || state.phase === "awaiting-event-ack") {
    return "Playing back events...";
  }
  if (state.phase === "team-preview") return "Choose team order (e.g. 123456).";
  if (state.phase === "resolving") return "Resolving turn...";
  if (state.phase === "awaiting-forced-switch-p1")
    return "Forced switch: choose your next Pokémon.";
  if (state.phase === "awaiting-forced-switch-p2")
    return "Opponent is choosing...";
  const hasMoves = state.availableMoves.length > 0;
  const hasSwitches = (state.availableSwitches?.length ?? 0) > 0;
  if (sideNeedsMove(state, "p1") && !hasMoves && hasSwitches) {
    return "Forced switch: choose a Pokémon to switch in.";
  }
  if (
    state.phase &&
    state.phase !== "awaiting-actions" &&
    state.phase !== "team-preview" &&
    !sideNeedsMove(state, "p1")
  ) {
    return "Processing...";
  }
  if (sideNeedsMove(state, "p2")) return "Waiting for opponent...";
  if (sideNeedsMove(state, "p1")) return "Choose your action.";
  return formatLastAction(state.lastAction, p1Name) ?? "Battle in progress...";
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

function getStatusDisplay(status: string | null): { emoji: string; label: string; colorClass: string } | null {
  if (!status) return null;
  const map: Record<string, { emoji: string; label: string; colorClass: string }> = {
    brn: { emoji: "🔥", label: "Burn", colorClass: "text-orange-400 bg-orange-400/15 border-orange-400/30" },
    par: { emoji: "⚡", label: "Paralysis", colorClass: "text-yellow-400 bg-yellow-400/15 border-yellow-400/30" },
    psn: { emoji: "☠️", label: "Poison", colorClass: "text-purple-400 bg-purple-400/15 border-purple-400/30" },
    tox: { emoji: "☠️", label: "Toxic", colorClass: "text-fuchsia-400 bg-fuchsia-400/15 border-fuchsia-400/30" },
    slp: { emoji: "💤", label: "Sleep", colorClass: "text-blue-300 bg-blue-300/15 border-blue-300/30" },
    frz: { emoji: "❄️", label: "Frozen", colorClass: "text-cyan-300 bg-cyan-300/15 border-cyan-300/30" },
  };
  return map[status] ?? null;
}

function formatBoostLabel(stat: string, amount: number): string {
  const statNames: Record<string, string> = {
    atk: "Atk", def: "Def", spa: "SpA", spd: "SpD", spe: "Spe",
    accuracy: "Acc", evasion: "Eva",
  };
  const name = statNames[stat] || stat;
  return `${amount > 0 ? "+" : ""}${amount} ${name}`;
}

function normalizeSpriteName(name: string): string {
  return name.trim().toLowerCase().replace(/[\s.':-]/g, "").replace(/♀/g, "f").replace(/♂/g, "m");
}

function getSpriteUrl(name: string): string {
  if (!name || name === "Unknown") return "";
  return `https://play.pokemonshowdown.com/sprites/gen5ani/${normalizeSpriteName(name)}.gif`;
}

function getSpriteFallbackUrl(name: string): string {
  if (!name || name === "Unknown") return "";
  return `https://play.pokemonshowdown.com/sprites/gen5/${normalizeSpriteName(name)}.png`;
}

function getPokeApiFallbackUrl(name: string): string {
  if (!name || name === "Unknown") return "";
  const normalized = normalizeSpriteName(name);
  return `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${normalized}.png`;
}

function formatItemName(item: string | null | undefined): string | null {
  if (!item) return null;
  const trimmed = item.trim();
  if (!trimmed) return null;
  if (trimmed.includes(" ") || trimmed.charAt(0) === trimmed.charAt(0).toUpperCase()) {
    return trimmed;
  }
  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
}

function isControlEvent(type: string) {
  const upper = type.toUpperCase();
  return (
    upper === "REQUEST_MOVE" ||
    upper === "REQUEST_SWITCH" ||
    upper === "TURN_END" ||
    upper === "TURN_START" ||
    upper === "TURN" ||
    upper === "PAUSE" ||
    upper === "FORCED_SWITCH_REQUIRED"
  );
}

function mergePlaybackEvents(
  previous: PlaybackEvent[],
  next: PlaybackEvent[],
): PlaybackEvent[] {
  if (!next.length) return previous;
  const map = new Map<number, PlaybackEvent>();
  for (const event of previous) map.set(event.seq, event);
  for (const event of next) map.set(event.seq, event);
  return Array.from(map.values()).sort((a, b) => a.seq - b.seq);
}

function isBlockingEventType(type: string) {
  const upper = type.toUpperCase();
  return (
    upper.includes("FAINT") ||
    upper.includes("REQUEST_SWITCH") ||
    upper.includes("REQUEST_MOVE") ||
    upper.includes("TURN_END") ||
    upper.includes("TURN_START")
  );
}

function eventBadgeClass(type: string) {
  const upper = type.toUpperCase();
  if (upper === "TURN_START") return "border-amber-400/30 bg-amber-400/10 text-amber-200";
  if (upper.includes("REQUEST")) return "border-blue-400/30 bg-blue-400/10 text-blue-200";
  if (upper.includes("FAINT")) return "border-red-400/30 bg-red-400/10 text-red-200";
  if (upper.includes("TURN_END")) return "border-zinc-400/30 bg-zinc-400/10 text-zinc-200";
  if (
    upper.includes("ITEM_HEAL") ||
    upper.includes("ABILITY_HEAL") ||
    upper.includes("STATUS_TICK") ||
    upper.includes("WEATHER_TICK")
  ) {
    return "border-emerald-400/30 bg-emerald-400/10 text-emerald-200";
  }
  if (upper === "BOOST" || upper === "UNBOOST") return "border-violet-400/30 bg-violet-400/10 text-violet-200";
  if (upper === "ITEM" || upper === "ENDITEM") return "border-yellow-400/30 bg-yellow-400/10 text-yellow-200";
  if (upper === "ABILITY") return "border-cyan-400/30 bg-cyan-400/10 text-cyan-200";
  if (upper === "WEATHER" || upper === "FIELD_START" || upper === "FIELD_END") return "border-sky-400/30 bg-sky-400/10 text-sky-200";
  if (upper === "IMMUNE" || upper === "BLOCK") return "border-gray-400/30 bg-gray-400/10 text-gray-300";
  if (upper === "SIDE_START" || upper === "SIDE_END") return "border-orange-400/30 bg-orange-400/10 text-orange-200";
  if (upper === "VOLATILE_START" || upper === "VOLATILE_END" || upper === "CURE_STATUS") return "border-pink-400/30 bg-pink-400/10 text-pink-200";
  if (upper === "HIT_COUNT" || upper === "OHKO") return "border-rose-400/30 bg-rose-400/10 text-rose-200";
  return "border-white/20 bg-white/[0.06] text-white/75";
}

function getEventDeltaLabel(event: PlaybackEvent) {
  if (typeof event.deltaPercent !== "number") return null;
  const source = event.sourceName ?? event.sourceType ?? "effect";
  return `${formatSignedDelta(event.deltaPercent)} from ${source}`;
}

function eventKeyForDedup(event: PlaybackEvent) {
  return `${event.turn}:${event.type}:${event.text}`;
}

function buildTurnLogGroups(events: PlaybackEvent[]): TurnLogGroup[] {
  const groups: TurnLogGroup[] = [];
  const groupByTurn = new Map<number, TurnLogGroup>();
  const seenBoundaryKeys = new Set<string>();
  for (const event of events) {
    if (
      ["REQUEST_MOVE", "REQUEST_SWITCH", "TURN_END", "TURN_START"].includes(
        event.type.toUpperCase(),
      )
    ) {
      const key = eventKeyForDedup(event);
      if (seenBoundaryKeys.has(key)) continue;
      seenBoundaryKeys.add(key);
    }
    const turn = event.turn > 0 ? event.turn : 0;
    const existing = groupByTurn.get(turn);
    if (existing) {
      existing.events.push(event);
      continue;
    }
    const created: TurnLogGroup = { turn, events: [event] };
    groupByTurn.set(turn, created);
    groups.push(created);
  }
  return groups.sort((a, b) => a.turn - b.turn);
}

function resolveBattleSideFromIdent(
  value: string | null | undefined,
): "p1" | "p2" | null {
  if (!value) return null;
  const lower = value.toLowerCase();
  if (lower.includes("p1")) return "p1";
  if (lower.includes("p2")) return "p2";
  if (lower.includes("you")) return "p1";
  if (lower.includes("opponent")) return "p2";
  return null;
}

function applyPlaybackEventToHpVisual(
  current: { p1: number; p2: number },
  event: PlaybackEvent,
) {
  const next = { ...current };
  const side =
    resolveBattleSideFromIdent(event.target) ??
    resolveBattleSideFromIdent(event.actor);
  if (!side) return next;

  if (typeof event.hpPercent === "number" && Number.isFinite(event.hpPercent)) {
    next[side] = Math.max(0, Math.min(100, Math.round(event.hpPercent)));
    return next;
  }
  if (
    typeof event.deltaPercent === "number" &&
    Number.isFinite(event.deltaPercent)
  ) {
    next[side] = Math.max(
      0,
      Math.min(100, Math.round(next[side] + event.deltaPercent)),
    );
    return next;
  }
  return next;
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

function CopilotMessageCard({ entry }: { entry: CopilotHistoryEntry }) {
  const g = entry.guidance;

  return (
    <div className="space-y-2 border-b border-white/5 pb-3 last:border-b-0">
      <div className="flex items-center gap-2">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-blue-400/60">
          Turn {entry.turn}
        </span>
        <span
          className={`ml-auto rounded-full px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider ${
            g.confidence === "high"
              ? "bg-emerald-500/20 text-emerald-400"
              : g.confidence === "medium"
                ? "bg-amber-500/20 text-amber-400"
                : "bg-red-500/20 text-red-400"
          }`}
        >
          {g.confidence}
        </span>
      </div>

      <div className="rounded-lg border border-blue-500/20 bg-blue-500/5 p-2.5">
        <div className="text-xs font-medium text-white">{g.recommendedLabel}</div>
        <div className="mt-1 text-[11px] leading-relaxed text-white/60">
          {g.reasoning}
        </div>
      </div>

      {(g.safeAlternative || g.aggressiveAlternative) && (
        <div className="flex gap-1.5">
          {g.safeAlternative && (
            <div className="flex-1 rounded-md border border-emerald-500/15 bg-emerald-500/5 px-2 py-1.5">
              <div className="text-[9px] font-semibold uppercase text-emerald-400/60">
                Safe
              </div>
              <div className="text-[11px] font-medium text-white/85">
                {g.safeAlternative.label}
              </div>
              <div className="text-[10px] text-white/45">
                {g.safeAlternative.reason}
              </div>
            </div>
          )}
          {g.aggressiveAlternative && (
            <div className="flex-1 rounded-md border border-red-500/15 bg-red-500/5 px-2 py-1.5">
              <div className="text-[9px] font-semibold uppercase text-red-400/60">
                Aggro
              </div>
              <div className="text-[11px] font-medium text-white/85">
                {g.aggressiveAlternative.label}
              </div>
              <div className="text-[10px] text-white/45">
                {g.aggressiveAlternative.reason}
              </div>
            </div>
          )}
        </div>
      )}

      <div className="flex gap-1.5 text-[10px]">
        <div className="flex-1 rounded-md border border-amber-500/10 bg-amber-500/5 px-2 py-1">
          <span className="font-semibold uppercase text-amber-400/60">Risk </span>
          <span className="text-white/55">{g.mainRisk}</span>
        </div>
      </div>
      <div className="text-[10px]">
        <div className="rounded-md border border-purple-500/10 bg-purple-500/5 px-2 py-1">
          <span className="font-semibold uppercase text-purple-400/60">Win con </span>
          <span className="text-white/55">{g.winConditionNote}</span>
        </div>
      </div>
    </div>
  );
}

function CopilotLoadingCard() {
  return (
    <div className="space-y-2.5 border-b border-white/5 pb-3">
      <div className="flex items-center gap-2">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-blue-400/60">
          Analyzing...
        </span>
        <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-blue-400" />
      </div>
      <div className="space-y-2">
        <div className="h-3 w-3/4 animate-pulse rounded bg-white/10" />
        <div className="h-3 w-1/2 animate-pulse rounded bg-white/10" />
        <div className="h-3 w-2/3 animate-pulse rounded bg-white/8" />
      </div>
    </div>
  );
}

function BattleArena(params: {
  battleState: BattleState;
  cpuStream: CpuStreamState;
  visualHpPercents: { p1: number; p2: number } | null;
  isPlaybackRunning: boolean;
  isSubmittingMove: boolean;
  statusText: string;
  moveSubmitPending: boolean;
  moveSubmitError: string | null;
  legalOptionsMessage: string | null;
  turnLogGroups: TurnLogGroup[];
  lastAckedSeq: number;
  awaitingAckEventSeq: number | null;
  collapsedTurns: Record<number, boolean>;
  playbackError: string | null;
  playerName: string;
  copilotEnabled: boolean;
  copilotMode: CopilotMode;
  cpuModelProfile: CpuModelProfile;
  copilotHistory: CopilotHistoryEntry[];
  copilotLoading: boolean;
  onToggleTurnCollapse: (turn: number) => void;
  onSubmitAction: (params: {
    choice: string;
    label: string;
    moveIndex?: number;
  }) => void;
  onContinue: () => void;
  continuePending: boolean;
  onLeaveBattle: () => void;
}) {
  const {
    battleState,
    cpuStream,
    visualHpPercents,
    isPlaybackRunning,
    isSubmittingMove,
    statusText,
    moveSubmitPending,
    moveSubmitError,
    legalOptionsMessage,
    turnLogGroups,
    lastAckedSeq,
    awaitingAckEventSeq,
    collapsedTurns,
    playbackError,
    playerName,
    copilotEnabled,
    copilotMode,
    cpuModelProfile,
    copilotHistory,
    copilotLoading,
    onToggleTurnCollapse,
    onSubmitAction,
    onContinue,
    continuePending,
    onLeaveBattle,
  } = params;
  const [teamOrder, setTeamOrder] = useState("123456");
  const loggerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!loggerRef.current) return;
    loggerRef.current.scrollTop = loggerRef.current.scrollHeight;
  }, [turnLogGroups]);

  const playerCanAct =
    canPlayerAct(battleState, moveSubmitPending || isSubmittingMove) &&
    !isPlaybackRunning;
  const forcedSwitchForP1 = battleState.phase === "awaiting-forced-switch-p1";
  const currentHpPercents = {
    p1:
      isPlaybackRunning && visualHpPercents
        ? visualHpPercents.p1
        : hpPercentFromStatePokemon(battleState.p1Pokemon),
    p2:
      isPlaybackRunning && visualHpPercents
        ? visualHpPercents.p2
        : hpPercentFromStatePokemon(battleState.p2Pokemon),
  };
  const cpuReasoning = extractCpuReasoningText(battleState.lastCpuDecision);
  const streamedCpuText = cpuStream.text.trim();
  const cpuDecisionSummary = cpuStream.decision ?? battleState.lastCpuDecision;

  return (
    <div className="space-y-4">
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

      <div
        className={
          copilotEnabled
            ? "grid gap-4 lg:grid-cols-[300px_minmax(0,1fr)_300px] xl:grid-cols-[340px_minmax(0,1fr)_340px]"
            : "grid gap-4 lg:grid-cols-[minmax(0,1fr)_300px] xl:grid-cols-[minmax(0,1fr)_340px]"
        }
      >
        {copilotEnabled && (
          <div className="flex h-[72vh] flex-col">
            <div className={`${panelClass} flex min-h-0 flex-1 flex-col`}>
              <div className="mb-3 flex items-center justify-between gap-2">
                <h3 className="text-sm font-medium tracking-wide text-white/70">
                  Battle Coach
                </h3>
                <div className="text-[10px] uppercase tracking-[0.16em] text-white/35">
                  {copilotMode === "deep" ? "Deep Coach" : "Coach"}
                </div>
              </div>
              <div className="mb-3 flex items-center gap-2 text-[11px] text-white/45">
                <span>CPU profile: {cpuModelProfile}</span>
                {copilotLoading && (
                  <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-white/20 border-t-blue-400" />
                )}
              </div>
              <div className="flex-1 space-y-3 overflow-y-auto rounded-xl border border-white/10 bg-black/50 p-3">
                {copilotHistory.length === 0 && !copilotLoading && (
                  <div className="text-xs text-white/40">
                    Coach analysis will appear when it&apos;s your turn.
                  </div>
                )}
                {copilotHistory.map((entry, i) => (
                  <CopilotMessageCard key={`copilot-${i}`} entry={entry} />
                ))}
                {copilotLoading && <CopilotLoadingCard />}
              </div>
            </div>
          </div>
        )}

        <div className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            {[
              {
                key: "p1" as const,
                label: `${playerName}'s Pokémon`,
                p: battleState.p1Pokemon,
              },
              {
                key: "p2" as const,
                label: "Opponent",
                p: battleState.p2Pokemon,
              },
            ].map(({ key, label, p }) => {
              const statusInfo = getStatusDisplay(p.status);
              const boosts = p.boosts;
              const itemLabel = formatItemName(p.item);
              const isUnknown = !p.name || p.name === "Unknown";

              return (
                <div key={label} className={`${panelClass} group relative`}>
                  <div className="mb-3 flex items-center justify-between">
                    <span className="text-sm font-medium text-white/60">{label}</span>
                    {p.ability && (
                      <span className="rounded-full border border-cyan-400/20 bg-cyan-400/10 px-2 py-0.5 text-[10px] text-cyan-300">
                        {p.ability}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    {isUnknown ? (
                      <div className="flex h-20 w-20 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-center text-xs text-white/40">
                        Switching...
                      </div>
                    ) : (
                      <img
                        src={getSpriteUrl(p.name)}
                        alt={p.name}
                        className="h-20 w-20 object-contain"
                        onError={(e) => {
                          const el = e.currentTarget;
                          const fallback1 = getSpriteFallbackUrl(p.name);
                          if (el.src !== fallback1) {
                            el.src = fallback1;
                            return;
                          }
                          el.src = `https://img.pokemondb.net/sprites/home/normal/${normalizeSpriteName(p.name)}.png`;
                        }}
                      />
                    )}
                    <div className="min-w-0 flex-1 space-y-1.5">
                      <div className="flex items-center gap-2">
                        <span className="truncate text-lg font-semibold tracking-tight text-white">
                          {isUnknown ? "Switching..." : p.name}
                        </span>
                        {!isUnknown && (
                          <span className="shrink-0 text-xs font-medium text-white/40">
                            Lv.{p.level ?? 100}
                          </span>
                        )}
                        {statusInfo && (
                          <span className={`shrink-0 rounded-full border px-1.5 py-0.5 text-[10px] font-medium ${statusInfo.colorClass}`}>
                            {statusInfo.emoji} {statusInfo.label}
                          </span>
                        )}
                      </div>
                      <div className="flex justify-between text-xs text-white/60">
                        <span>HP</span>
                        <span>{Math.round(p.hp)}/{Math.round(p.maxHp)}</span>
                      </div>
                      <div className="h-2.5 w-full rounded-full bg-white/10">
                        <div
                          className={`h-2.5 rounded-full transition-all duration-500 ${getHpBarClass(
                            currentHpPercents[key],
                          )}`}
                          style={{ width: `${currentHpPercents[key]}%` }}
                        />
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {itemLabel && (
                          <span className="rounded-full border border-yellow-400/25 bg-yellow-400/10 px-1.5 py-0.5 text-[10px] text-yellow-300">
                            📦 {itemLabel}
                          </span>
                        )}
                        {boosts && Object.entries(boosts).map(([stat, amt]) => (
                          <span
                            key={stat}
                            className={`rounded-full border px-1.5 py-0.5 text-[10px] font-medium ${
                              amt > 0
                                ? "border-emerald-400/25 bg-emerald-400/10 text-emerald-300"
                                : "border-red-400/25 bg-red-400/10 text-red-300"
                            }`}
                          >
                            {formatBoostLabel(stat, amt)}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                  {!isUnknown && (
                    <div className="pointer-events-none absolute bottom-full left-1/2 z-50 mb-1 hidden w-56 -translate-x-1/2 rounded-lg border border-white/15 bg-zinc-900 p-3 text-xs shadow-xl group-hover:block">
                      {p.types && p.types.length > 0 && (
                        <div className="mb-1.5 flex gap-1">
                          {p.types.map((t) => (
                            <span key={t} className="rounded bg-white/10 px-1.5 py-0.5 text-[10px] font-medium text-white/80">{t}</span>
                          ))}
                        </div>
                      )}
                      <div className="text-white/60">Level: <span className="text-white/90">{p.level ?? 100}</span></div>
                      {p.ability && <div className="text-white/60">Ability: <span className="text-white/90">{p.ability}</span></div>}
                      {p.item && <div className="text-white/60">Item: <span className="text-white/90">{p.item}</span></div>}
                      <div className="text-white/60">HP: <span className="text-white/90">{Math.round(p.hp)}/{Math.round(p.maxHp)}</span></div>
                      {p.status && <div className="text-white/60">Status: <span className="text-white/90">{p.status}</span></div>}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {!battleState.isEnded && (
            <div className={panelClass}>
          <div className="mb-4 flex items-center justify-between gap-3">
            <h3 className="text-sm font-medium tracking-wide text-white/70">
              Choose Your Action
            </h3>
            <div className="text-xs text-white/45">
              {playerCanAct ? "Your turn" : "Input locked"}
            </div>
          </div>
          {battleState.phase === "team-preview" ? (
            <div className="space-y-3">
              <div className="text-xs text-white/55">
                Submit your team order (digits 1-6, each once).
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <input
                  value={teamOrder}
                  onChange={(e) =>
                    setTeamOrder(e.target.value.replace(/[^1-6]/g, "").slice(0, 6))
                  }
                  placeholder="123456"
                  className="rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-white outline-none placeholder:text-white/30 focus:border-white/20"
                />
                <button
                  type="button"
                  onClick={() =>
                    onSubmitAction({
                      choice: `team ${teamOrder || "123456"}`,
                      label: `team ${teamOrder || "123456"}`,
                    })
                  }
                  disabled={!playerCanAct}
                  className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-white/80 transition-colors hover:bg-white/[0.06] disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Confirm Team Order
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {!forcedSwitchForP1 && battleState.availableMoves.length > 0 && (
                <div className="space-y-2">
                  <div className="text-xs uppercase tracking-wide text-white/45">
                    Moves
                  </div>
                  {battleState.availableMoves?.length === 1 &&
                    battleState.p1Pokemon.item &&
                    /choice/i.test(battleState.p1Pokemon.item) && (
                      <div className="mb-2 rounded-md border border-amber-400/20 bg-amber-400/10 px-3 py-1.5 text-xs text-amber-300">
                        🔒 Locked into {battleState.availableMoves[0]?.name} by {battleState.p1Pokemon.item}
                      </div>
                    )}
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    {battleState.availableMoves.map((move, index) => {
                      const choice = move.choice ?? `move ${move.index ?? index + 1}`;
                      const moveIndex = move.index ?? index + 1;
                      return (
                        <button
                          key={`${move.name}-${index}`}
                          type="button"
                          onClick={() =>
                            onSubmitAction({
                              choice,
                              label: move.name,
                              moveIndex,
                            })
                          }
                          disabled={!playerCanAct}
                          className="rounded-xl border border-white/10 bg-white/[0.02] px-4 py-3 text-left transition-colors hover:border-white/20 hover:bg-white/[0.04] disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          <div className="text-sm font-medium tracking-tight text-white">
                            {move.name}
                          </div>
                          <div className="mt-1 flex flex-wrap gap-x-2 text-xs text-white/55">
                            <span>{move.type}</span>
                            {move.category && <span>{move.category}</span>}
                            {move.power ? <span>BP {move.power}</span> : null}
                            <span>Acc {move.accuracy === true ? "—" : move.accuracy ?? "—"}</span>
                          </div>
                          <div className="mt-1 text-xs text-white/40">
                            PP {move.pp}/{move.maxPp}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
              {(battleState.availableSwitches?.length ?? 0) > 0 && (
                <div className="space-y-2">
                  <div className="text-xs uppercase tracking-wide text-white/45">
                    Switch
                  </div>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    {battleState.availableSwitches?.map((option) => (
                      <button
                        key={option.choice}
                        type="button"
                        onClick={() =>
                          onSubmitAction({
                            choice: option.choice,
                            label: `switch ${option.name}`,
                          })
                        }
                        disabled={!playerCanAct}
                        className="rounded-xl border border-white/10 bg-white/[0.02] px-4 py-3 text-left transition-colors hover:border-white/20 hover:bg-white/[0.04] disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        <div className="flex items-center gap-2">
                          <img
                            src={getSpriteFallbackUrl(option.name)}
                            alt={option.name}
                            className="h-8 w-8 object-contain"
                            onError={(e) => {
                              e.currentTarget.style.display = "none";
                            }}
                          />
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5 text-sm font-medium tracking-tight text-white">
                              {option.name}
                              <span className="text-[10px] font-normal text-white/40">Lv.{option.level ?? 100}</span>
                            </div>
                            <div className="mt-0.5 text-xs text-white/55">
                              HP {Math.round(option.hp ?? 0)}/{Math.round(option.maxHp ?? 0)}
                              {option.status ? ` • ${option.status}` : ""}
                            </div>
                            <div className="mt-0.5 flex flex-wrap gap-x-1.5 text-[10px] text-white/40">
                              {option.ability && <span>{option.ability}</span>}
                              {option.item && <span>📦 {option.item}</span>}
                            </div>
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {!forcedSwitchForP1 &&
                battleState.availableMoves.length === 0 &&
                (battleState.availableSwitches?.length ?? 0) === 0 && (
                  <button
                    type="button"
                    onClick={() =>
                      onSubmitAction({ choice: "default", label: "default" })
                    }
                    disabled={!playerCanAct}
                    className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-white/80 transition-colors hover:bg-white/[0.06] disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    Submit Default Action
                  </button>
                )}
              {battleState.phase === "awaiting-forced-switch-p2" &&
                battleState.awaitingAckEventSeq == null && (
                  <button
                    type="button"
                    onClick={onContinue}
                    disabled={continuePending || moveSubmitPending || isSubmittingMove}
                    className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-white/80 transition-colors hover:bg-white/[0.06] disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    {continuePending ? "Continuing..." : "Continue"}
                  </button>
                )}
            </div>
          )}
          <div className="mt-4 rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-white/70">
            {statusText}
          </div>
          {moveSubmitError && (
            <div className="mt-3 rounded-lg border border-white/10 bg-white/[0.02] px-3 py-2 text-sm text-white/65">
              {moveSubmitError}
            </div>
          )}
          {legalOptionsMessage && (
            <div className="mt-3 rounded-lg border border-white/10 bg-white/[0.02] px-3 py-2 text-xs text-white/60">
              {legalOptionsMessage}
            </div>
          )}
        </div>
      )}

      </div>

        <div className="flex h-[72vh] min-h-0 flex-col gap-4">
          <div className={`${panelClass} flex min-h-0 flex-1 flex-col`}>
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-medium tracking-wide text-white/70">
              Turn Logger
            </h3>
            <div className="text-xs text-white/50">
              Acked: {lastAckedSeq}
              {awaitingAckEventSeq != null ? ` • Pending: ${awaitingAckEventSeq}` : ""}
            </div>
          </div>
          {playbackError && (
            <div className="mb-3 rounded-md border border-white/10 bg-white/[0.02] px-2.5 py-2 text-xs text-white/65">
              {playbackError}
            </div>
          )}
          <div
            ref={loggerRef}
            className="flex-1 overflow-y-auto rounded-xl border border-white/10 bg-black/50 p-3"
          >
            <div className="space-y-4">
              {turnLogGroups
                .filter((group) => group.turn <= 0)
                .flatMap((group) => group.events)
                .filter((event) => !isControlEvent(event.type))
                .map((event) => (
                  <div key={`opening-${event.seq}`} className="text-sm leading-relaxed text-white/85">
                    {event.text}
                  </div>
                ))}

              {turnLogGroups
                .filter((group) => group.turn > 0)
                .map((group) => (
                  <section key={`turn-${group.turn}`} className="border-t border-white/10 pt-2">
                    <div className="mb-2 text-xl font-bold text-white">
                      Turn {group.turn}
                    </div>
                    <div className="space-y-1.5">
                      {group.events
                        .filter((event) => !isControlEvent(event.type))
                        .map((event) => (
                        <div
                          key={event.seq}
                          className={`text-sm leading-relaxed ${
                            awaitingAckEventSeq === event.seq
                              ? "text-white"
                              : event.seq <= lastAckedSeq
                                ? "text-white/85"
                                : "text-white/60"
                          }`}
                        >
                          <div>
                            <div>{event.text}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </section>
                ))}
              {turnLogGroups.length === 0 && (
                <div className="text-sm text-white/50">No events yet.</div>
              )}
            </div>
          </div>
          </div>

          <div className={`${panelClass} shrink-0 space-y-3`}>
            <div className="text-sm font-medium text-white/70">CPU Analysis</div>
            {cpuStream.isStreaming || streamedCpuText || cpuDecisionSummary ? (
              <div className="space-y-2">
                <div className="grid grid-cols-2 gap-2 text-xs text-white/55">
                  <div>Source: {cpuDecisionSummary?.source ?? "streaming"}</div>
                  <div>
                    {cpuStream.isStreaming
                      ? "Thinking..."
                      : typeof cpuDecisionSummary?.latencyMs === "number"
                        ? `${cpuDecisionSummary.latencyMs}ms`
                        : ""}
                  </div>
                  <div className="col-span-2 truncate">
                    Chose: {cpuDecisionSummary?.choice ?? "pending"}
                  </div>
                  <div className="col-span-2">
                    Type: {cpuDecisionSummary?.actionType ?? "unknown"}
                  </div>
                </div>
                {(streamedCpuText || cpuReasoning || cpuStream.error) && (
                  <div className="rounded-lg border border-white/10 bg-black/40 p-3 text-xs text-white/70">
                    <div className="whitespace-pre-wrap">
                      {streamedCpuText || cpuReasoning || cpuStream.error}
                      {cpuStream.isStreaming ? (
                        <span className="ml-1 inline-block h-3 w-1 animate-pulse bg-white/60 align-middle" />
                      ) : null}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-xs text-white/40">
                {cpuStream.isAvailable
                  ? "Opponent analysis will appear after their move."
                  : "Live CPU stream unavailable. Final CPU decision will appear after their move."}
              </div>
            )}
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
  const { getToken, isLoaded, userId } = useAuth();
  const { user } = useUser();
  const playerName = user?.firstName ?? user?.username ?? "You";
  const teambuilderApi = useMemo(
    () => createTeambuilderApiClient(() => getToken()),
    [getToken],
  );
  const [setup, setSetup] = useState<BattleSetupState>({
    teamSource: "random",
    generation: "gen9",
    randomBattleType: "randombattle",
    standardBattleType: "ou",
    copilotMode: "coach",
    cpuModelProfile: "fast",
    p1SavedTeamId: "",
    p2SavedTeamId: "",
    randomSeedInput: "",
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
    formatid: "gen9customgame",
  });
  const [battleId, setBattleId] = useState<string | null>(initialBattleId);
  const [battleStateSnapshot, setBattleStateSnapshot] =
    useState<BattleState | null>(null);
  const [moveUiError, setMoveUiError] = useState<string | null>(null);
  const [pendingActionLabel, setPendingActionLabel] = useState<string | null>(
    null,
  );
  const [legalOptionsMessage, setLegalOptionsMessage] = useState<string | null>(
    null,
  );
  const [playbackEvents, setPlaybackEvents] = useState<PlaybackEvent[]>([]);
  const [lastSeenSeq, setLastSeenSeq] = useState(0);
  const [lastAckedSeq, setLastAckedSeq] = useState(0);
  const [collapsedTurns, setCollapsedTurns] = useState<Record<number, boolean>>(
    {},
  );
  const [playbackError, setPlaybackError] = useState<string | null>(null);
  const [visualHpPercents, setVisualHpPercents] = useState<{
    p1: number;
    p2: number;
  } | null>(null);
  const [isPlaybackRunning, setIsPlaybackRunning] = useState(false);
  const [animatedStatusText, setAnimatedStatusText] = useState<string | null>(null);
  const [isSubmittingMove, setIsSubmittingMove] = useState(false);
  const isSubmittingMoveRef = useRef(false);
  const isPlaybackBusyRef = useRef(false);
  const lastContinueAtRef = useRef(0);
  const playbackEventsRef = useRef<PlaybackEvent[]>([]);
  const processedSeqRef = useRef<Set<number>>(new Set());

  const p1SearchDebounced = useDebouncedValue(
    setup.p1.query.trim(),
    SEARCH_DEBOUNCE_MS,
  );
  const p2SearchDebounced = useDebouncedValue(
    setup.p2.query.trim(),
    SEARCH_DEBOUNCE_MS,
  );

  const teamsQuery = useQuery({
    queryKey: ["battle", "teams"],
    queryFn: () => teambuilderApi.getTeams(),
    enabled: isLoaded && !!userId,
    refetchOnWindowFocus: false,
  });

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
      if (state.awaitingAckEventSeq != null || state.phase === "awaiting-event-ack")
        return 250;
      if (state.phase === "resolving") return 700;
      if (state.phase === "awaiting-forced-switch-p2") return 500;
      if (sideNeedsMove(state, "p2")) return 900;
      return 1200;
    },
  });
  const refetchBattleState = stateQuery.refetch;

  const liveBattleState = stateQuery.data ?? battleStateSnapshot;
  const cpuStream = useCpuStream(liveBattleState?.battleId ?? null);

  const playerNeedsToAct =
    !!battleId &&
    !!liveBattleState &&
    !liveBattleState.isEnded &&
    (liveBattleState.waitingForMove ||
      liveBattleState.phase === "awaiting-forced-switch-p1");

  const copilot = useCopilotHistory(
    battleId,
    liveBattleState?.currentTurn ?? 0,
    liveBattleState?.phase,
    playerNeedsToAct,
  );

  const selectedP1SavedTeam =
    teamsQuery.data?.find((team) => team.id === setup.p1SavedTeamId) ?? null;
  const selectedP2SavedTeam =
    teamsQuery.data?.find((team) => team.id === setup.p2SavedTeamId) ?? null;
  const resolvedFormats = resolveBattleFormats(setup);

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
      const parsedSeed = setup.randomSeedInput
        .split(",")
        .map((part) => Number.parseInt(part.trim(), 10))
        .filter((num) => Number.isFinite(num));
      const randomSeed =
        parsedSeed.length >= 4 ? parsedSeed.slice(0, 4) : undefined;
      const usingRandomTeams = setup.teamSource === "random";

      const body = {
        randomTeams: usingRandomTeams,
        randomTeamFormatid: resolvedFormats.randomTeamFormatid,
        randomSeed,
        copilotEnabled: setup.copilotMode !== "off",
        copilotMode: setup.copilotMode,
        cpuModelProfile: setup.cpuModelProfile,
        p1Team: usingRandomTeams
          ? []
          : setup.teamSource === "saved"
            ? teamToBattleRoster(selectedP1SavedTeam, setup.level)
            : setup.p1.selectedPokemon
              ? [
                  {
                    species: setup.p1.selectedPokemon.name,
                    ...(p1ResolvedAutoMoves ? {} : { moves: p1ResolvedSelectedMoves }),
                    level: setup.level,
                  },
                ]
              : [],
        p2Team: usingRandomTeams
          ? []
          : setup.teamSource === "saved"
            ? teamToBattleRoster(selectedP2SavedTeam, setup.level)
            : setup.p2.selectedPokemon
              ? [
                  {
                    species: setup.p2.selectedPokemon.name,
                    ...(p2ResolvedAutoMoves ? {} : { moves: p2ResolvedSelectedMoves }),
                    level: setup.level,
                  },
                ]
              : [],
        level: setup.level,
        formatid: resolvedFormats.formatid,
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
      setPendingActionLabel(null);
      setLegalOptionsMessage(null);
      setPlaybackEvents([]);
      setLastSeenSeq(0);
      setLastAckedSeq(0);
      processedSeqRef.current.clear();
      setCollapsedTurns({});
      setPlaybackError(null);
      setVisualHpPercents({
        p1: hpPercentFromStatePokemon(state.p1Pokemon),
        p2: hpPercentFromStatePokemon(state.p2Pokemon),
      });
      setIsPlaybackRunning(false);
      setAnimatedStatusText(null);
      setIsSubmittingMove(false);
      isSubmittingMoveRef.current = false;
      isPlaybackBusyRef.current = false;
      lastContinueAtRef.current = 0;
    },
  });

  const submitActionMutation = useMutation({
    mutationFn: async ({
      choice,
      moveIndex,
      actionLabel,
    }: {
      choice: string;
      moveIndex?: number;
      actionLabel: string;
    }) => {
      if (!battleId) throw new Error("No active battle");
      if (liveBattleState?.awaitingAckEventSeq != null) {
        throw new Error("Playback in progress. Wait for event ACK.");
      }

      const stateBeforeTurn = liveBattleState ?? battleStateSnapshot;

      setMoveUiError(null);
      setLegalOptionsMessage(null);
      setPendingActionLabel(actionLabel);
      setAnimatedStatusText(`Action selected: ${actionLabel}`);
      setIsSubmittingMove(true);
      isSubmittingMoveRef.current = true;

      try {
        const resolvedState = await postBattleAction({
          battleId,
          player: "p1",
          choice,
          moveIndex,
        });
        return {
          resolvedState,
          stateBeforeTurn,
          recoveredFromConflict: false,
        };
      } catch (error) {
        const actionError = error as Error & ActionSubmitError;
        const status = actionError.status;
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

        if (actionError.legalChoices?.length) {
          setLegalOptionsMessage(
            `Legal actions now: ${actionError.legalChoices.join(", ")}`,
          );
        } else if (
          (actionError.legalMoves?.length ?? 0) > 0 ||
          (actionError.legalSwitches?.length ?? 0) > 0
        ) {
          const legal = [
            ...(actionError.legalMoves?.map((m) => `move ${m}`) ?? []),
            ...(actionError.legalSwitches?.map((s) => `switch ${s}`) ?? []),
          ];
          setLegalOptionsMessage(`Legal actions now: ${legal.join(", ")}`);
        }

        if (sideNeedsMove(recoveredState, "p1")) {
          const err = new Error(
            actionError.message ||
              "That action is no longer legal this turn. Please choose again.",
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
    onSuccess: async ({ resolvedState }) => {
      setBattleStateSnapshot(resolvedState);
      setPendingActionLabel(null);
      setIsPlaybackRunning(false);
      setAnimatedStatusText(null);
      setIsSubmittingMove(false);
      isSubmittingMoveRef.current = false;
      setVisualHpPercents({
        p1: hpPercentFromStatePokemon(resolvedState.p1Pokemon),
        p2: hpPercentFromStatePokemon(resolvedState.p2Pokemon),
      });
    },
    onError: async (error) => {
      setPendingActionLabel(null);
      setIsPlaybackRunning(false);
      setAnimatedStatusText(null);
      setIsSubmittingMove(false);
      isSubmittingMoveRef.current = false;
      setMoveUiError((error as Error).message || "Failed to submit action");
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

  const continueMutation = useMutation({
    mutationFn: async () => {
      if (!battleId) throw new Error("No active battle");
      if (liveBattleState?.awaitingAckEventSeq != null) {
        throw new Error("Playback pending ACK. Continue blocked.");
      }
      return postBattleContinue({ battleId });
    },
    onSuccess: async () => {
      await refetchBattleState();
    },
    onError: (error) => {
      setMoveUiError((error as Error).message || "Continue failed");
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

  const toggleTurnCollapse = (turn: number) => {
    setCollapsedTurns((prev) => ({ ...prev, [turn]: !prev[turn] }));
  };

  const setupReady =
    setup.teamSource === "random"
      ? true
      : setup.teamSource === "saved"
        ? !!selectedP1SavedTeam &&
          !!selectedP2SavedTeam &&
          teamToBattleRoster(selectedP1SavedTeam, setup.level).length > 0 &&
          teamToBattleRoster(selectedP2SavedTeam, setup.level).length > 0
        : !!setup.p1.selectedPokemon && !!setup.p2.selectedPokemon;

  useEffect(() => {
    playbackEventsRef.current = playbackEvents;
  }, [playbackEvents]);

  useEffect(() => {
    if (!liveBattleState) return;
    const seeded = (liveBattleState.recentPlaybackEvents ?? [])
      .map((event) => normalizePlaybackEvent(event))
      .filter((event): event is PlaybackEvent => !!event)
      .sort((a, b) => a.seq - b.seq);
    if (!seeded.length) return;
    setPlaybackEvents((prev) => mergePlaybackEvents(prev, seeded));
    if (liveBattleState.awaitingAckEventSeq == null) {
      const maxSeeded = seeded[seeded.length - 1]?.seq ?? 0;
      if (maxSeeded > 0) setLastSeenSeq((prev) => Math.max(prev, maxSeeded));
      setLastAckedSeq((prev) => {
        const next = Math.max(prev, maxSeeded);
        for (let seq = 1; seq <= next; seq += 1) processedSeqRef.current.add(seq);
        return next;
      });
    }
  }, [
    liveBattleState?.battleId,
    liveBattleState?.eventCursor,
    liveBattleState?.awaitingAckEventSeq,
    liveBattleState?.recentPlaybackEvents,
  ]);

  useEffect(() => {
    if (!battleId || !liveBattleState || isPlaybackBusyRef.current) return;
    if (liveBattleState.isEnded || liveBattleState.phase === "ended") return;

    let cancelled = false;

    const runPlaybackTick = async () => {
      isPlaybackBusyRef.current = true;
      try {
        if (
          liveBattleState.phase === "awaiting-forced-switch-p2" &&
          liveBattleState.awaitingAckEventSeq == null &&
          !sideNeedsMove(liveBattleState, "p1")
        ) {
          if (Date.now() - lastContinueAtRef.current > 1200) {
            lastContinueAtRef.current = Date.now();
            await postBattleContinue({ battleId });
            await refetchBattleState();
          }
          return;
        }

        if (
          typeof liveBattleState.eventCursor === "number" &&
          liveBattleState.eventCursor > lastSeenSeq
        ) {
          const incoming = await fetchBattleEvents({
            battleId,
            afterSeq: lastSeenSeq,
            limit: 120,
          });
          if (!cancelled && incoming.length) {
            setPlaybackEvents((prev) => mergePlaybackEvents(prev, incoming));
            if (liveBattleState.awaitingAckEventSeq == null) {
              const maxSeq = incoming[incoming.length - 1]?.seq ?? 0;
              setLastSeenSeq((prev) => Math.max(prev, maxSeq));
              setLastAckedSeq((prev) => Math.max(prev, maxSeq));
            }
          }
        }

        const ackSeq = liveBattleState.awaitingAckEventSeq;
        if (ackSeq == null) return;
        if (ackSeq <= lastAckedSeq || processedSeqRef.current.has(ackSeq)) {
          setLastSeenSeq((prev) => Math.max(prev, ackSeq));
          setLastAckedSeq((prev) => Math.max(prev, ackSeq));
          await refetchBattleState();
          return;
        }

        let target = playbackEventsRef.current.find((event) => event.seq === ackSeq);
        if (!target) {
          const incoming = await fetchBattleEvents({
            battleId,
            afterSeq: Math.max(lastSeenSeq, ackSeq - 1),
            limit: 60,
          });
          if (!cancelled && incoming.length) {
            setPlaybackEvents((prev) => mergePlaybackEvents(prev, incoming));
            target = incoming.find((event) => event.seq === ackSeq);
          }
        }
        if (!target || cancelled) return;

        setPlaybackError(null);
        setIsPlaybackRunning(true);
        setAnimatedStatusText(target.text);
        setVisualHpPercents((prev) => {
          const base =
            prev ??
            ({
              p1: hpPercentFromStatePokemon(liveBattleState.p1Pokemon),
              p2: hpPercentFromStatePokemon(liveBattleState.p2Pokemon),
            } as { p1: number; p2: number });
          return applyPlaybackEventToHpVisual(base, target!);
        });
        await sleep(ACTION_DELAY_MS);
        await postBattleAck({ battleId, eventSeq: target.seq });
        if (cancelled) return;
        processedSeqRef.current.add(target.seq);
        setLastSeenSeq((prev) => Math.max(prev, target!.seq));
        setLastAckedSeq((prev) => Math.max(prev, target!.seq));
        setIsPlaybackRunning(false);
        setAnimatedStatusText(null);
        await refetchBattleState();
      } catch (error) {
        if (cancelled) return;
        setIsPlaybackRunning(false);
        const message = (error as Error).message || "Playback sync failed";
        setPlaybackError(message);
        if (message.toLowerCase().includes("ack")) {
          await refetchBattleState();
          const cursor =
            typeof liveBattleState.eventCursor === "number"
              ? liveBattleState.eventCursor
              : lastSeenSeq;
          const replayAfter = Math.max(0, Math.min(lastSeenSeq, cursor - 40));
          const incoming = await fetchBattleEvents({
            battleId,
            afterSeq: replayAfter,
            limit: 120,
          }).catch(() => []);
          if (!cancelled && incoming.length) {
            setPlaybackEvents((prev) => mergePlaybackEvents(prev, incoming));
          }
          await sleep(400);
          return;
        }
        await sleep(700);
        await refetchBattleState();
      } finally {
        isPlaybackBusyRef.current = false;
      }
    };

    void runPlaybackTick();
    return () => {
      cancelled = true;
    };
  }, [battleId, liveBattleState, lastSeenSeq, lastAckedSeq, refetchBattleState]);

  const turnLogGroups = useMemo(() => {
    if (playbackEvents.length > 0) {
      return buildTurnLogGroups(playbackEvents).slice(-20);
    }
    if (!liveBattleState) return [];
    const fallbackEvents: PlaybackEvent[] = liveBattleState.turnLog.map(
      (entry, index) => ({
        seq: index + 1,
        turn: liveBattleState.currentTurn,
        type: "TURN_LOG",
        text: formatTurnLogEntry(entry, playerName),
        payload: entry,
        timestamp: Date.now(),
      }),
    );
    return buildTurnLogGroups(fallbackEvents).slice(-20);
  }, [playbackEvents, liveBattleState, playerName]);

  const derivedStatusText = deriveStatusText({
    state: liveBattleState,
    pendingActionLabel,
    isSubmitting:
      submitActionMutation.isPending || isPlaybackRunning || isSubmittingMove,
    errorMessage: moveUiError,
    p1Name: playerName,
  });
  const statusText = animatedStatusText ?? derivedStatusText;

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
        cpuStream={cpuStream}
        visualHpPercents={visualHpPercents}
        isPlaybackRunning={isPlaybackRunning}
        isSubmittingMove={isSubmittingMove}
        statusText={statusText}
        moveSubmitPending={submitActionMutation.isPending}
        moveSubmitError={moveUiError}
        legalOptionsMessage={legalOptionsMessage}
        turnLogGroups={turnLogGroups}
        lastAckedSeq={lastAckedSeq}
        awaitingAckEventSeq={liveBattleState.awaitingAckEventSeq ?? null}
        collapsedTurns={collapsedTurns}
        playbackError={playbackError}
        playerName={playerName}
        copilotHistory={copilot.history}
        copilotLoading={copilot.isLoading}
        onToggleTurnCollapse={toggleTurnCollapse}
        onSubmitAction={({ choice, label, moveIndex }) => {
          if (isSubmittingMoveRef.current) return;
          if (
            !canPlayerAct(
              liveBattleState,
              submitActionMutation.isPending ||
                isPlaybackRunning ||
                isSubmittingMove,
            )
          )
            return;
          submitActionMutation.mutate({
            choice,
            moveIndex,
            actionLabel: label,
          });
        }}
        onContinue={() => continueMutation.mutate()}
        continuePending={continueMutation.isPending}
        onLeaveBattle={() => {
          setBattleId(null);
          setBattleStateSnapshot(null);
          setPendingActionLabel(null);
          setMoveUiError(null);
          setLegalOptionsMessage(null);
          setPlaybackEvents([]);
          setLastSeenSeq(0);
          setLastAckedSeq(0);
          processedSeqRef.current.clear();
          setCollapsedTurns({});
          setPlaybackError(null);
          setVisualHpPercents(null);
          setIsPlaybackRunning(false);
          setAnimatedStatusText(null);
          setIsSubmittingMove(false);
          isSubmittingMoveRef.current = false;
          isPlaybackBusyRef.current = false;
          lastContinueAtRef.current = 0;
          if (pathname !== "/") router.push("/");
        }}
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className={panelClass}>
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <div className="text-xs tracking-[0.18em] text-white/40">FORMAT</div>
            <div className="mt-2 text-sm text-white/55">
              Quick-start defaults let you launch a battle immediately.
            </div>
          </div>
          <div className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs text-white/55">
            Ready in 1 click
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <label className="space-y-1.5">
            <span className="text-xs text-white/50">Team source</span>
            <select
              value={setup.teamSource}
              onChange={(e) =>
                setSetup((prev) => ({
                  ...prev,
                  teamSource: e.target.value as TeamSourceMode,
                }))
              }
              className="w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-white outline-none focus:border-white/20"
            >
              <option value="random">Showdown random teams</option>
              <option value="saved">Use saved teams</option>
              <option value="manual">Manual single Pokémon</option>
            </select>
            <div className="text-xs text-white/45">
              {setup.teamSource === "random"
                ? "Backend will generate Showdown random teams for the selected generation."
                : setup.teamSource === "saved"
                  ? "Choose saved teams from the teambuilder for both sides."
                  : "Pick one Pokémon per side for a fast manual test battle."}
            </div>
          </label>

          <label className="space-y-1.5">
            <span className="text-xs text-white/50">Generation</span>
            <select
              value={setup.generation}
              onChange={(e) =>
                setSetup((prev) => ({
                  ...prev,
                  generation: e.target.value as GenerationKey,
                }))
              }
              className="w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-white outline-none focus:border-white/20"
            >
              {GENERATION_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="mt-4 rounded-xl border border-white/10 bg-black/25 p-4">
          <div className="mb-3">
            <div className="text-xs tracking-[0.16em] text-white/40">BATTLE TYPE</div>
            <div className="mt-1 text-xs text-white/45">
              {setup.teamSource === "random"
                ? "Choose the random ladder format to generate teams from."
                : "Choose the ruleset used when saved or manual teams are selected."}
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <label className="space-y-1.5 sm:col-span-3">
              <span className="text-xs text-white/50">
                {setup.teamSource === "random" ? "Random battle type" : "Battle type"}
              </span>
              <select
                value={
                  setup.teamSource === "random"
                    ? setup.randomBattleType
                    : setup.standardBattleType
                }
                onChange={(e) =>
                  setSetup((prev) => ({
                    ...prev,
                    ...(prev.teamSource === "random"
                      ? { randomBattleType: e.target.value }
                      : { standardBattleType: e.target.value }),
                  }))
                }
                className="w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-white outline-none focus:border-white/20"
              >
                {(setup.teamSource === "random"
                  ? RANDOM_BATTLE_OPTIONS
                  : STANDARD_BATTLE_OPTIONS
                ).map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="space-y-1.5">
              <span className="text-xs text-white/50">Battle format ID</span>
              <div className="rounded-lg border border-white/10 bg-black/35 px-3 py-2 font-mono text-sm text-white/85">
                {resolvedFormats.formatid}
              </div>
            </label>
            <label className="space-y-1.5">
              <span className="text-xs text-white/50">Random team format ID</span>
              <div className="rounded-lg border border-white/10 bg-black/35 px-3 py-2 font-mono text-sm text-white/85">
                {resolvedFormats.randomTeamFormatid}
              </div>
            </label>
          </div>
        </div>
      </div>

      <div className={panelClass}>
        <div className="mb-4">
          <div className="text-xs tracking-[0.18em] text-white/40">AI SETTINGS</div>
          <div className="mt-2 text-sm text-white/55">
            Coach and CPU defaults are configured for immediate play.
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="space-y-1.5">
            <span className="text-xs text-white/50">Co-pilot mode</span>
            <select
              value={setup.copilotMode}
              onChange={(e) =>
                setSetup((prev) => ({
                  ...prev,
                  copilotMode: e.target.value as CopilotMode,
                }))
              }
              className="w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-white outline-none focus:border-white/20"
            >
              {COPILOT_MODE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-1.5">
            <span className="text-xs text-white/50">CPU model</span>
            <select
              value={setup.cpuModelProfile}
              onChange={(e) =>
                setSetup((prev) => ({
                  ...prev,
                  cpuModelProfile: e.target.value as CpuModelProfile,
                }))
              }
              className="w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-white outline-none focus:border-white/20"
            >
              {CPU_MODEL_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      <details className={panelClass}>
        <summary className="cursor-pointer list-none">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-xs tracking-[0.18em] text-white/40">
                ADVANCED (OPTIONAL)
              </div>
              <div className="mt-2 text-sm text-white/55">
                Optional controls for reproducible battles and debugging.
              </div>
            </div>
            <div className="text-xs text-white/45">Expand</div>
          </div>
        </summary>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <label className="space-y-1.5">
            <span className="text-xs text-white/50">Random seed</span>
            <input
              value={setup.randomSeedInput}
              onChange={(e) =>
                setSetup((prev) => ({
                  ...prev,
                  randomSeedInput: e.target.value,
                }))
              }
              className="w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-white outline-none placeholder:text-white/30 focus:border-white/20 disabled:opacity-50"
              placeholder="1,2,3,4"
              disabled={setup.teamSource !== "random"}
            />
            <div className="text-xs text-white/45">
              Optional seed for deterministic battles (useful for debugging or reproducing matches).
            </div>
          </label>
        </div>
      </details>

      {setup.teamSource === "saved" && (
        <div className={panelClass}>
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <div className="text-sm font-medium tracking-wide text-white/70">
                Saved Teams
              </div>
              <div className="mt-1 text-xs text-white/45">
                Pulls from the existing teambuilder team list.
              </div>
            </div>
            {teamsQuery.isFetching && (
              <div className="text-xs text-white/45">Loading teams…</div>
            )}
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            <label className="space-y-1">
              <span className="text-xs text-white/50">{playerName} team</span>
              <select
                value={setup.p1SavedTeamId}
                onChange={(e) =>
                  setSetup((prev) => ({ ...prev, p1SavedTeamId: e.target.value }))
                }
                className="w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-white outline-none focus:border-white/20"
                disabled={!teamsQuery.data?.length}
              >
                <option value="">Select a saved team</option>
                {(teamsQuery.data ?? []).map((team) => (
                  <option key={team.id} value={team.id}>
                    {team.name} · {team.format}
                  </option>
                ))}
              </select>
            </label>

            <label className="space-y-1">
              <span className="text-xs text-white/50">CPU team</span>
              <select
                value={setup.p2SavedTeamId}
                onChange={(e) =>
                  setSetup((prev) => ({ ...prev, p2SavedTeamId: e.target.value }))
                }
                className="w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-white outline-none focus:border-white/20"
                disabled={!teamsQuery.data?.length}
              >
                <option value="">Select a saved team</option>
                {(teamsQuery.data ?? []).map((team) => (
                  <option key={team.id} value={team.id}>
                    {team.name} · {team.format}
                  </option>
                ))}
              </select>
            </label>
          </div>
          {(teamsQuery.error || (!teamsQuery.isFetching && !teamsQuery.data?.length)) && (
            <div className="mt-3 text-xs text-white/45">
              {teamsQuery.error
                ? (teamsQuery.error as Error).message
                : "No saved teams found. Build one in /teambuilder first."}
            </div>
          )}
        </div>
      )}

      {setup.teamSource === "manual" && (
        <div className="grid gap-6 lg:grid-cols-2">
          <PokemonSetupPanel
            side="p1"
            label={`${playerName}'s Pokémon`}
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
      )}

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
              className="rounded-2xl border border-white/10 bg-gradient-to-br from-white/[0.06] to-black/40 p-5"
            >
              <div className="text-xs tracking-[0.16em] text-white/45">{label} Team</div>
              <div className="mt-2 text-base font-medium text-white">
                {setup.teamSource === "random"
                  ? "Auto-generated random team"
                  : setup.teamSource === "saved"
                    ? (label === "P1" ? selectedP1SavedTeam?.name : selectedP2SavedTeam?.name) ??
                      "Not selected"
                    : data.selectedPokemon?.name ?? "Not selected"}
              </div>
              {setup.teamSource === "saved" && (
                <div className="mt-1 text-xs text-white/50">
                  {label === "P1"
                    ? selectedP1SavedTeam
                      ? `${teamToBattleRoster(selectedP1SavedTeam, setup.level).length} Pokémon ready`
                      : "No saved team selected"
                    : selectedP2SavedTeam
                      ? `${teamToBattleRoster(selectedP2SavedTeam, setup.level).length} Pokémon ready`
                      : "No saved team selected"}
                </div>
              )}
              {setup.teamSource === "manual" && data.selectedPokemon && (
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
            className="rounded-xl border border-white/15 bg-white px-5 py-3 text-sm font-semibold text-black transition-colors hover:bg-white/90 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {startBattleMutation.isPending ? "Starting battle..." : "Start Battle"}
          </button>
          {!setupReady && (
            <div className="self-center text-xs text-white/45">
              {setup.teamSource === "saved"
                ? "Select a saved team for both P1 and CPU to continue."
                : setup.teamSource === "manual"
                  ? "Select Pokémon for both P1 and P2 to continue."
                  : "Choose a valid setup to continue."}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
