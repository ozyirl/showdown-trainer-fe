"use client";

import { useAuth, useUser } from "@clerk/nextjs";
import { useMutation, useQuery } from "@tanstack/react-query";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Bot,
  BrainCircuit,
  ChevronDown,
  Crosshair,
  Library,
  LoaderCircle,
  Play,
  Search,
  Shuffle,
  SlidersHorizontal,
  Swords,
  UserRound,
  X,
  Zap,
} from "lucide-react";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  ACCENT_BG,
  ACCENT_TEXT,
  CornerFrame,
  IndexTag,
  Panel,
  PanelHeader,
  SquareBadge,
  boxButtonClass,
  formatIndex,
} from "@/components/battle/panel";
import {
  CpuAnalysisSheet,
  CpuDecisionBar,
  type CpuDecisionLine,
} from "@/components/battle/cpu-analysis";
import {
  CpuRetryNotice,
  useLiveCpuRetry,
} from "@/components/cpu-retry-status";
import {
  FieldLabel,
  MiniSprite,
  OptionCard,
  RadioRow,
  RecapRow,
  SegmentedControl,
  TileGroup,
} from "@/components/battle-setup/controls";
import { FlyBrainMotif } from "@/components/battle-setup/fly-brain-motif";
import {
  RandomTeamsPreview,
  SavedTeamPicker,
  SavedTeamsEmpty,
  SideHeading,
} from "@/components/battle-setup/team-views";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { FlyBrainStage } from "@/components/fly-brain-stage";
import { ItemIcon } from "@/components/item-icon";
import {
  FlyCnsBrainPanel,
  type FlyCnsDiagnostics,
} from "@/components/fly-cns-brain-panel";
import {
  AiDecisionTrace,
  CoachTrace,
  useAiDecisionHistory,
} from "@/components/battle-analysis-trace";
import { StickToBottomFeed } from "@/components/stick-to-bottom-feed";
import { createTeambuilderApiClient } from "@/lib/teambuilder/api-client";
import { cn } from "@/lib/utils";
import type { Team } from "@/lib/teambuilder/types";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:5200/api";

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
    moveIndex?: number;
    moveName?: string;
    reasoning?: string;
    rawResponse?: unknown;
    error?: string;
    truncated?: boolean;
    flyCns?: FlyCnsDiagnostics;
  } | null;
  lastP1AiDecision?: BattleState["lastCpuDecision"];
  lastAction?: string | MoveAcceptedAction | null;
  gameMode?: GameMode;
};

type CpuStreamDecisionSummary = {
  turn: number;
  choice: string;
  actionType: string;
  source: string;
  modelId: string;
  latencyMs: number;
  moveIndex?: number;
  moveName?: string;
  reasoning?: string;
  rawResponse?: string;
  error?: string;
  truncated?: boolean;
};

type ParsedCpuDecision = {
  moveIndex?: number;
  moveName?: string;
  choice?: string;
  actionType?: string;
  modelId?: string;
  latencyMs?: number;
  source?: string;
  reasoning?: string;
  error?: string;
  rawResponse?: string;
  cleanedText?: string | null;
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
  /** The coach model that produced this guidance (not the CPU's model). */
  modelId?: string;
  copilotMode?: CopilotMode;
  latencyMs?: number;
  source?: "model" | "extractor" | "fallback";
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
type CpuModelProfile = "fast" | "reasoning" | "fly";
type GameMode = "pvp" | "ai-vs-ai";
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
  gameMode: GameMode;
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
  gameMode: GameMode;
};

const DEFAULT_ACTIVE_BATTLE_UI: ActiveBattleUiState = {
  copilotEnabled: false,
  copilotMode: "off",
  cpuModelProfile: "fast",
  gameMode: "pvp",
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
  {
    value: "ubers",
    label: "Ubers",
    description: "High-power restricted format.",
  },
  { value: "uu", label: "UU", description: "Underused singles." },
  { value: "ru", label: "RU", description: "Rarely used singles." },
  { value: "nu", label: "NU", description: "Never used singles." },
  { value: "pu", label: "PU", description: "Lower-tier singles." },
  { value: "lc", label: "LC", description: "Little Cup." },
  {
    value: "monotype",
    label: "Monotype",
    description: "Single-type team constraint.",
  },
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
  {
    value: "fast",
    label: "Fast model",
    description: "Lower-latency CPU turns.",
  },
  {
    value: "reasoning",
    label: "Reasoning model",
    description: "Slower but more deliberate CPU decisions.",
  },
  {
    value: "fly",
    label: "Fly CNS model",
    description: "Trained battle policy on the fly connectome. Instant turns.",
  },
];

const CPU_PROFILE_BADGES: Record<CpuModelProfile, string> = {
  fast: "Fast",
  reasoning: "Reasoning",
  fly: "Fly CNS",
};

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
      randomTeamFormatid: buildFormatId(
        setup.generation,
        setup.randomBattleType,
      ),
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
    const raw = window.sessionStorage.getItem(
      battleUiPrefsStorageKey(battleId),
    );
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<ActiveBattleUiState>;
    if (
      typeof parsed.copilotEnabled !== "boolean" ||
      (parsed.copilotMode !== "off" &&
        parsed.copilotMode !== "coach" &&
        parsed.copilotMode !== "deep") ||
      (parsed.cpuModelProfile !== "fast" &&
        parsed.cpuModelProfile !== "reasoning" &&
        parsed.cpuModelProfile !== "fly")
    ) {
      return null;
    }
    return {
      copilotEnabled: parsed.copilotEnabled,
      copilotMode: parsed.copilotMode,
      cpuModelProfile: parsed.cpuModelProfile,
      gameMode: parsed.gameMode === "ai-vs-ai" ? "ai-vs-ai" : "pvp",
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
      moves: slot.moves
        .map((move) => move.trim())
        .filter(Boolean)
        .slice(0, 4),
      nature: slot.nature.trim() || undefined,
      evs: slot.evs,
      ivs: slot.ivs,
      level,
    }));
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const panelClass =
  "rounded-2xl border border-white/10 bg-white/3 p-6 backdrop-blur";

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
  const [decision, setDecision] = useState<CpuStreamDecisionSummary | null>(
    null,
  );
  const [prevBattleId, setPrevBattleId] = useState<string | null>(battleId);

  const hasEventSource =
    typeof window !== "undefined" && typeof window.EventSource !== "undefined";

  if (battleId !== prevBattleId) {
    setPrevBattleId(battleId);
    if (!battleId) {
      setBuffer("");
      setVisibleLength(0);
      setIsStreaming(false);
      setError(null);
      setDecision(null);
      setIsAvailable(true);
    } else {
      setIsAvailable(hasEventSource);
    }
  }

  useEffect(() => {
    if (!battleId || !hasEventSource) {
      return;
    }
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
      void (async () => {
        const parsed =
          typeof data.rawResponse === "string" && data.rawResponse.length > 0
            ? await parseCpuDecisionRawResponse(data.rawResponse)
            : null;

        setDecision({
          ...data,
          moveIndex: parsed?.moveIndex ?? data.moveIndex,
          moveName: parsed?.moveName ?? data.moveName,
          choice: parsed?.choice ?? data.choice,
          actionType: parsed?.actionType ?? data.actionType,
          source: parsed?.source ?? data.source,
          modelId: parsed?.modelId ?? data.modelId,
          latencyMs: parsed?.latencyMs ?? data.latencyMs,
          reasoning: parsed?.reasoning ?? data.reasoning,
          error: parsed?.error ?? data.error,
          rawResponse: data.rawResponse,
        });
        setIsStreaming(false);
        if (parsed?.cleanedText) {
          setBuffer(parsed.cleanedText);
          setVisibleLength(parsed.cleanedText.length);
          return;
        }
      })();
    };

    const handleModelError = (event: MessageEvent<string>) => {
      const data = parseEvent<{ error?: string }>(event);
      setError(data?.error ?? "CPU stream failed");
      setIsStreaming(false);
    };

    eventSource.addEventListener("start", handleStart as EventListener);
    eventSource.addEventListener("chunk", handleChunk as EventListener);
    eventSource.addEventListener("done", handleDone as EventListener);
    eventSource.addEventListener(
      "model-error",
      handleModelError as EventListener,
    );

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
  }, [battleId, hasEventSource]);

  useEffect(() => {
    if (visibleLength >= buffer.length) return;
    const timeout = window.setTimeout(() => {
      setVisibleLength((current) =>
        Math.min(
          buffer.length,
          current + Math.max(1, Math.ceil((buffer.length - current) / 10)),
        ),
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

    const doFetch = async () => {
      setIsLoading(true);
      try {
        const guidance = await fetchCopilotGuidance(battleId);
        if (cancelled) return;
        fetchedKeysRef.current.add(requestKey);
        if (guidance.disabled) return;
        setHistory((prev) => [
          ...prev,
          { turn: currentTurn, phase: phase ?? "unknown", guidance },
        ]);
      } catch {
        // Allow retry on failure by not adding to fetchedKeysRef
      } finally {
        if (!cancelled) {
          setIsLoading(false);
          if (inflightKeyRef.current === requestKey) {
            inflightKeyRef.current = null;
          }
        }
      }
    };
    doFetch();

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
  const response = await fetch(
    `${API_URL}/battle/${params.battleId}/continue`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    },
  );
  if (!response.ok) {
    const text = await response.text().catch(() => "");
    const error = new Error(text || `Continue failed (${response.status})`);
    (error as Error & { status?: number }).status = response.status;
    throw error;
  }
  return response.json().catch(() => null);
}

export function normalizePlaybackEvent(raw: unknown): PlaybackEvent | null {
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
    if (typeof delta === "number")
      return `${formatSignedDelta(delta)} from ${source}`;
    return `Recovered HP from ${source}`;
  }
  if (type.toUpperCase() === "ABILITY_HEAL") {
    const source = pickStringValue(data, payload, "sourceName") ?? "ability";
    const delta = pickNumberValue(data, payload, "deltaPercent");
    if (typeof delta === "number")
      return `${formatSignedDelta(delta)} from ${source}`;
    return `Recovered HP from ${source}`;
  }
  if (
    type.toUpperCase() === "STATUS_TICK" ||
    type.toUpperCase() === "WEATHER_TICK"
  ) {
    const source = pickStringValue(data, payload, "sourceName") ?? "effect";
    const delta = pickNumberValue(data, payload, "deltaPercent");
    if (typeof delta === "number")
      return `${formatSignedDelta(delta)} from ${source}`;
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

function withAckRefreshHint(message: string): string {
  if (/expected ack for event/i.test(message)) {
    return `${message} Please refresh.`;
  }
  return message;
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
    const error = new Error(withAckRefreshHint(message)) as Error &
      ActionSubmitError;
    error.status = response.status;
    error.legalChoices = legalChoices;
    error.legalMoves = legalMoves;
    error.legalSwitches = legalSwitches;
    throw error;
  }

  return response.json() as Promise<BattleState>;
}

function formatTurnLogEntry(
  entry: BattleState["turnLog"][number],
  p1Name = "You",
) {
  if (typeof entry === "string") return entry;
  const actor = entry.player === "p1" ? p1Name : "Opponent";
  return `${actor} selected ${entry.moveName} (#${entry.moveIndex}).`;
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

function normalizeCpuReasoningText(rawText?: string | null) {
  if (!rawText) return null;

  const lines = rawText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) =>
      line
        .replace(/^\s*(?:[-*•]\s*)?reasoning\s*:\s*/i, "")
        .replace(/^\s*(?:[-*•]\s*)?analysis\s*:\s*/i, "")
        .replace(/^\s*(?:[-*•]\s*)?thought\s*\d*\s*:\s*/i, "")
        .trim(),
    )
    .filter((line) => !/^\{.*\}$/.test(line))
    .filter((line) => !/^[{}[\],]+$/.test(line))
    .filter((line) => !/^"[\w-]+"\s*:/.test(line))
    .filter(Boolean);

  const deduped: string[] = [];
  for (const line of lines) {
    if (deduped[deduped.length - 1] === line) continue;
    deduped.push(line);
  }

  if (!deduped.length) return null;
  if (deduped.length === 1) return deduped[0];
  return deduped.map((line) => `• ${line}`).join("\n");
}

function extractLastJsonObject(text: string) {
  let depth = 0;
  let inString = false;
  let escaped = false;
  let end = -1;

  for (let i = text.length - 1; i >= 0; i -= 1) {
    const char = text[i];

    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (char === "\\") {
        escaped = true;
      } else if (char === '"') {
        inString = false;
      }
      continue;
    }

    if (char === '"') {
      inString = true;
      continue;
    }

    if (char === "}") {
      if (end === -1) end = i;
      depth += 1;
      continue;
    }

    if (char === "{") {
      depth -= 1;
      if (depth === 0 && end !== -1) {
        return {
          start: i,
          end: end + 1,
          jsonText: text.slice(i, end + 1),
        };
      }
    }
  }

  return null;
}

function parseCpuDecisionRawResponseSync(raw?: string) {
  if (!raw || typeof raw !== "string") return null;

  const trimmed = raw.trim();
  if (!trimmed) return null;

  const fencedMatches = [...trimmed.matchAll(/```(?:json)?\s*([\s\S]*?)```/gi)];
  const fenced = fencedMatches.at(-1);

  if (fenced) {
    try {
      const parsed = JSON.parse(fenced[1].trim()) as Record<string, unknown>;
      const visibleText = `${trimmed.slice(0, fenced.index)} ${trimmed.slice((fenced.index ?? 0) + fenced[0].length)}`;
      return {
        ...parsedCpuDecisionFromObject(parsed),
        rawResponse: raw,
        cleanedText:
          normalizeCpuReasoningText(visibleText) ??
          extractReasoningFromObject(parsed),
      } satisfies ParsedCpuDecision;
    } catch {
      // Ignore and continue to trailing object parsing.
    }
  }

  const trailing = extractLastJsonObject(trimmed);
  if (!trailing) {
    return {
      rawResponse: raw,
      cleanedText: normalizeCpuReasoningText(trimmed),
      reasoning: normalizeCpuReasoningText(trimmed) ?? undefined,
    } satisfies ParsedCpuDecision;
  }

  try {
    const parsed = JSON.parse(trailing.jsonText) as Record<string, unknown>;
    const visibleText = `${trimmed.slice(0, trailing.start)} ${trimmed.slice(trailing.end)}`;
    return {
      ...parsedCpuDecisionFromObject(parsed),
      rawResponse: raw,
      cleanedText:
        normalizeCpuReasoningText(visibleText) ??
        extractReasoningFromObject(parsed),
    } satisfies ParsedCpuDecision;
  } catch {
    const visibleText =
      trailing.end === trimmed.length
        ? `${trimmed.slice(0, trailing.start)} ${trimmed.slice(trailing.end)}`
        : trimmed;
    return {
      rawResponse: raw,
      cleanedText: normalizeCpuReasoningText(visibleText),
      reasoning: normalizeCpuReasoningText(visibleText) ?? undefined,
    } satisfies ParsedCpuDecision;
  }
}

async function parsePossiblyMalformedJson(jsonText: string) {
  try {
    return JSON.parse(jsonText) as Record<string, unknown>;
  } catch {
    try {
      const loadModule = new Function(
        "moduleName",
        "return import(moduleName)",
      ) as (moduleName: string) => Promise<unknown>;
      const mod = (await loadModule("jsonrepair")) as {
        jsonrepair?: (value: string) => string;
      };
      if (typeof mod.jsonrepair === "function") {
        return JSON.parse(mod.jsonrepair(jsonText)) as Record<string, unknown>;
      }
    } catch {
      // Optional dependency; ignore when unavailable.
    }
    return null;
  }
}

function extractReasoningFromObject(data: Record<string, unknown>) {
  const candidates = [
    data.reasoning,
    data.explanation,
    data.reason,
    data.summary,
    data.analysis,
    (data.message as Record<string, unknown> | undefined)?.content,
  ];

  for (const candidate of candidates) {
    if (typeof candidate === "string" && candidate.trim()) {
      return normalizeCpuReasoningText(candidate.trim());
    }
  }

  return null;
}

function parsedCpuDecisionFromObject(
  data: Record<string, unknown>,
): ParsedCpuDecision {
  return {
    moveIndex:
      typeof data.moveIndex === "number"
        ? data.moveIndex
        : typeof data.choiceIndex === "number"
          ? data.choiceIndex
          : undefined,
    moveName:
      typeof data.moveName === "string"
        ? data.moveName
        : typeof data.move === "string"
          ? data.move
          : undefined,
    choice:
      typeof data.choice === "string"
        ? data.choice
        : typeof data.action === "string"
          ? data.action
          : typeof data.move === "string"
            ? data.move
            : typeof data.moveName === "string"
              ? data.moveName
              : undefined,
    actionType:
      typeof data.actionType === "string"
        ? data.actionType
        : typeof data.type === "string"
          ? data.type
          : undefined,
    modelId: typeof data.modelId === "string" ? data.modelId : undefined,
    latencyMs: typeof data.latencyMs === "number" ? data.latencyMs : undefined,
    source: typeof data.source === "string" ? data.source : undefined,
    error: typeof data.error === "string" ? data.error : undefined,
    reasoning: extractReasoningFromObject(data) ?? undefined,
  };
}

async function parseCpuDecisionRawResponse(raw?: string) {
  if (!raw || typeof raw !== "string") return null;

  const trimmed = raw.trim();
  if (!trimmed) return null;

  const fencedMatches = [...trimmed.matchAll(/```(?:json)?\s*([\s\S]*?)```/gi)];
  const fenced = fencedMatches.at(-1);

  let parsedObject: Record<string, unknown> | null = null;
  let removedSegment: { start: number; end: number } | null = null;

  if (fenced && typeof fenced.index === "number") {
    removedSegment = {
      start: fenced.index,
      end: fenced.index + fenced[0].length,
    };
    parsedObject = await parsePossiblyMalformedJson(fenced[1].trim());
  }

  if (!parsedObject) {
    const trailing = extractLastJsonObject(trimmed);
    if (trailing) {
      if (trailing.end === trimmed.length) {
        removedSegment = { start: trailing.start, end: trailing.end };
      }
      parsedObject = await parsePossiblyMalformedJson(trailing.jsonText);
      if (parsedObject) {
        removedSegment = { start: trailing.start, end: trailing.end };
      }
    }
  }

  const visibleText = removedSegment
    ? `${trimmed.slice(0, removedSegment.start)} ${trimmed.slice(removedSegment.end)}`
    : trimmed;
  const cleanedText = normalizeCpuReasoningText(visibleText);

  if (!parsedObject) {
    return {
      rawResponse: raw,
      cleanedText,
      reasoning: cleanedText ?? undefined,
    } satisfies ParsedCpuDecision;
  }

  return {
    ...parsedCpuDecisionFromObject(parsedObject),
    rawResponse: raw,
    cleanedText: cleanedText ?? extractReasoningFromObject(parsedObject),
  } satisfies ParsedCpuDecision;
}

function extractCpuReasoningText(decision: BattleState["lastCpuDecision"]) {
  if (!decision) return null;
  if (typeof decision.reasoning === "string" && decision.reasoning.trim()) {
    return normalizeCpuReasoningText(decision.reasoning.trim());
  }

  const raw = decision.rawResponse;
  if (typeof raw === "string") {
    const parsed = parseCpuDecisionRawResponseSync(raw);
    const fallbackText =
      parsed?.cleanedText ??
      parsed?.reasoning ??
      normalizeCpuReasoningText(raw.trim()) ??
      raw.trim();
    return fallbackText || null;
  }
  if (raw && typeof raw === "object") {
    const data = raw as Record<string, unknown>;
    const extracted = extractReasoningFromObject(data);
    if (extracted) return extracted;
    try {
      return JSON.stringify(raw);
    } catch {
      return null;
    }
  }
  return null;
}

function formatCpuRawOutput(raw: unknown) {
  if (typeof raw === "string") return raw.trim() || null;
  if (!raw) return null;
  try {
    return JSON.stringify(raw, null, 2);
  } catch {
    return String(raw);
  }
}

function formatLastAction(
  lastAction: BattleState["lastAction"],
  p1Name = "You",
) {
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
  const { state, pendingActionLabel, isSubmitting, errorMessage, p1Name } =
    params;

  if (errorMessage) return `Error: ${errorMessage}`;
  if (!state) return "Loading battle state...";
  if (state.isEnded || state.phase === "ended") {
    return state.winner ? `${state.winner} wins.` : "Battle ended.";
  }
  if (isSubmitting && pendingActionLabel) {
    return `CPU is choosing an action... (${pendingActionLabel} selected)`;
  }
  if (isSubmitting) return "CPU is choosing an action...";
  if (
    state.awaitingAckEventSeq != null ||
    state.phase === "awaiting-event-ack"
  ) {
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

function getStatusDisplay(
  status: string | null,
): { emoji: string; label: string; colorClass: string } | null {
  if (!status) return null;
  const map: Record<
    string,
    { emoji: string; label: string; colorClass: string }
  > = {
    brn: {
      emoji: "🔥",
      label: "Burn",
      colorClass: "text-orange-400 bg-orange-400/15 border-orange-400/30",
    },
    par: {
      emoji: "⚡",
      label: "Paralysis",
      colorClass: "text-yellow-400 bg-yellow-400/15 border-yellow-400/30",
    },
    psn: {
      emoji: "☠️",
      label: "Poison",
      colorClass: "text-purple-400 bg-purple-400/15 border-purple-400/30",
    },
    tox: {
      emoji: "☠️",
      label: "Toxic",
      colorClass: "text-fuchsia-400 bg-fuchsia-400/15 border-fuchsia-400/30",
    },
    slp: {
      emoji: "💤",
      label: "Sleep",
      colorClass: "text-blue-300 bg-blue-300/15 border-blue-300/30",
    },
    frz: {
      emoji: "❄️",
      label: "Frozen",
      colorClass: "text-cyan-300 bg-cyan-300/15 border-cyan-300/30",
    },
  };
  return map[status] ?? null;
}

function formatBoostLabel(stat: string, amount: number): string {
  const statNames: Record<string, string> = {
    atk: "Atk",
    def: "Def",
    spa: "SpA",
    spd: "SpD",
    spe: "Spe",
    accuracy: "Acc",
    evasion: "Eva",
  };
  const name = statNames[stat] || stat;
  return `${amount > 0 ? "+" : ""}${amount} ${name}`;
}

function normalizeSpriteName(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[\s.':-]/g, "")
    .replace(/♀/g, "f")
    .replace(/♂/g, "m");
}

function getSpriteUrl(name: string): string {
  if (!name || name === "Unknown") return "";
  return `https://play.pokemonshowdown.com/sprites/gen5ani/${normalizeSpriteName(name)}.gif`;
}

function getSpriteFallbackUrl(name: string): string {
  if (!name || name === "Unknown") return "";
  return `https://play.pokemonshowdown.com/sprites/gen5/${normalizeSpriteName(name)}.png`;
}

function BattlePokemonSprite({
  name,
  alt,
  className,
}: {
  name: string;
  alt: string;
  className: string;
}) {
  const primarySrc = getSpriteUrl(name);
  const fallbackSrc = getSpriteFallbackUrl(name);
  const homeSrc = `https://img.pokemondb.net/sprites/home/normal/${normalizeSpriteName(name)}.png`;
  const [src, setSrc] = useState(primarySrc);

  useEffect(() => {
    setSrc(primarySrc);
  }, [primarySrc]);

  return (
    <Image
      src={src}
      alt={alt}
      width={80}
      height={80}
      unoptimized
      className={className}
      onError={() => {
        if (src !== fallbackSrc) {
          setSrc(fallbackSrc);
          return;
        }
        if (src !== homeSrc) {
          setSrc(homeSrc);
        }
      }}
    />
  );
}

function OptionalBattleSprite({
  src,
  alt,
  className,
  width,
  height,
}: {
  src: string;
  alt: string;
  className: string;
  width: number;
  height: number;
}) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);

  if (!src || failedSrc === src) return null;

  return (
    <Image
      src={src}
      alt={alt}
      width={width}
      height={height}
      unoptimized
      className={className}
      onError={() => {
        setFailedSrc(src);
      }}
    />
  );
}

function formatItemName(item: string | null | undefined): string | null {
  if (!item) return null;
  const trimmed = item.trim();
  if (!trimmed) return null;
  if (
    trimmed.includes(" ") ||
    trimmed.charAt(0) === trimmed.charAt(0).toUpperCase()
  ) {
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

function eventKeyForDedup(event: PlaybackEvent) {
  return `${event.turn}:${event.type}:${event.text}`;
}

export function buildTurnLogGroups(events: PlaybackEvent[]): TurnLogGroup[] {
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
    <div className="min-w-0 rounded-[4px] border border-white/10 bg-black/30">
      <div className="flex min-w-0 items-center justify-between gap-2 border-b border-white/[0.07] px-2.5 py-1.5">
        <span className="min-w-0 truncate font-mono text-[10px] uppercase tracking-[0.14em] text-white/40">
          {title}
        </span>
        <SegmentedControl
          ariaLabel={`${title} selection`}
          className="w-[132px] shrink-0"
          value={autoMoves ? "auto" : "manual"}
          onChange={(value) => {
            if (value === "auto") onSetAutoMoves(true);
            else if (autoMoves) onClearMoves();
          }}
          options={[
            { value: "auto", label: "Auto", title: "Auto-select moves" },
            { value: "manual", label: "Pick", title: "Pick up to 4 moves" },
          ]}
        />
      </div>

      <div className="space-y-2 p-2.5">
        {autoMoves ? (
          <div className="text-[11.5px] leading-snug text-white/50">
            {recommendedMoves.length
              ? `Auto-pick: ${recommendedMoves.slice(0, 4).join(", ")}`
              : "Moves are auto-selected for this Pokémon."}
          </div>
        ) : (
          <div className="flex min-w-0 items-center gap-2">
            <div className="grid min-w-0 flex-1 grid-cols-2 gap-1">
              {Array.from({ length: 4 }, (_, index) => (
                <span
                  key={index}
                  className={cn(
                    "h-6 min-w-0 truncate rounded-[3px] border px-1.5 text-[11px] leading-[22px]",
                    selectedMoves[index]
                      ? "border-white/15 bg-white/[0.06] text-white/85"
                      : "border-dashed border-white/10 text-white/25",
                  )}
                >
                  {selectedMoves[index] ?? `Move ${index + 1}`}
                </span>
              ))}
            </div>
            <div className="flex shrink-0 flex-col items-end gap-1">
              <span className="font-mono text-[10px] text-white/40">
                {selectedMoves.length}/4
              </span>
              <button
                type="button"
                onClick={onClearMoves}
                disabled={!selectedMoves.length}
                className={cn(boxButtonClass, "px-1.5 py-0.5 text-[10.5px]")}
              >
                Clear
              </button>
            </div>
          </div>
        )}

        {isLoading && (
          <div className="text-[11.5px] text-white/45">
            Loading move list...
          </div>
        )}

        {!isLoading && !autoMoves && moveOptions.length > 0 && (
          <div className="max-h-56 space-y-px overflow-y-auto rounded-[3px] border border-white/[0.07] bg-black/40 p-1">
            {moveOptions.map((move) => {
              const selected = selectedMoves.includes(move.name);
              const disabled = !selected && selectedMoves.length >= 4;
              return (
                <button
                  key={move.name}
                  type="button"
                  onClick={() => onToggleMove(move.name)}
                  disabled={disabled}
                  className={cn(
                    "flex w-full min-w-0 items-center justify-between gap-2 rounded-[3px] border px-2 py-1 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-40",
                    selected
                      ? "border-[#3b5bff]/60 bg-[#3b5bff]/[0.14] text-white"
                      : "border-transparent text-white/75 hover:border-white/15 hover:bg-white/[0.04]",
                  )}
                >
                  <span className="min-w-0">
                    <span className="block truncate text-[12px]">
                      {move.name}
                    </span>
                    <span className="block truncate font-mono text-[10px] text-white/35">
                      {move.type ?? "Unknown"}
                      {typeof move.basePower === "number"
                        ? ` · BP ${move.basePower}`
                        : ""}
                      {move.category ? ` · ${move.category}` : ""}
                    </span>
                  </span>
                  <span
                    className={cn(
                      "shrink-0 font-mono text-[9.5px] uppercase tracking-[0.12em]",
                      selected
                        ? ACCENT_TEXT
                        : recommendedMoves.includes(move.name)
                          ? "text-white/55"
                          : "text-white/25",
                    )}
                  >
                    {selected
                      ? "Selected"
                      : recommendedMoves.includes(move.name)
                        ? "Rec."
                        : "Add"}
                  </span>
                </button>
              );
            })}
          </div>
        )}

        {!isLoading && !autoMoves && moveOptions.length === 0 && (
          <div className="text-[11.5px] text-white/45">
            No moves found for this Pokémon.
          </div>
        )}
      </div>
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
    side,
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
  const query = setup.query.trim();
  // Once a Pokémon is picked the query holds its name; only search again if it changes.
  const showResults = !!query && query !== setup.selectedPokemon?.name;

  return (
    <div className="flex min-w-0 flex-col gap-2">
      <SideHeading
        badge={side.toUpperCase()}
        title={label}
        accent={side === "p1"}
        aside={
          setup.selectedPokemon
            ? setup.autoMoves
              ? "Moves auto"
              : `Moves ${setup.selectedMoves.length}/4`
            : "Not selected"
        }
      />

      <div className="relative">
        <Search
          aria-hidden
          className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-white/30"
        />
        <input
          value={setup.query}
          onChange={(e) => onQueryChange(e.target.value)}
          aria-label={`${label} search`}
          placeholder="Search Pokémon (e.g. Garchomp, Rotom)"
          className="h-8 w-full rounded-[4px] border border-white/10 bg-black/40 pl-8 pr-8 text-[12.5px] text-white outline-none placeholder:text-white/30 focus:border-white/25"
        />
        {setup.selectedPokemon && (
          <button
            type="button"
            onClick={onClearPokemon}
            aria-label="Clear Pokémon"
            title="Clear Pokémon"
            className="absolute right-1.5 top-1/2 grid h-5 w-5 -translate-y-1/2 place-items-center rounded-[3px] text-white/40 hover:bg-white/[0.08] hover:text-white"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {showResults && (
        <div className="space-y-1">
          {searchLoading && (
            <div className="text-[11.5px] text-white/45">Searching...</div>
          )}
          {searchError && (
            <div className="text-[11.5px] text-white/45">{searchError}</div>
          )}
          {!searchLoading && !searchError && searchResults.length > 0 && (
            <div className="max-h-52 space-y-px overflow-y-auto rounded-[4px] border border-white/10 bg-black/40 p-1">
              {searchResults.map((pokemon) => (
                <button
                  key={pokemon.name}
                  type="button"
                  onClick={() => onSelectPokemon(pokemon)}
                  className="flex w-full min-w-0 items-center gap-2 rounded-[3px] border border-transparent px-1.5 py-0.5 text-left transition-colors hover:border-white/15 hover:bg-white/[0.04]"
                >
                  <MiniSprite name={pokemon.name} size={28} />
                  <span className="min-w-0">
                    <span className="block truncate text-[12px] text-white">
                      {pokemon.name}
                    </span>
                    <span className="block truncate font-mono text-[10px] text-white/40">
                      {typeChipText(pokemon.types)}
                      {pokemon.tier ? ` · ${pokemon.tier}` : ""}
                    </span>
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {setup.selectedPokemon ? (
        <>
          <div className="flex min-w-0 items-center gap-2.5 rounded-[4px] border border-white/10 bg-white/[0.02] px-2 py-1.5">
            <CornerFrame className="p-0.5">
              <MiniSprite name={setup.selectedPokemon.name} size={40} />
            </CornerFrame>
            <div className="min-w-0 flex-1">
              <div className="truncate text-[13px] font-medium text-white">
                {setup.selectedPokemon.name}
              </div>
              <div className="truncate font-mono text-[10.5px] text-white/40">
                {typeChipText((details ?? setup.selectedPokemon).types)}
                {(details?.tier ?? setup.selectedPokemon.tier)
                  ? ` · ${details?.tier ?? setup.selectedPokemon.tier}`
                  : ""}
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
        </>
      ) : (
        !showResults && (
          <div className="rounded-[4px] border border-dashed border-white/10 px-2.5 py-3 text-center text-[11.5px] text-white/40">
            Type at least two letters to search, then pick one Pokémon.
          </div>
        )
      )}
    </div>
  );
}

function AiVsAiSpectatorPanel({
  index,
  onContinue,
  continuePending,
  isPlaybackRunning,
  awaitingAckEventSeq,
  statusText,
  battleState,
  children,
}: {
  index?: number;
  /** Optional feed under the controls, e.g. the interleaved AI decisions. */
  children?: ReactNode;
  onContinue: () => void;
  continuePending: boolean;
  isPlaybackRunning: boolean;
  awaitingAckEventSeq: number | null;
  statusText: string;
  battleState: BattleState;
}) {
  const [autoRun, setAutoRun] = useState(false);
  const autoRunRef = useRef(false);
  const lastAutoRunAt = useRef(0);

  useEffect(() => {
    autoRunRef.current = autoRun;
  }, [autoRun]);

  const canRunTurn =
    !continuePending &&
    !isPlaybackRunning &&
    awaitingAckEventSeq == null &&
    !battleState.isEnded;

  useEffect(() => {
    if (!autoRun || !canRunTurn || battleState.isEnded) return;
    const delay = Math.max(0, 1500 - (Date.now() - lastAutoRunAt.current));
    const timer = setTimeout(() => {
      if (!autoRunRef.current) return;
      lastAutoRunAt.current = Date.now();
      onContinue();
    }, delay);
    return () => clearTimeout(timer);
  }, [autoRun, canRunTurn, battleState.isEnded, onContinue]);

  const [prevIsEnded, setPrevIsEnded] = useState(battleState.isEnded);
  if (battleState.isEnded !== prevIsEnded) {
    setPrevIsEnded(battleState.isEnded);
    if (battleState.isEnded) setAutoRun(false);
  }

  return (
    <Panel className={children ? "min-h-0 flex-1 max-lg:h-[28rem] max-lg:flex-none" : "shrink-0"}>
      <PanelHeader
        title="AI vs AI — Spectator Mode"
        index={index}
        label="Spectate"
        aside={
          <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-white/45">
            {battleState.isEnded
              ? "Battle ended"
              : isPlaybackRunning
                ? "Playing..."
                : continuePending
                  ? "Thinking..."
                  : "Ready"}
          </span>
        }
      />
      <div className="flex flex-wrap items-center gap-3 p-3">
        <button
          type="button"
          onClick={onContinue}
          disabled={!canRunTurn}
          className={cn(boxButtonClass, "px-4 py-1.5 text-sm font-medium text-white")}
        >
          {continuePending ? "Running..." : "Run Turn"}
        </button>
        <label className="flex cursor-pointer items-center gap-2 text-sm text-white/60">
          <input
            type="checkbox"
            checked={autoRun}
            onChange={(e) => setAutoRun(e.target.checked)}
            disabled={battleState.isEnded}
            className="accent-[#3b5bff]"
          />
          Auto-run
        </label>
      </div>
      <div className="border-t border-white/[0.07] px-3 py-2 text-xs text-white/70">
        {statusText}
      </div>
      {children && (
        <>
          <div className="shrink-0 border-t border-white/[0.07] px-3 pt-2 font-mono text-[10px] uppercase tracking-[0.14em] text-white/40">
            Decision feed
          </div>
          <StickToBottomFeed className={cn("px-3 pb-3 pt-2", feedFadeClass)}>
            {children}
          </StickToBottomFeed>
        </>
      )}
    </Panel>
  );
}

/** Fades the top edge of a scrolling feed so cut-off lines read as scrolled. */
const feedFadeClass =
  "[mask-image:linear-gradient(to_bottom,transparent,black_14px)]";

/** Classes for the move and switch buttons. */
const actionButtonClass =
  "rounded-[4px] border border-white/10 bg-white/[0.02] px-3 py-2 text-left transition-colors hover:border-white/25 hover:bg-white/[0.05] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-white/40 disabled:cursor-not-allowed disabled:opacity-40";

/** One line for the CPU decision bar: "CPU · Psychic Fangs · fly-cns · 94%". */
function describeCpuDecisionLine(params: {
  key: string;
  label: string;
  tone: "rose" | "blue";
  decision:
    | BattleState["lastCpuDecision"]
    | CpuStreamDecisionSummary
    | null
    | undefined;
  flyCns?: FlyCnsDiagnostics | null;
  /** Turn of the decision that `flyCns` came with. */
  flyTurn?: number;
  thinking?: string | null;
}): CpuDecisionLine {
  const { decision, flyCns, flyTurn } = params;
  // Fly diagnostics belong to the battle state's decision; only use them when
  // they describe the same turn as the decision shown.
  const fly =
    flyCns &&
    (decision?.turn == null || flyTurn == null || decision.turn === flyTurn)
      ? flyCns
      : null;
  const selected = fly?.actions.find((action) => action.selected) ?? null;
  const action = decision
    ? (selected?.label ??
      decision.moveName ??
      decision.choice ??
      decision.actionType ??
      null)
    : null;
  const meta: string[] = [];
  if (decision?.modelId) meta.push(decision.modelId);
  if (selected) {
    meta.push(`${Math.round(selected.probability * 100)}%`);
  } else if (decision?.latencyMs != null) {
    meta.push(
      decision.latencyMs >= 1000
        ? `${(decision.latencyMs / 1000).toFixed(1)}s`
        : `${Math.round(decision.latencyMs)}ms`,
    );
  }
  if (decision?.source === "fallback") meta.push("fallback");
  return {
    key: params.key,
    label: params.label,
    tone: params.tone,
    action,
    meta,
    thinking: params.thinking,
  };
}

export function BattleArena(params: {
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
  gameMode: GameMode;
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
    playbackError,
    playerName,
    copilotEnabled,
    copilotMode,
    cpuModelProfile,
    gameMode,
    copilotHistory,
    copilotLoading,
    onSubmitAction,
    onContinue,
    continuePending,
    onLeaveBattle,
  } = params;
  const [teamOrder, setTeamOrder] = useState("123456");
  const [cpuThinkingIndex, setCpuThinkingIndex] = useState(0);
  const loggerRef = useRef<HTMLDivElement | null>(null);

  const [prevWasStreaming, setPrevWasStreaming] = useState(
    cpuStream.isStreaming,
  );
  if (cpuStream.isStreaming !== prevWasStreaming) {
    setPrevWasStreaming(cpuStream.isStreaming);
    if (!cpuStream.isStreaming) {
      setCpuThinkingIndex(0);
    }
  }

  useEffect(() => {
    if (!loggerRef.current) return;
    loggerRef.current.scrollTop = loggerRef.current.scrollHeight;
  }, [turnLogGroups]);

  useEffect(() => {
    if (!cpuStream.isStreaming) return;
    const interval = window.setInterval(() => {
      setCpuThinkingIndex(
        (current) => (current + 1) % CPU_THINKING_LABELS.length,
      );
    }, 1500);
    return () => window.clearInterval(interval);
  }, [cpuStream.isStreaming]);

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
  const isGenericFallback = (text: string | null | undefined) =>
    !text || /^Fallback:\s/i.test(text);
  const filteredCpuReasoning = isGenericFallback(cpuReasoning)
    ? null
    : cpuReasoning;
  const finalCpuReasoning = cpuStream.isStreaming
    ? null
    : streamedCpuText || filteredCpuReasoning || cpuStream.error;
  const hasStructuredCpuSummary = Boolean(
    cpuDecisionSummary?.choice ||
    cpuDecisionSummary?.moveName ||
    cpuDecisionSummary?.moveIndex ||
    cpuDecisionSummary?.actionType,
  );

  const isAiVsAi = gameMode === "ai-vs-ai";
  const p1AiDecision = battleState.lastP1AiDecision;
  const p1AiReasoning = extractCpuReasoningText(p1AiDecision);
  const filteredP1AiReasoning = isGenericFallback(p1AiReasoning)
    ? null
    : p1AiReasoning;

  // Accumulate decisions into a per-battle history for the analysis trace.
  // Pair each decision with the reasoning and raw output from the same
  // source (live stream or battle state), so a stale decision never picks up
  // newer text.
  const cpuTraceFromStream = cpuStream.decision != null;
  const cpuTraceInput = {
    side: "p2",
    label: isAiVsAi ? "P2 (AI)" : "CPU",
    tone: "rose" as const,
    decision: cpuStream.isStreaming ? null : cpuDecisionSummary,
    reasoning: cpuStream.isStreaming
      ? null
      : cpuTraceFromStream
        ? streamedCpuText || cpuStream.decision?.reasoning
        : filteredCpuReasoning,
    rawOutput: formatCpuRawOutput(
      cpuTraceFromStream
        ? cpuStream.decision?.rawResponse
        : battleState.lastCpuDecision?.rawResponse,
    ),
  };
  const aiDecisionHistory = useAiDecisionHistory(
    battleState.battleId,
    isAiVsAi
      ? [
          {
            side: "p1",
            label: "P1 (AI)",
            tone: "blue",
            decision: p1AiDecision,
            reasoning: filteredP1AiReasoning,
            rawOutput: formatCpuRawOutput(p1AiDecision?.rawResponse),
          },
          cpuTraceInput,
        ]
      : [cpuTraceInput],
  );

  const [analysisOpen, setAnalysisOpen] = useState(false);
  const openAnalysis = () => setAnalysisOpen(true);
  // One listener for CPU retries, shared by the decision bar and the sheet.
  const cpuRetry = useLiveCpuRetry(battleState.battleId);
  const showFlyStage = cpuModelProfile === "fly" && !isAiVsAi;
  const panelIndex = (() => {
    let next = 0;
    return {
      coach: copilotEnabled ? ++next : 0,
      p1: ++next,
      p2: ++next,
      action: ++next,
      fly: showFlyStage ? ++next : 0,
      analysis: ++next,
      log: ++next,
    };
  })();
  const cpuThinkingLabel = cpuStream.isStreaming
    ? CPU_THINKING_LABELS[cpuThinkingIndex]
    : null;
  const decisionLines: CpuDecisionLine[] = isAiVsAi
    ? [
        describeCpuDecisionLine({
          key: "p1",
          label: "P1",
          tone: "blue",
          decision: p1AiDecision,
        }),
        describeCpuDecisionLine({
          key: "p2",
          label: "P2",
          tone: "rose",
          decision: cpuDecisionSummary,
          flyCns: battleState.lastCpuDecision?.flyCns,
          flyTurn: battleState.lastCpuDecision?.turn,
          thinking: cpuThinkingLabel,
        }),
      ]
    : [
        describeCpuDecisionLine({
          key: "p2",
          label: "CPU",
          tone: "rose",
          decision: cpuDecisionSummary,
          flyCns: battleState.lastCpuDecision?.flyCns,
          flyTurn: battleState.lastCpuDecision?.turn,
          thinking: cpuThinkingLabel,
        }),
      ];
  const analysisTitle = isAiVsAi ? "AI Analysis" : "CPU Analysis";

  return (
    <div className="flex flex-col gap-3 lg:h-[calc(100dvh-5.75rem)] lg:min-h-[600px]">
      <Panel className="shrink-0 flex-row items-center justify-between gap-3 px-3 py-2">
        <div className="flex min-w-0 items-center gap-2.5">
          <SquareBadge>{formatIndex(battleState.currentTurn)}</SquareBadge>
          <div className="min-w-0">
            <div className="text-[13px] font-medium leading-tight text-white">
              Turn {battleState.currentTurn}
            </div>
            <div className="truncate font-mono text-[10px] uppercase tracking-[0.12em] text-white/40">
              {battleState.phase ?? "active"}
              <span className="px-1 text-white/20">·</span>
              {isAiVsAi ? "AI vs AI" : "vs CPU"}
              <span className="px-1 text-white/20">·</span>
              {CPU_PROFILE_BADGES[cpuModelProfile]}
            </div>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-3">
          <IndexTag label="Battle" className="max-sm:hidden" />
          <button
            type="button"
            onClick={onLeaveBattle}
            className={boxButtonClass}
          >
            Back to Setup
          </button>
        </div>
      </Panel>

      <div
        className={cn(
          "grid min-h-0 flex-1 gap-3 lg:grid-rows-[minmax(0,1fr)]",
          copilotEnabled
            ? "lg:grid-cols-[240px_minmax(0,1fr)_320px] xl:grid-cols-[260px_minmax(0,1fr)_340px] 2xl:grid-cols-[300px_minmax(0,1fr)_380px]"
            : "lg:grid-cols-[minmax(0,1fr)_320px] xl:grid-cols-[minmax(0,1fr)_360px] 2xl:grid-cols-[minmax(0,1fr)_400px]",
        )}
      >
        {copilotEnabled && (
          <Panel className="min-h-0 max-lg:order-3 max-lg:h-80">
            <PanelHeader
              title="Battle Coach"
              index={panelIndex.coach}
              label={copilotMode === "deep" ? "Deep coach" : "Coach"}
              aside={
                copilotLoading && (
                  <span className="inline-block h-3 w-3 shrink-0 animate-spin rounded-full border-2 border-white/20 border-t-[#9aabff]" />
                )
              }
            />
            {/* The coach's own model, from the latest guidance; the CPU
                profile belongs to the opponent panel. */}
            <div className="flex min-w-0 shrink-0 items-center gap-1.5 border-b border-white/[0.07] px-3 py-1.5 font-mono text-[10px] text-white/40">
              <span className="shrink-0 uppercase tracking-[0.12em]">
                Model
              </span>
              {copilotHistory.at(-1)?.guidance.modelId ? (
                <span className="truncate text-white/70">
                  {copilotHistory.at(-1)?.guidance.modelId}
                </span>
              ) : (
                <span className="truncate text-white/35">
                  after first analysis
                </span>
              )}
            </div>
            <StickToBottomFeed className={cn("p-3", feedFadeClass)}>
              <CoachTrace
                entries={copilotHistory}
                loading={copilotLoading}
                loadingTurn={battleState.currentTurn}
                empty={
                  <div className="text-xs text-white/40">
                    Coach analysis will appear when it&apos;s your turn.
                  </div>
                }
              />
            </StickToBottomFeed>
          </Panel>
        )}

        <div className="flex min-h-0 min-w-0 flex-col gap-3 max-lg:order-1">
          <div className="grid shrink-0 gap-3 sm:grid-cols-2">
            {[
              {
                key: "p1" as const,
                label: `${playerName}'s Pokémon`,
                tag: "You",
                index: panelIndex.p1,
                p: battleState.p1Pokemon,
              },
              {
                key: "p2" as const,
                label: "Opponent",
                tag: isAiVsAi ? "P2 AI" : "CPU",
                index: panelIndex.p2,
                p: battleState.p2Pokemon,
              },
            ].map(({ key, label, tag, index, p }) => {
              const statusInfo = getStatusDisplay(p.status);
              const boosts = p.boosts;
              const itemLabel = formatItemName(p.item);
              const isUnknown = !p.name || p.name === "Unknown";

              return (
                <Panel key={label} className="group relative">
                  <PanelHeader title={label} index={index} label={tag} />
                  <div className="flex items-center gap-3 p-3">
                    <CornerFrame className="shrink-0 p-1">
                      {isUnknown ? (
                        <div className="flex h-16 w-16 items-center justify-center text-center font-mono text-[10px] text-white/40">
                          Switching...
                        </div>
                      ) : (
                        <BattlePokemonSprite
                          name={p.name}
                          alt={p.name}
                          className="h-16 w-16 object-contain"
                        />
                      )}
                    </CornerFrame>
                    <div className="min-w-0 flex-1 space-y-1.5">
                      <div className="flex items-baseline gap-2">
                        <span className="truncate text-[15px] font-semibold tracking-tight text-white">
                          {isUnknown ? "Switching..." : p.name}
                        </span>
                        {!isUnknown && (
                          <span className="shrink-0 font-mono text-[10px] text-white/40">
                            Lv.{p.level ?? 100}
                          </span>
                        )}
                        {statusInfo && (
                          <span
                            className={`shrink-0 self-center rounded-[3px] border px-1.5 py-px text-[10px] font-medium ${statusInfo.colorClass}`}
                          >
                            {statusInfo.emoji} {statusInfo.label}
                          </span>
                        )}
                      </div>
                      <div>
                        <div className="mb-1 flex justify-between font-mono text-[10.5px] text-white/50">
                          <span>HP</span>
                          <span className="tabular-nums text-white/75">
                            {Math.round(p.hp)}/{Math.round(p.maxHp)}
                          </span>
                        </div>
                        <div className="h-1.5 w-full rounded-[1px] bg-white/10">
                          <div
                            className={`h-1.5 rounded-[1px] transition-all duration-500 ${getHpBarClass(
                              currentHpPercents[key],
                            )}`}
                            style={{ width: `${currentHpPercents[key]}%` }}
                          />
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {p.ability && (
                          <span className="rounded-[3px] border border-white/10 bg-white/[0.03] px-1.5 py-0.5 text-[10px] text-white/60">
                            {p.ability}
                          </span>
                        )}
                        {itemLabel && (
                          <span className="inline-flex items-center gap-0.5 rounded-[3px] border border-white/10 bg-white/[0.03] px-1.5 py-0.5 text-[10px] text-white/75">
                            <ItemIcon item={itemLabel} className="-my-1.5 -ml-1" />
                            {itemLabel}
                          </span>
                        )}
                        {boosts &&
                          Object.entries(boosts).map(([stat, amt]) => (
                            <span
                              key={stat}
                              className={`rounded-[3px] border px-1.5 py-0.5 font-mono text-[10px] font-medium ${
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
                    <div className="pointer-events-none absolute left-1/2 top-full z-50 mt-1 hidden w-56 -translate-x-1/2 rounded-[4px] border border-white/15 bg-zinc-900 p-3 text-xs shadow-xl group-hover:block">
                      {p.types && p.types.length > 0 && (
                        <div className="mb-1.5 flex gap-1">
                          {p.types.map((t) => (
                            <span
                              key={t}
                              className="rounded-[3px] bg-white/10 px-1.5 py-0.5 text-[10px] font-medium text-white/80"
                            >
                              {t}
                            </span>
                          ))}
                        </div>
                      )}
                      <div className="text-white/60">
                        Level:{" "}
                        <span className="text-white/90">{p.level ?? 100}</span>
                      </div>
                      {p.ability && (
                        <div className="text-white/60">
                          Ability:{" "}
                          <span className="text-white/90">{p.ability}</span>
                        </div>
                      )}
                      {p.item && (
                        <div className="text-white/60">
                          Item:{" "}
                          <span className="inline-flex items-center align-middle text-white/90">
                            <ItemIcon item={p.item} className="-my-1.5 -ml-0.5" />
                            {p.item}
                          </span>
                        </div>
                      )}
                      <div className="text-white/60">
                        HP:{" "}
                        <span className="text-white/90">
                          {Math.round(p.hp)}/{Math.round(p.maxHp)}
                        </span>
                      </div>
                      {p.status && (
                        <div className="text-white/60">
                          Status:{" "}
                          <span className="text-white/90">{p.status}</span>
                        </div>
                      )}
                    </div>
                  )}
                </Panel>
              );
            })}
          </div>

          {battleState.isEnded && (
            <Panel className="min-h-0 flex-1 items-center justify-center px-4 py-8 text-center">
              <IndexTag index={panelIndex.action} label="Result" />
              <div className="mt-3 text-3xl font-semibold tracking-tight text-white">
                {battleState.winner ?? "Battle"} Wins
              </div>
              <div className="mt-2 text-sm text-white/55">Battle complete.</div>
            </Panel>
          )}

          {!battleState.isEnded && gameMode === "ai-vs-ai" && (
            <AiVsAiSpectatorPanel
              index={panelIndex.action}
              onContinue={onContinue}
              continuePending={continuePending}
              isPlaybackRunning={isPlaybackRunning}
              awaitingAckEventSeq={awaitingAckEventSeq}
              statusText={statusText}
              battleState={battleState}
            >
              <AiDecisionTrace
                entries={aiDecisionHistory}
                empty={
                  <div className="text-xs text-white/40">
                    Run a turn to see AI decisions.
                  </div>
                }
              />
            </AiVsAiSpectatorPanel>
          )}

          {!battleState.isEnded && gameMode !== "ai-vs-ai" && (
            <Panel className="@container min-h-0 flex-1">
              <PanelHeader
                title="Choose Your Action"
                index={panelIndex.action}
                label="Action"
                aside={
                  <span
                    className={cn(
                      "font-mono text-[10px] uppercase tracking-[0.12em]",
                      playerCanAct ? ACCENT_TEXT : "text-white/35",
                    )}
                  >
                    {playerCanAct ? "Your turn" : "Input locked"}
                  </span>
                }
              />
              <div className="min-h-0 flex-1 overflow-y-auto p-3">
                {battleState.phase === "team-preview" ? (
                  <div className="space-y-3">
                    <div className="text-xs text-white/55">
                      Submit your team order (digits 1-6, each once).
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <input
                        value={teamOrder}
                        onChange={(e) =>
                          setTeamOrder(
                            e.target.value.replace(/[^1-6]/g, "").slice(0, 6),
                          )
                        }
                        placeholder="123456"
                        className="rounded-[4px] border border-white/10 bg-black/40 px-3 py-1.5 font-mono text-sm text-white outline-none placeholder:text-white/30 focus:border-white/25"
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
                        className={cn(boxButtonClass, "py-1.5 text-sm")}
                      >
                        Confirm Team Order
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {!forcedSwitchForP1 &&
                      battleState.availableMoves.length > 0 && (
                        <div>
                          <div className="mb-1.5 font-mono text-[10px] uppercase tracking-[0.14em] text-white/40">
                            Moves
                          </div>
                          {battleState.availableMoves?.length === 1 &&
                            battleState.p1Pokemon.item &&
                            /choice/i.test(battleState.p1Pokemon.item) && (
                              <div className="mb-2 rounded-[4px] border border-amber-400/20 bg-amber-400/10 px-3 py-1.5 text-xs text-amber-300">
                                🔒 Locked into{" "}
                                {battleState.availableMoves[0]?.name} by{" "}
                                <ItemIcon
                                  item={battleState.p1Pokemon.item}
                                  className="-my-1.5"
                                />
                                {battleState.p1Pokemon.item}
                              </div>
                            )}
                          <div className="grid grid-cols-1 gap-2 @sm:grid-cols-2">
                            {battleState.availableMoves.map((move, index) => {
                              const choice =
                                move.choice ?? `move ${move.index ?? index + 1}`;
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
                                  className={actionButtonClass}
                                >
                                  <div className="flex items-baseline justify-between gap-2">
                                    <span className="truncate text-[13px] font-medium tracking-tight text-white">
                                      {move.name}
                                    </span>
                                    <span className="shrink-0 font-mono text-[10px] tabular-nums text-white/40">
                                      PP {move.pp}/{move.maxPp}
                                    </span>
                                  </div>
                                  <div className="mt-0.5 truncate font-mono text-[10.5px] text-white/50">
                                    {[
                                      move.type,
                                      move.category,
                                      move.power ? `BP ${move.power}` : null,
                                      `Acc ${
                                        move.accuracy === true
                                          ? "—"
                                          : (move.accuracy ?? "—")
                                      }`,
                                    ]
                                      .filter(Boolean)
                                      .join(" · ")}
                                  </div>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    {(battleState.availableSwitches?.length ?? 0) > 0 && (
                      <div>
                        <div className="mb-1.5 font-mono text-[10px] uppercase tracking-[0.14em] text-white/40">
                          Switch
                        </div>
                        <div className="grid grid-cols-1 gap-2 @sm:grid-cols-2 @3xl:grid-cols-3">
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
                              className={cn(
                                actionButtonClass,
                                "flex items-center gap-2 px-2.5 py-1.5",
                              )}
                            >
                              <OptionalBattleSprite
                                src={getSpriteFallbackUrl(option.name)}
                                alt={option.name}
                                width={32}
                                height={32}
                                className="-my-1 h-8 w-8 shrink-0 object-contain"
                              />
                              <div className="min-w-0 flex-1">
                                <div className="flex items-baseline gap-1.5">
                                  <span className="truncate text-[13px] font-medium tracking-tight text-white">
                                    {option.name}
                                  </span>
                                  <span className="shrink-0 font-mono text-[10px] text-white/35">
                                    Lv.{option.level ?? 100}
                                  </span>
                                  <span className="ml-auto shrink-0 font-mono text-[10px] tabular-nums text-white/50">
                                    HP {Math.round(option.hp ?? 0)}/
                                    {Math.round(option.maxHp ?? 0)}
                                    {option.status ? ` • ${option.status}` : ""}
                                  </span>
                                </div>
                                <div className="mt-0.5 flex min-w-0 items-center gap-x-1.5 text-[10px] text-white/40">
                                  {option.ability && (
                                    <span className="truncate">
                                      {option.ability}
                                    </span>
                                  )}
                                  {option.item && (
                                    <span className="inline-flex min-w-0 items-center">
                                      <ItemIcon
                                        item={option.item}
                                        className="-my-1.5 -ml-1"
                                      />
                                      <span className="truncate">
                                        {option.item}
                                      </span>
                                    </span>
                                  )}
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
                            onSubmitAction({
                              choice: "default",
                              label: "default",
                            })
                          }
                          disabled={!playerCanAct}
                          className={cn(boxButtonClass, "py-1.5 text-sm")}
                        >
                          Submit Default Action
                        </button>
                      )}
                    {battleState.phase === "awaiting-forced-switch-p2" &&
                      battleState.awaitingAckEventSeq == null && (
                        <button
                          type="button"
                          onClick={onContinue}
                          disabled={
                            continuePending ||
                            moveSubmitPending ||
                            isSubmittingMove
                          }
                          className={cn(boxButtonClass, "py-1.5 text-sm")}
                        >
                          {continuePending ? "Continuing..." : "Continue"}
                        </button>
                      )}
                  </div>
                )}
              </div>
              <div className="shrink-0 space-y-1.5 border-t border-white/[0.07] px-3 py-2 text-xs">
                <div className="flex min-w-0 items-center gap-2 text-white/70">
                  <span
                    className={cn(
                      "h-1.5 w-1.5 shrink-0 rounded-full",
                      playerCanAct ? ACCENT_BG : "bg-white/25",
                    )}
                  />
                  <span className="min-w-0">{statusText}</span>
                </div>
                {moveSubmitError && (
                  <div className="rounded-[4px] border border-white/10 bg-white/[0.02] px-2.5 py-1.5 text-white/65">
                    {moveSubmitError}
                  </div>
                )}
                {legalOptionsMessage && (
                  <div className="rounded-[4px] border border-white/10 bg-white/[0.02] px-2.5 py-1.5 text-[11px] text-white/60">
                    {legalOptionsMessage}
                  </div>
                )}
              </div>
            </Panel>
          )}
        </div>

        <div className="flex min-h-0 min-w-0 flex-col gap-3 max-lg:order-2">
          {showFlyStage && (
            <FlyBrainStage
              index={panelIndex.fly}
              diagnostics={battleState.lastCpuDecision?.flyCns}
              turn={battleState.lastCpuDecision?.turn}
              onOpenAnalysis={openAnalysis}
            />
          )}

          <CpuDecisionBar
            title={isAiVsAi ? "AI decisions" : "CPU decision"}
            index={panelIndex.analysis}
            lines={decisionLines}
            notice={
              <CpuRetryNotice
                retry={cpuRetry}
                decision={battleState.lastCpuDecision}
                variant="inline"
              />
            }
            onOpen={openAnalysis}
          />

          <Panel className="min-h-[120px] flex-1 max-lg:h-80 max-lg:flex-none">
            <PanelHeader
              title="Turn Log"
              index={panelIndex.log}
              label="Log"
              aside={
                <span className="font-mono text-[10px] tabular-nums text-white/40">
                  Acked {lastAckedSeq}
                  {awaitingAckEventSeq != null
                    ? ` · Pending ${awaitingAckEventSeq}`
                    : ""}
                </span>
              }
            />
            {playbackError && (
              <div className="shrink-0 border-b border-white/[0.07] px-3 py-2 text-xs text-white/65">
                {playbackError}
              </div>
            )}
            <div
              ref={loggerRef}
              className={cn("min-h-0 flex-1 overflow-y-auto px-3 py-2", feedFadeClass)}
            >
              <div className="space-y-3">
                {turnLogGroups
                  .filter((group) => group.turn <= 0)
                  .flatMap((group) => group.events)
                  .filter((event) => !isControlEvent(event.type))
                  .map((event) => (
                    <div
                      key={`opening-${event.seq}`}
                      className="text-[12.5px] leading-relaxed text-white/85"
                    >
                      {event.text}
                    </div>
                  ))}

                {turnLogGroups
                  .filter((group) => group.turn > 0)
                  .map((group) => (
                    <section key={`turn-${group.turn}`}>
                      <div className="mb-1 flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.14em] text-white/45">
                        <span>Turn {formatIndex(group.turn)}</span>
                        <span className="h-px flex-1 bg-white/10" />
                      </div>
                      <div className="space-y-1">
                        {group.events
                          .filter((event) => !isControlEvent(event.type))
                          .map((event) => (
                            <div
                              key={event.seq}
                              className={`text-[12.5px] leading-relaxed ${
                                awaitingAckEventSeq === event.seq
                                  ? "text-white"
                                  : event.seq <= lastAckedSeq
                                    ? "text-white/85"
                                    : "text-white/60"
                              }`}
                            >
                              {event.text}
                            </div>
                          ))}
                      </div>
                    </section>
                  ))}
                {turnLogGroups.length === 0 && (
                  <div className="text-xs text-white/50">No events yet.</div>
                )}
              </div>
            </div>
          </Panel>
        </div>
      </div>

      <CpuAnalysisSheet
        open={analysisOpen}
        onOpenChange={setAnalysisOpen}
        title={analysisTitle}
        subtitle={
          <>
            {CPU_PROFILE_BADGES[cpuModelProfile]}
            {cpuDecisionSummary?.modelId
              ? ` · ${cpuDecisionSummary.modelId}`
              : ""}
          </>
        }
      >
        <CpuRetryNotice
          retry={cpuRetry}
          decision={battleState.lastCpuDecision}
        />
        <StickToBottomFeed className="rounded-[4px] border border-white/10 bg-black/40 p-3">
          {isAiVsAi ? (
            <AiDecisionTrace
              entries={aiDecisionHistory}
              empty={
                <div className="text-xs text-white/40">
                  Run a turn to see AI decisions.
                </div>
              }
            />
          ) : (
            <div className="space-y-3">
              <AiDecisionTrace entries={aiDecisionHistory} />
              {cpuStream.isStreaming ? (
                <div className="space-y-3">
                  <div className="rounded-[4px] border border-blue-400/15 bg-blue-400/5 p-3">
                    <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-blue-300/70">
                      Thinking
                    </div>
                    <div className="mt-2 flex items-center gap-2 text-sm text-white/85">
                      <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-blue-300" />
                      {CPU_THINKING_LABELS[cpuThinkingIndex]}
                    </div>
                    <div className="mt-3 space-y-2 text-xs text-white/45">
                      <div>Preparing a structured recommendation.</div>
                      <div>
                        Raw streamed tokens are hidden until parsing finishes.
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div className="rounded-[4px] border border-white/10 bg-white/3 px-3 py-2">
                      <div className="text-[10px] uppercase tracking-[0.16em] text-white/40">
                        Source
                      </div>
                      <div className="mt-1 text-xs text-white/80">model</div>
                    </div>
                    <div className="rounded-[4px] border border-white/10 bg-white/3 px-3 py-2">
                      <div className="text-[10px] uppercase tracking-[0.16em] text-white/40">
                        Status
                      </div>
                      <div className="mt-1 text-xs text-white/80">
                        Streaming
                      </div>
                    </div>
                  </div>
                </div>
              ) : cpuDecisionSummary || finalCpuReasoning ? (
                // Reasoning, decision, latency, model, truncation and raw
                // output for each decision are in the trace above; this block
                // holds extras for the latest decision only.
                <div className="space-y-3">
                  {cpuModelProfile === "fly" &&
                    battleState.lastCpuDecision?.flyCns && (
                      <FlyCnsBrainPanel
                        diagnostics={battleState.lastCpuDecision.flyCns}
                      />
                    )}

                  {!hasStructuredCpuSummary &&
                    !cpuDecisionSummary?.truncated &&
                    !battleState.lastCpuDecision?.flyCns && (
                      <div className="rounded-[4px] border border-amber-400/15 bg-amber-400/5 px-3 py-2 text-xs text-amber-200/85">
                        Could not parse structured recommendation cleanly.
                      </div>
                    )}
                </div>
              ) : aiDecisionHistory.length === 0 ? (
                <div className="text-xs text-white/40">
                  {cpuStream.isAvailable
                    ? "Opponent analysis will appear after their move."
                    : "Live CPU stream unavailable. Final CPU decision will appear after their move."}
                </div>
              ) : null}
            </div>
          )}
        </StickToBottomFeed>
      </CpuAnalysisSheet>
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
    gameMode: "pvp",
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
  });
  const [battleId, setBattleId] = useState<string | null>(initialBattleId);
  const [activeBattleUi, setActiveBattleUi] = useState<ActiveBattleUiState>(
    () => readStoredBattleUiPrefs(initialBattleId) ?? DEFAULT_ACTIVE_BATTLE_UI,
  );
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
  const [animatedStatusText, setAnimatedStatusText] = useState<string | null>(
    null,
  );
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
      if (
        state.awaitingAckEventSeq != null ||
        state.phase === "awaiting-event-ack"
      )
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
  const copilotEnabled = battleId
    ? activeBattleUi.copilotEnabled
    : setup.copilotMode !== "off";

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
    playerNeedsToAct && copilotEnabled,
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
        gameMode: setup.gameMode,
        p1Team: usingRandomTeams
          ? []
          : setup.teamSource === "saved"
            ? teamToBattleRoster(selectedP1SavedTeam, setup.level)
            : setup.p1.selectedPokemon
              ? [
                  {
                    species: setup.p1.selectedPokemon.name,
                    ...(p1ResolvedAutoMoves
                      ? {}
                      : { moves: p1ResolvedSelectedMoves }),
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
                    ...(p2ResolvedAutoMoves
                      ? {}
                      : { moves: p2ResolvedSelectedMoves }),
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
      const nextBattleUi = {
        copilotEnabled: setup.copilotMode !== "off",
        copilotMode: setup.copilotMode,
        cpuModelProfile: setup.cpuModelProfile,
        gameMode: setup.gameMode,
      } satisfies ActiveBattleUiState;
      writeStoredBattleUiPrefs(state.battleId, nextBattleUi);
      setActiveBattleUi(nextBattleUi);
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
      setMoveUiError(
        withAckRefreshHint(
          (error as Error).message || "Failed to submit action",
        ),
      );
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
      setMoveUiError(
        withAckRefreshHint((error as Error).message || "Continue failed"),
      );
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
        for (let seq = 1; seq <= next; seq += 1)
          processedSeqRef.current.add(seq);
        return next;
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentionally keying on sub-properties to avoid over-firing
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
        const isAiVsAi = activeBattleUi.gameMode === "ai-vs-ai";
        const autoForcedSwitch =
          liveBattleState.awaitingAckEventSeq == null &&
          (liveBattleState.phase === "awaiting-forced-switch-p2" ||
            (isAiVsAi &&
              liveBattleState.phase === "awaiting-forced-switch-p1"));
        if (autoForcedSwitch && !sideNeedsMove(liveBattleState, "p1")) {
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

        let target = playbackEventsRef.current.find(
          (event) => event.seq === ackSeq,
        );
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
        const message = withAckRefreshHint(
          (error as Error).message || "Playback sync failed",
        );
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
  }, [
    battleId,
    liveBattleState,
    lastSeenSeq,
    lastAckedSeq,
    refetchBattleState,
  ]);

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
          <div className="text-sm font-medium text-white/70">
            Loading Battle
          </div>
          <div className="mt-2 text-sm text-white/55">
            Restoring battle state for{" "}
            <span className="font-mono">{battleId}</span>...
          </div>
          {stateQuery.error && (
            <div className="mt-4 rounded-lg border border-white/10 bg-white/2 px-3 py-2 text-sm text-white/65">
              {(stateQuery.error as Error).message}
            </div>
          )}
          <div className="mt-4 flex gap-2">
            <button
              type="button"
              onClick={() => stateQuery.refetch()}
              className="rounded-lg border border-white/10 bg-white/3 px-3 py-2 text-sm text-white/75 hover:bg-white/6"
            >
              Retry
            </button>
            <button
              type="button"
              onClick={() => router.push("/")}
              className="rounded-lg border border-white/10 bg-white/3 px-3 py-2 text-sm text-white/75 hover:bg-white/6"
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
        copilotEnabled={copilotEnabled}
        copilotMode={activeBattleUi.copilotMode}
        cpuModelProfile={activeBattleUi.cpuModelProfile}
        gameMode={activeBattleUi.gameMode}
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
          setActiveBattleUi(DEFAULT_ACTIVE_BATTLE_UI);
          isSubmittingMoveRef.current = false;
          isPlaybackBusyRef.current = false;
          lastContinueAtRef.current = 0;
          if (pathname !== "/") router.push("/");
        }}
      />
    );
  }

  const battleTypeOptions =
    setup.teamSource === "random"
      ? RANDOM_BATTLE_OPTIONS
      : STANDARD_BATTLE_OPTIONS;
  const battleTypeValue =
    setup.teamSource === "random"
      ? setup.randomBattleType
      : setup.standardBattleType;
  const selectedBattleType = battleTypeOptions.find(
    (option) => option.value === battleTypeValue,
  );
  const generationLabel =
    GENERATION_OPTIONS.find((option) => option.value === setup.generation)
      ?.label ?? setup.generation;
  const isAiVsAi = setup.gameMode === "ai-vs-ai";
  const effectiveCopilotMode = isAiVsAi ? "off" : setup.copilotMode;
  const copilotLabel =
    COPILOT_MODE_OPTIONS.find((option) => option.value === effectiveCopilotMode)
      ?.label ?? "Off";
  const cpuModelLabel =
    CPU_MODEL_OPTIONS.find((option) => option.value === setup.cpuModelProfile)
      ?.label ?? setup.cpuModelProfile;
  const savedTeams = teamsQuery.data ?? [];
  const sideTeamSummary = (side: SideKey) => {
    if (setup.teamSource === "random") return "Random team";
    if (setup.teamSource === "saved") {
      const team = side === "p1" ? selectedP1SavedTeam : selectedP2SavedTeam;
      return team
        ? `${team.name} · ${teamToBattleRoster(team, setup.level).length}`
        : "Not selected";
    }
    const pokemon = setup[side].selectedPokemon;
    if (!pokemon) return "Not selected";
    const sideSetup = setup[side];
    return `${pokemon.name} · ${
      sideSetup.autoMoves
        ? "auto moves"
        : sideSetup.selectedMoves.length
          ? `${sideSetup.selectedMoves.length} moves`
          : "no moves"
    }`;
  };
  const manualMovesWarning =
    setup.teamSource === "manual" &&
    (["p1", "p2"] as const).some(
      (side) =>
        setup[side].selectedPokemon &&
        !setup[side].autoMoves &&
        !setup[side].selectedMoves.length,
    );

  return (
    <div className="flex flex-col gap-3 lg:h-[calc(100dvh-5.75rem)] lg:min-h-[600px]">
      <Panel className="shrink-0 flex-row items-center justify-between gap-3 px-3 py-2">
        <div className="flex min-w-0 items-center gap-2.5">
          <SquareBadge>
            <Swords className="h-3.5 w-3.5" aria-hidden />
          </SquareBadge>
          <div className="min-w-0">
            <div className="text-[13px] font-medium leading-tight text-white">
              New battle
            </div>
            <div className="truncate font-mono text-[10px] uppercase tracking-[0.12em] text-white/40">
              {generationLabel}
              <span className="px-1 text-white/20">·</span>
              {selectedBattleType?.label ?? battleTypeValue}
              <span className="px-1 text-white/20">·</span>
              {isAiVsAi ? "AI vs AI" : "vs CPU"}
              <span className="px-1 text-white/20">·</span>
              {CPU_PROFILE_BADGES[setup.cpuModelProfile]}
            </div>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-3">
          <IndexTag label="Setup" className="max-sm:hidden" />
          <Link href="/teambuilder" className={boxButtonClass}>
            Teambuilder
          </Link>
        </div>
      </Panel>

      <div className="grid min-h-0 flex-1 gap-3 lg:grid-cols-[minmax(0,1fr)_320px] lg:grid-rows-[minmax(0,1fr)] xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="flex min-h-0 min-w-0 flex-col gap-3 lg:overflow-y-auto">
          <div className="grid shrink-0 gap-3 md:grid-cols-2">
            <Panel>
              <PanelHeader title="Format" index={1} label="Format" />
              <div className="space-y-3 p-3">
                <div>
                  <FieldLabel>Team source</FieldLabel>
                  <SegmentedControl
                    ariaLabel="Team source"
                    value={setup.teamSource}
                    onChange={(teamSource) =>
                      setSetup((prev) => ({ ...prev, teamSource }))
                    }
                    options={[
                      {
                        value: "random",
                        label: "Random",
                        title: "Showdown random teams",
                        icon: <Shuffle className="h-3.5 w-3.5" aria-hidden />,
                      },
                      {
                        value: "saved",
                        label: "Saved",
                        title: "Use saved teams",
                        icon: <Library className="h-3.5 w-3.5" aria-hidden />,
                      },
                      {
                        value: "manual",
                        label: "Manual",
                        title: "Manual single Pokémon",
                        icon: <Crosshair className="h-3.5 w-3.5" aria-hidden />,
                      },
                    ]}
                  />
                  <p className="mt-1.5 text-[11px] leading-snug text-white/40">
                    {setup.teamSource === "random"
                      ? "Showdown generates random teams for the selected generation."
                      : setup.teamSource === "saved"
                        ? "Choose saved teams from the teambuilder for both sides."
                        : "Pick one Pokémon per side for a fast manual test battle."}
                  </p>
                </div>

                <div>
                  <FieldLabel aside={generationLabel}>Generation</FieldLabel>
                  <TileGroup
                    ariaLabel="Generation"
                    className="grid-cols-9"
                    tileClassName="px-0 font-mono text-[11px]"
                    value={setup.generation}
                    onChange={(generation) =>
                      setSetup((prev) => ({ ...prev, generation }))
                    }
                    options={GENERATION_OPTIONS.map((option) => ({
                      value: option.value,
                      label: option.value.replace("gen", ""),
                      title: option.label,
                    }))}
                  />
                </div>

                <div>
                  <FieldLabel>
                    {setup.teamSource === "random"
                      ? "Random battle type"
                      : "Battle type"}
                  </FieldLabel>
                  <TileGroup
                    ariaLabel="Battle type"
                    className={
                      setup.teamSource === "random"
                        ? "grid-cols-2"
                        : "grid-cols-3 sm:grid-cols-5 md:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-5"
                    }
                    tileClassName={
                      setup.teamSource === "random"
                        ? undefined
                        : "px-1 text-[11px]"
                    }
                    value={battleTypeValue}
                    onChange={(value) =>
                      setSetup((prev) => ({
                        ...prev,
                        ...(prev.teamSource === "random"
                          ? { randomBattleType: value }
                          : { standardBattleType: value }),
                      }))
                    }
                    options={battleTypeOptions.map((option) => ({
                      value: option.value,
                      label: option.label,
                      title: option.description,
                    }))}
                  />
                  <p className="mt-1.5 truncate text-[11px] text-white/40">
                    {selectedBattleType?.description}
                  </p>
                </div>
              </div>
            </Panel>

            <Panel>
              <PanelHeader title="Opponent" index={2} label="CPU" />
              <div className="space-y-3 p-3">
                <div>
                  <FieldLabel>Game mode</FieldLabel>
                  <SegmentedControl
                    ariaLabel="Game mode"
                    value={setup.gameMode}
                    onChange={(gameMode) =>
                      setSetup((prev) => ({
                        ...prev,
                        gameMode,
                        ...(gameMode === "ai-vs-ai"
                          ? { copilotMode: "off" as const }
                          : {}),
                      }))
                    }
                    options={[
                      {
                        value: "pvp",
                        label: "Player vs CPU",
                        icon: <UserRound className="h-3.5 w-3.5" aria-hidden />,
                      },
                      {
                        value: "ai-vs-ai",
                        label: "AI vs AI",
                        icon: <Bot className="h-3.5 w-3.5" aria-hidden />,
                      },
                    ]}
                  />
                </div>

                <div>
                  <FieldLabel>CPU model</FieldLabel>
                  <div
                    role="radiogroup"
                    aria-label="CPU model"
                    className="grid gap-1.5 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2"
                  >
                    {CPU_MODEL_OPTIONS.map((option, optionIndex) => {
                      const selected = setup.cpuModelProfile === option.value;
                      const isFly = option.value === "fly";
                      return (
                        <OptionCard
                          key={option.value}
                          index={optionIndex + 1}
                          label={option.label}
                          description={option.description}
                          selected={selected}
                          onSelect={() =>
                            setSetup((prev) => ({
                              ...prev,
                              cpuModelProfile: option.value,
                            }))
                          }
                          icon={
                            isFly ? undefined : option.value === "fast" ? (
                              <Zap
                                className="h-3.5 w-3.5 shrink-0 text-white/45"
                                aria-hidden
                              />
                            ) : (
                              <BrainCircuit
                                className="h-3.5 w-3.5 shrink-0 text-white/45"
                                aria-hidden
                              />
                            )
                          }
                          tag={
                            isFly ? (
                              <>
                                <span className={ACCENT_TEXT}>Connectome</span>{" "}
                                <span className="text-white/20">·</span> spiking
                                policy
                              </>
                            ) : (
                              "Language model"
                            )
                          }
                          art={
                            isFly ? (
                              <FlyBrainMotif
                                active={selected}
                                className="h-[68px] w-[100px] xl:h-[76px] xl:w-[124px]"
                              />
                            ) : undefined
                          }
                          className={
                            isFly
                              ? "sm:col-span-2 lg:col-span-1 xl:col-span-2"
                              : undefined
                          }
                        />
                      );
                    })}
                  </div>
                </div>
              </div>
            </Panel>
          </div>

          <Panel className="min-h-[260px] flex-1">
            <PanelHeader
              title={
                setup.teamSource === "random"
                  ? "Teams"
                  : setup.teamSource === "saved"
                    ? "Saved teams"
                    : "Pokémon"
              }
              index={4}
              label={
                setup.teamSource === "random"
                  ? "Random"
                  : setup.teamSource === "saved"
                    ? "Teambuilder"
                    : "Manual"
              }
              aside={
                setup.teamSource === "saved" &&
                teamsQuery.isFetching && (
                  <span className="text-[11px] text-white/40">
                    Loading teams…
                  </span>
                )
              }
            />
            <div className="min-h-0 flex-1 overflow-y-auto">
              {setup.teamSource === "random" && (
                <RandomTeamsPreview
                  playerName={playerName}
                  formatId={resolvedFormats.randomTeamFormatid}
                  battleTypeLabel={selectedBattleType?.label ?? "random"}
                  sides={{
                    p1Control: isAiVsAi ? "AI" : "You",
                    p2Control: cpuModelLabel,
                    coach: copilotLabel,
                  }}
                />
              )}

              {setup.teamSource === "saved" &&
                (savedTeams.length ? (
                  <div className="grid gap-4 p-3 md:grid-cols-2">
                    <SavedTeamPicker
                      badge="P1"
                      title={`${playerName} team`}
                      accent
                      teams={savedTeams}
                      selectedId={setup.p1SavedTeamId}
                      onSelect={(teamId) =>
                        setSetup((prev) => ({ ...prev, p1SavedTeamId: teamId }))
                      }
                    />
                    <SavedTeamPicker
                      badge="P2"
                      title="CPU team"
                      teams={savedTeams}
                      selectedId={setup.p2SavedTeamId}
                      onSelect={(teamId) =>
                        setSetup((prev) => ({ ...prev, p2SavedTeamId: teamId }))
                      }
                    />
                  </div>
                ) : teamsQuery.isFetching ? (
                  <div className="p-3 text-[12px] text-white/45">
                    Loading saved teams…
                  </div>
                ) : (
                  <SavedTeamsEmpty
                    message={
                      teamsQuery.error
                        ? (teamsQuery.error as Error).message
                        : "No saved teams found. Build one in the teambuilder first."
                    }
                  />
                ))}

              {setup.teamSource === "manual" && (
                <div className="grid gap-4 p-3 md:grid-cols-2">
                  <PokemonSetupPanel
                    side="p1"
                    label={`${playerName}'s Pokémon`}
                    setup={setup.p1}
                    onQueryChange={(value) =>
                      updateSide("p1", (prev) => ({ ...prev, query: value }))
                    }
                    onSelectPokemon={(pokemon) =>
                      handleSelectPokemon("p1", pokemon)
                    }
                    onClearPokemon={() =>
                      updateSide("p1", () => ({
                        query: "",
                        selectedPokemon: null,
                        selectedMoves: [],
                        autoMoves: true,
                      }))
                    }
                    onToggleMove={(moveName) =>
                      handleToggleMove("p1", moveName)
                    }
                    onClearMoves={() =>
                      updateSide("p1", (prev) => ({
                        ...prev,
                        selectedMoves: [],
                        autoMoves: false,
                      }))
                    }
                    onSetAutoMoves={(value) =>
                      updateSide("p1", (prev) => ({
                        ...prev,
                        autoMoves: value,
                      }))
                    }
                    searchResults={p1SearchQuery.data ?? []}
                    searchLoading={p1SearchQuery.isFetching}
                    searchError={
                      p1SearchQuery.error
                        ? (p1SearchQuery.error as Error).message
                        : null
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
                    onSelectPokemon={(pokemon) =>
                      handleSelectPokemon("p2", pokemon)
                    }
                    onClearPokemon={() =>
                      updateSide("p2", () => ({
                        query: "",
                        selectedPokemon: null,
                        selectedMoves: [],
                        autoMoves: true,
                      }))
                    }
                    onToggleMove={(moveName) =>
                      handleToggleMove("p2", moveName)
                    }
                    onClearMoves={() =>
                      updateSide("p2", (prev) => ({
                        ...prev,
                        selectedMoves: [],
                        autoMoves: false,
                      }))
                    }
                    onSetAutoMoves={(value) =>
                      updateSide("p2", (prev) => ({
                        ...prev,
                        autoMoves: value,
                      }))
                    }
                    searchResults={p2SearchQuery.data ?? []}
                    searchLoading={p2SearchQuery.isFetching}
                    searchError={
                      p2SearchQuery.error
                        ? (p2SearchQuery.error as Error).message
                        : null
                    }
                    details={p2DetailsQuery.data ?? null}
                    moves={p2MovesQuery.data?.moves ?? []}
                    recommendedMoves={p2MovesQuery.data?.recommendedMoves ?? []}
                    movesLoading={p2MovesQuery.isFetching}
                  />
                </div>
              )}
            </div>
          </Panel>
        </div>

        <div className="flex min-h-0 min-w-0 flex-col gap-3">
          <Panel className="shrink-0">
            <PanelHeader title="Coach" index={3} label="Co-pilot" />
            <div
              role="radiogroup"
              aria-label="Co-pilot mode"
              className="space-y-1.5 p-3"
            >
              {COPILOT_MODE_OPTIONS.map((option) => (
                <RadioRow
                  key={option.value}
                  label={option.label}
                  description={option.description}
                  selected={effectiveCopilotMode === option.value}
                  disabled={isAiVsAi}
                  onSelect={() =>
                    setSetup((prev) => ({ ...prev, copilotMode: option.value }))
                  }
                />
              ))}
              {isAiVsAi && (
                <p className="pt-0.5 text-[11px] text-white/40">
                  The coach is off while AI plays both sides.
                </p>
              )}
            </div>
          </Panel>

          <Panel className="min-h-0 flex-1">
            <PanelHeader
              title="Summary"
              index={5}
              label={setupReady ? "Ready" : "Incomplete"}
            />
            <div className="min-h-0 flex-1 overflow-y-auto px-3 py-2">
              <RecapRow
                index={1}
                label="Format"
                value={`${generationLabel} ${selectedBattleType?.label ?? battleTypeValue}`}
              />
              <RecapRow index={2} label="You" value={sideTeamSummary("p1")} />
              <RecapRow
                index={3}
                label="CPU"
                value={
                  isAiVsAi
                    ? `AI · ${sideTeamSummary("p2")}`
                    : sideTeamSummary("p2")
                }
              />
              <RecapRow index={4} label="Model" value={cpuModelLabel} />
              <RecapRow index={5} label="Coach" value={copilotLabel} />
              <RecapRow
                index={6}
                label="Seed"
                value={
                  setup.teamSource !== "random"
                    ? "—"
                    : setup.randomSeedInput.trim() || "Random"
                }
              />

              <Collapsible className="mt-2 rounded-[4px] border border-white/10">
                <CollapsibleTrigger className="group flex w-full items-center justify-between gap-2 px-2.5 py-2 text-left focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-white/40">
                  <span className="flex items-center gap-2 text-[12px] text-white/70">
                    <SlidersHorizontal
                      className="h-3.5 w-3.5 text-white/40"
                      aria-hidden
                    />
                    Advanced
                  </span>
                  <span className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.14em] text-white/35">
                    IDs · seed
                    <ChevronDown
                      className="h-3.5 w-3.5 transition-transform group-data-[state=open]:rotate-180"
                      aria-hidden
                    />
                  </span>
                </CollapsibleTrigger>
                <CollapsibleContent className="space-y-2.5 border-t border-white/[0.07] px-2.5 py-2.5">
                  <div>
                    <FieldLabel>Battle format ID</FieldLabel>
                    <div className="truncate rounded-[4px] border border-white/10 bg-black/35 px-2 py-1 font-mono text-[11.5px] text-white/80">
                      {resolvedFormats.formatid}
                    </div>
                  </div>
                  <div>
                    <FieldLabel>Random team format ID</FieldLabel>
                    <div className="truncate rounded-[4px] border border-white/10 bg-black/35 px-2 py-1 font-mono text-[11.5px] text-white/80">
                      {resolvedFormats.randomTeamFormatid}
                    </div>
                  </div>
                  <label className="block">
                    <FieldLabel
                      aside={
                        setup.teamSource === "random"
                          ? "4 numbers"
                          : "Random teams only"
                      }
                    >
                      Random seed
                    </FieldLabel>
                    <input
                      value={setup.randomSeedInput}
                      onChange={(e) =>
                        setSetup((prev) => ({
                          ...prev,
                          randomSeedInput: e.target.value,
                        }))
                      }
                      className="h-7 w-full rounded-[4px] border border-white/10 bg-black/40 px-2 font-mono text-[11.5px] text-white outline-none placeholder:text-white/30 focus:border-white/25 disabled:opacity-50"
                      placeholder="1,2,3,4"
                      disabled={setup.teamSource !== "random"}
                    />
                    <span className="mt-1 block text-[11px] leading-snug text-white/40">
                      Optional seed for deterministic battles (useful for
                      debugging or reproducing matches).
                    </span>
                  </label>
                </CollapsibleContent>
              </Collapsible>
            </div>

            <div className="shrink-0 space-y-2 border-t border-white/[0.07] p-3">
              {startBattleMutation.error && (
                <div className="max-h-24 overflow-y-auto rounded-[4px] border border-red-400/25 bg-red-500/[0.06] px-2.5 py-1.5 text-[11.5px] text-red-200/80">
                  {(startBattleMutation.error as Error).message}
                </div>
              )}
              {!setupReady ? (
                <p className="text-[11px] leading-snug text-white/45">
                  {setup.teamSource === "saved"
                    ? "Select a saved team for both P1 and CPU to continue."
                    : setup.teamSource === "manual"
                      ? "Select Pokémon for both P1 and P2 to continue."
                      : "Choose a valid setup to continue."}
                </p>
              ) : (
                manualMovesWarning && (
                  <p className="text-[11px] leading-snug text-white/45">
                    A side has no moves selected; the backend may reject it
                    unless auto-pick is on.
                  </p>
                )
              )}
              <button
                type="button"
                onClick={() => startBattleMutation.mutate()}
                disabled={!setupReady || startBattleMutation.isPending}
                className={cn(
                  "flex h-11 w-full items-center justify-between gap-2 rounded-[5px] px-3.5 text-[13.5px] font-medium text-white transition-[filter,opacity] hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:brightness-100",
                  ACCENT_BG,
                )}
              >
                <span className="flex items-center gap-2">
                  {startBattleMutation.isPending ? (
                    <LoaderCircle
                      className="h-4 w-4 animate-spin"
                      aria-hidden
                    />
                  ) : (
                    <Play className="h-4 w-4 fill-current" aria-hidden />
                  )}
                  {startBattleMutation.isPending
                    ? "Starting battle..."
                    : "Start battle"}
                </span>
                <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-white/70">
                  {resolvedFormats.formatid}
                </span>
              </button>
            </div>
          </Panel>
        </div>
      </div>
    </div>
  );
}
