"use client";

import {
  AlertTriangleIcon,
  BrainIcon,
  CpuIcon,
  FileCodeIcon,
  FlagIcon,
  ShieldIcon,
  SparklesIcon,
  SwordsIcon,
  TargetIcon,
  TimerIcon,
} from "lucide-react";
import { useState, type ReactNode } from "react";

import {
  AnalysisTrace,
  type AnalysisTraceItem,
  type AnalysisTraceStep,
} from "@/components/analysis-trace";

// ---------------------------------------------------------------------------
// AI decisions (CPU opponent, and both sides in AI vs AI)
// ---------------------------------------------------------------------------

/** The fields of a CPU/AI decision that the trace shows. */
export type AiDecisionSummary = {
  turn?: number;
  modelId?: string;
  latencyMs?: number;
  source?: string;
  choice?: string;
  actionType?: string;
  moveName?: string;
  error?: string;
  truncated?: boolean;
};

export type AiDecisionTraceInput = {
  /** Stable side key, e.g. "p1" or "p2". */
  side: string;
  /** Display label, e.g. "CPU" or "P1 (AI)". */
  label: string;
  tone: "blue" | "rose";
  decision: AiDecisionSummary | null | undefined;
  reasoning: string | null | undefined;
  rawOutput: string | null | undefined;
};

export type AiDecisionTraceEntry = {
  id: string;
  side: string;
  label: string;
  tone: "blue" | "rose";
  decision: AiDecisionSummary | null;
  reasoning: string | null;
  rawOutput: string | null;
};

const MAX_HISTORY = 60;

function pickDecision(
  decision: AiDecisionSummary | null | undefined,
): AiDecisionSummary | null {
  if (!decision) return null;
  // Copy only the displayed fields so the history (and its change signature)
  // never holds large payloads such as raw responses or diagnostics.
  return {
    turn: decision.turn,
    modelId: decision.modelId,
    latencyMs: decision.latencyMs,
    source: decision.source,
    choice: decision.choice,
    actionType: decision.actionType,
    moveName: decision.moveName,
    error: decision.error,
    truncated: decision.truncated,
  };
}

function toEntry(input: AiDecisionTraceInput): AiDecisionTraceEntry | null {
  const decision = pickDecision(input.decision);
  const reasoning = input.reasoning?.trim() || null;
  if (!decision && !reasoning) return null;
  const what =
    decision?.choice ?? decision?.moveName ?? decision?.actionType ?? "note";
  return {
    id: `${input.side}:${decision?.turn ?? "?"}:${what}`,
    side: input.side,
    label: input.label,
    tone: input.tone,
    decision,
    reasoning,
    rawOutput: input.rawOutput?.trim() || null,
  };
}

function mergeEntries(
  base: AiDecisionTraceEntry[],
  incoming: AiDecisionTraceEntry[],
): AiDecisionTraceEntry[] {
  let next = base;
  for (const entry of incoming) {
    const index = next.findIndex((existing) => existing.id === entry.id);
    if (index === -1) {
      next = [...next, entry];
      continue;
    }
    const existing = next[index];
    // The same decision can arrive from the live stream and from the battle
    // state; keep whichever fields are filled in.
    const merged: AiDecisionTraceEntry = {
      ...entry,
      decision: entry.decision ?? existing.decision,
      reasoning: entry.reasoning ?? existing.reasoning,
      rawOutput: entry.rawOutput ?? existing.rawOutput,
    };
    next = next.map((item, i) => (i === index ? merged : item));
  }
  return next.slice(-MAX_HISTORY);
}

/**
 * Accumulates the latest AI decisions into a per-battle history. The battle
 * state only carries the last decision per side, so each new one is appended
 * as it shows up. `resetKey` (e.g. the battle id) clears the history.
 */
export function useAiDecisionHistory(
  resetKey: string | null,
  inputs: Array<AiDecisionTraceInput | null | undefined>,
): AiDecisionTraceEntry[] {
  const incoming = inputs
    .map((input) => (input ? toEntry(input) : null))
    .filter((entry): entry is AiDecisionTraceEntry => entry !== null);
  const signature = JSON.stringify([resetKey, incoming]);

  const [state, setState] = useState(() => ({
    signature,
    resetKey,
    entries: mergeEntries([], incoming),
  }));

  if (state.signature !== signature) {
    const base = state.resetKey === resetKey ? state.entries : [];
    const entries = mergeEntries(base, incoming);
    setState({ signature, resetKey, entries });
    return entries;
  }
  return state.entries;
}

const TONE_ICON_CLASS = {
  blue: "text-blue-300/80",
  rose: "text-rose-300/80",
} as const;

function decisionLabel(decision: AiDecisionSummary | null) {
  if (!decision) return "No decision";
  if (decision.moveName) return decision.moveName;
  return decision.choice ?? decision.actionType ?? "Decision";
}

function formatLatency(latencyMs: number | undefined) {
  if (latencyMs == null) return null;
  return latencyMs >= 1000
    ? `${(latencyMs / 1000).toFixed(1)} s`
    : `${Math.round(latencyMs)} ms`;
}

function ReasoningText({ children }: { children: ReactNode }) {
  return <div className="whitespace-pre-wrap text-white/70">{children}</div>;
}

function aiDecisionToTraceItem(entry: AiDecisionTraceEntry): AnalysisTraceItem {
  const { decision } = entry;
  const iconClass = TONE_ICON_CLASS[entry.tone];
  const latency = formatLatency(decision?.latencyMs);
  const isFallback = decision?.source === "fallback";
  const steps: AnalysisTraceStep[] = [];

  if (entry.reasoning) {
    steps.push({
      id: "reasoning",
      icon: <BrainIcon />,
      title: "Reasoning",
      detail: <ReasoningText>{entry.reasoning}</ReasoningText>,
      defaultOpen: true,
    });
  }
  if (decision) {
    steps.push({
      id: "decision",
      icon: <TargetIcon />,
      title: `Decision · ${decisionLabel(decision)}`,
      description: [
        decision.choice && decision.choice !== decisionLabel(decision)
          ? decision.choice
          : null,
        isFallback ? "fallback" : null,
      ]
        .filter(Boolean)
        .join(" · "),
    });
  }
  if (decision?.truncated) {
    steps.push({
      id: "truncated",
      icon: <AlertTriangleIcon />,
      title: "Output truncated (reasoning used most of the token budget)",
      status: "error",
    });
  }
  if (decision?.error) {
    steps.push({
      id: "error",
      icon: <AlertTriangleIcon />,
      title: "Error",
      detail: <ReasoningText>{decision.error}</ReasoningText>,
      status: "error",
    });
  }
  if (latency) {
    steps.push({
      id: "latency",
      icon: <TimerIcon />,
      title: "Latency",
      description: latency,
    });
  }
  if (decision?.modelId) {
    steps.push({
      id: "model",
      icon: <CpuIcon />,
      title: (
        <>
          Model · <span className="font-mono">{decision.modelId}</span>
        </>
      ),
    });
  }
  if (entry.rawOutput) {
    steps.push({
      id: "raw",
      icon: <FileCodeIcon />,
      title: "Raw model output",
      detail: (
        <pre className="max-h-48 overflow-y-auto whitespace-pre-wrap font-mono text-[10px] text-white/55">
          {entry.rawOutput}
        </pre>
      ),
    });
  }

  const turn = decision?.turn != null ? `T${decision.turn} · ` : "";
  return {
    id: entry.id,
    icon: <SparklesIcon className={iconClass} />,
    title: `${turn}${entry.label} · ${decisionLabel(decision)}`,
    description: latency,
    status: decision?.error ? "error" : undefined,
    steps,
  };
}

/** Compact history of CPU/AI decisions, newest expanded. */
export function AiDecisionTrace({
  entries,
  empty,
  className,
}: {
  entries: AiDecisionTraceEntry[];
  empty?: ReactNode;
  className?: string;
}) {
  return (
    <AnalysisTrace
      items={entries.map(aiDecisionToTraceItem)}
      empty={empty}
      className={className}
    />
  );
}

// ---------------------------------------------------------------------------
// Battle coach (copilot)
// ---------------------------------------------------------------------------

type CoachAlternative = { action: string; label: string; reason: string };

export type CoachTraceEntry = {
  turn: number;
  phase: string;
  guidance: {
    recommendedAction: string;
    recommendedLabel: string;
    confidence: "high" | "medium" | "low";
    reasoning: string;
    safeAlternative: CoachAlternative | null;
    aggressiveAlternative: CoachAlternative | null;
    mainRisk: string;
    winConditionNote: string;
    modelId?: string;
    copilotMode?: string;
    latencyMs?: number;
    source?: "model" | "extractor" | "fallback";
  };
};

const CONFIDENCE_CLASS = {
  high: "text-emerald-400",
  medium: "text-amber-400",
  low: "text-red-400",
} as const;

function coachEntryToTraceItem(
  entry: CoachTraceEntry,
  index: number,
): AnalysisTraceItem {
  const g = entry.guidance;
  const latency = formatLatency(g.latencyMs);
  const confidence = (
    <span className={CONFIDENCE_CLASS[g.confidence]}>{g.confidence}</span>
  );
  const steps: AnalysisTraceStep[] = [
    {
      id: "decision",
      icon: <TargetIcon />,
      title: `Play · ${g.recommendedLabel || g.recommendedAction}`,
      description: confidence,
    },
  ];

  if (g.reasoning) {
    steps.push({
      id: "reasoning",
      icon: <BrainIcon />,
      title: "Reasoning",
      detail: <ReasoningText>{g.reasoning}</ReasoningText>,
      defaultOpen: true,
    });
  }
  if (g.safeAlternative) {
    steps.push({
      id: "safe",
      icon: <ShieldIcon className="text-emerald-400/70" />,
      title: `Safe · ${g.safeAlternative.label}`,
      detail: <ReasoningText>{g.safeAlternative.reason}</ReasoningText>,
    });
  }
  if (g.aggressiveAlternative) {
    steps.push({
      id: "aggro",
      icon: <SwordsIcon className="text-red-400/70" />,
      title: `Aggro · ${g.aggressiveAlternative.label}`,
      detail: <ReasoningText>{g.aggressiveAlternative.reason}</ReasoningText>,
    });
  }
  if (g.mainRisk) {
    steps.push({
      id: "risk",
      icon: <AlertTriangleIcon className="text-amber-400/70" />,
      title: `Risk · ${g.mainRisk}`,
      detail: <ReasoningText>{g.mainRisk}</ReasoningText>,
    });
  }
  if (g.winConditionNote) {
    steps.push({
      id: "wincon",
      icon: <FlagIcon className="text-purple-400/70" />,
      title: `Win con · ${g.winConditionNote}`,
      detail: <ReasoningText>{g.winConditionNote}</ReasoningText>,
    });
  }
  if (g.source === "fallback") {
    steps.push({
      id: "fallback",
      icon: <AlertTriangleIcon />,
      title: "Coach model failed; showing fallback guidance",
      status: "error",
    });
  }
  if (latency) {
    steps.push({
      id: "latency",
      icon: <TimerIcon />,
      title: "Latency",
      description: latency,
    });
  }
  if (g.modelId) {
    steps.push({
      id: "model",
      icon: <CpuIcon />,
      title: (
        <>
          Model · <span className="font-mono">{g.modelId}</span>
        </>
      ),
      description:
        g.source === "extractor" ? "via extractor" : (g.copilotMode ?? null),
    });
  }

  return {
    id: `coach:${index}:${entry.turn}:${entry.phase}`,
    icon: <SparklesIcon className="text-blue-300/80" />,
    title: `T${entry.turn} · ${g.recommendedLabel || g.recommendedAction}`,
    description: confidence,
    status: g.source === "fallback" ? "error" : undefined,
    steps,
  };
}

/** Compact history of coach guidance, newest expanded. */
export function CoachTrace({
  entries,
  loading,
  loadingTurn,
  empty,
  className,
}: {
  entries: CoachTraceEntry[];
  loading?: boolean;
  loadingTurn?: number;
  empty?: ReactNode;
  className?: string;
}) {
  return (
    <AnalysisTrace
      items={entries.map(coachEntryToTraceItem)}
      pending={
        loading
          ? {
              icon: <SparklesIcon className="text-blue-300/80" />,
              title:
                loadingTurn != null
                  ? `Analyzing turn ${loadingTurn}…`
                  : "Analyzing…",
            }
          : null
      }
      empty={empty}
      className={className}
    />
  );
}
