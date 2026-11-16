"use client";

import { useEffect, useState } from "react";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:5200/api";

type Side = "p1" | "p2";

type RetryEvent = {
  side?: Side;
  turn: number;
  attempt: number;
  maxAttempts: number;
  delayMs?: number;
  error?: string;
};

type RetrySettledEvent = {
  side?: Side;
  turn: number;
  attempts: number;
};

export type LiveRetry = RetryEvent & { battleId: string };

type DecisionLike = {
  source?: string;
  attempts?: number;
  reasoning?: string;
} | null;

/**
 * Listens to the battle's CPU stream for `retry` / `retry-settled` events and
 * returns the retry in progress for `side`, if any.
 */
export function useLiveCpuRetry(
  battleId: string | null | undefined,
  side: Side = "p2",
): LiveRetry | null {
  const [liveRetry, setLiveRetry] = useState<LiveRetry | null>(null);
  useEffect(() => {
    if (
      !battleId ||
      typeof window === "undefined" ||
      typeof window.EventSource === "undefined"
    ) {
      return;
    }
    const eventSource = new window.EventSource(
      `${API_URL}/battle/${battleId}/cpu-stream`,
    );
    const parse = <T,>(event: MessageEvent<string>): T | null => {
      try {
        return JSON.parse(event.data) as T;
      } catch {
        return null;
      }
    };
    const matchesSide = (eventSide: Side | undefined) =>
      (eventSide ?? "p2") === side;

    const handleRetry = (event: MessageEvent<string>) => {
      const data = parse<RetryEvent>(event);
      if (!data || !matchesSide(data.side)) return;
      setLiveRetry({ ...data, battleId });
    };
    const handleSettled = (event: MessageEvent<string>) => {
      const data = parse<RetrySettledEvent>(event);
      if (!data || !matchesSide(data.side)) return;
      setLiveRetry(null);
    };

    eventSource.addEventListener("retry", handleRetry as EventListener);
    eventSource.addEventListener(
      "retry-settled",
      handleSettled as EventListener,
    );
    return () => {
      eventSource.removeEventListener("retry", handleRetry as EventListener);
      eventSource.removeEventListener(
        "retry-settled",
        handleSettled as EventListener,
      );
      eventSource.close();
    };
  }, [battleId, side]);

  return liveRetry && liveRetry.battleId === battleId ? liveRetry : null;
}

/**
 * Shows when the CPU's model call is being retried ("Retrying (2/3)…"), and afterwards
 * whether the decision needed retries or fell back after them.
 * Listens to the battle's CPU stream for `retry` / `retry-settled` events.
 */
export function CpuRetryStatus({
  battleId,
  decision,
  side = "p2",
  variant,
}: {
  battleId: string | null | undefined;
  decision: DecisionLike | undefined;
  side?: Side;
  variant?: "block" | "inline";
}) {
  const retry = useLiveCpuRetry(battleId, side);
  return <CpuRetryNotice retry={retry} decision={decision} variant={variant} />;
}

/**
 * The retry notice for a retry from `useLiveCpuRetry`. `inline` is a single
 * line for compact rows; `block` (the default) also shows the last error.
 */
export function CpuRetryNotice({
  retry,
  decision,
  variant = "block",
}: {
  retry: LiveRetry | null;
  decision: DecisionLike | undefined;
  variant?: "block" | "inline";
}) {

  const inline = variant === "inline";

  if (retry) {
    if (inline) {
      return (
        <div
          role="status"
          aria-live="polite"
          className="flex min-w-0 items-center gap-2 font-mono text-[11px] text-amber-200/90"
          title={retry.error ? `Last error: ${retry.error}` : undefined}
        >
          <span className="inline-block h-1.5 w-1.5 shrink-0 animate-pulse rounded-full bg-amber-300" />
          <span className="truncate">
            Retrying ({retry.attempt}/{retry.maxAttempts})…
            {retry.error ? ` ${retry.error}` : ""}
          </span>
        </div>
      );
    }
    return (
      <div
        role="status"
        aria-live="polite"
        className="rounded-[4px] border border-amber-400/20 bg-amber-400/5 px-3 py-2"
      >
        <div className="flex items-center gap-2 text-xs font-medium text-amber-200/90">
          <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-amber-300" />
          Retrying ({retry.attempt}/{retry.maxAttempts})…
        </div>
        {retry.error && (
          <div
            className="mt-1 truncate text-[11px] text-white/45"
            title={retry.error}
          >
            Last error: {retry.error}
          </div>
        )}
      </div>
    );
  }

  const attempts = decision?.attempts ?? 0;
  if (attempts <= 1) return null;

  const fellBack = decision?.source === "fallback";
  // The backend's reasoning also covers an answer that came back but was illegal.
  const message = fellBack
    ? (decision?.reasoning ?? `Fallback after ${attempts} attempts`)
    : `Model answered on attempt ${attempts}`;
  if (inline) {
    return (
      <div
        className={`truncate font-mono text-[11px] ${
          fellBack ? "text-amber-200/85" : "text-white/45"
        }`}
        title={message}
      >
        {message}
      </div>
    );
  }
  return (
    <div
      className={`rounded-[4px] border px-3 py-2 text-xs ${
        fellBack
          ? "border-amber-400/15 bg-amber-400/5 text-amber-200/85"
          : "border-white/10 bg-white/3 text-white/60"
      }`}
    >
      {message}
    </div>
  );
}
