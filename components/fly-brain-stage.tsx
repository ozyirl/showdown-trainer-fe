"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { RotateCcw } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import { cn } from "@/lib/utils";
import {
  FIRST_SPIKE_NOTES,
  type FlyCnsDiagnostics,
} from "@/components/fly-cns-brain-panel";

/**
 * The fly's brain replaying the spike simulation behind the CPU's latest move.
 *
 * Each dot is one neuron of the model, drawn at its real cell-body position in the
 * MaleCNS connectome (built by flycns-showdown's build_brain_layout.py). The API sends
 * each neuron's first spike step and spike count; the replay lights a neuron at its
 * first spike and spreads its remaining spikes evenly over the rest of the run.
 */

const LAYOUT_URL = "/fly/brain-layout.json";
const STEP_MS = 90;
const NEVER_FIRED = 255;
const CANVAS_HEIGHT = 230;

// Same hues as the population dots in FlyCnsBrainPanel (Tailwind 400 shades).
const POPULATION_COLORS: Record<string, string> = {
  sensory: "#ffffff",
  kenyon: "#fb923c",
  modulatory: "#e879f9",
  central: "#60a5fa",
  descending: "#34d399",
};
const POPULATION_ORDER = ["central", "kenyon", "descending", "modulatory", "sensory"];
const POPULATION_NAMES: Record<string, string> = {
  central: "central",
  kenyon: "mushroom body",
  descending: "descending",
  modulatory: "modulatory",
  sensory: "sensory inputs",
};

type BrainLayout = {
  graph: string;
  neuronCount: number;
  placed: number;
  extentUm: number;
  populations: string[];
  population: Uint8Array;
  /** x, y, z per neuron, centred on the brain with x across -1..1; NaN if unplaced. */
  positions: Float32Array;
  /** Half the brain's height in the same units, so it can be fitted to the canvas. */
  halfHeight: number;
};

type Activity = {
  first: Uint8Array;
  spikes: Uint8Array;
};

let layoutRequest: Promise<BrainLayout> | null = null;

function decodeBytes(base64: string): Uint8Array {
  return Uint8Array.from(atob(base64), (character) => character.charCodeAt(0));
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)] ?? 0;
}

function quantile(values: number[], q: number): number {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * q))] ?? 0;
}

async function fetchLayout(): Promise<BrainLayout> {
  const response = await fetch(LAYOUT_URL);
  if (!response.ok) throw new Error(`brain layout: ${response.status}`);
  const raw = (await response.json()) as {
    graph: string;
    neuron_count: number;
    placed: number;
    extent_um: number;
    position_range: number;
    missing: number;
    populations: string[];
    population: string;
    positions: string;
  };
  const bytes = decodeBytes(raw.positions);
  const view = new DataView(bytes.buffer);
  const positions = new Float32Array(raw.neuron_count * 3).fill(Number.NaN);
  const axes: number[][] = [[], [], []];
  for (let neuron = 0; neuron < raw.neuron_count; neuron++) {
    const x = view.getInt16(neuron * 6, true);
    if (x === raw.missing) continue;
    for (let axis = 0; axis < 3; axis++) {
      const value = view.getInt16(neuron * 6 + axis * 2, true) / raw.position_range;
      positions[neuron * 3 + axis] = value;
      axes[axis].push(value);
    }
  }
  // Centre on the brain itself: the medians and the 1st-99th percentile spans ignore
  // the sparse ventral nerve cord trailing far behind it.
  const centre = axes.map(median);
  const span = (values: number[]) => quantile(values, 0.99) - quantile(values, 0.01);
  const width = span(axes[0]);
  for (let index = 0; index < positions.length; index++) {
    if (!Number.isNaN(positions[index])) {
      positions[index] = ((positions[index] - centre[index % 3]) / width) * 2;
    }
  }
  return {
    graph: raw.graph,
    neuronCount: raw.neuron_count,
    placed: raw.placed,
    extentUm: raw.extent_um,
    populations: raw.populations,
    population: decodeBytes(raw.population),
    positions,
    halfHeight: span(axes[1]) / width,
  };
}

function useBrainLayout(): BrainLayout | null {
  const [layout, setLayout] = useState<BrainLayout | null>(null);
  useEffect(() => {
    let cancelled = false;
    layoutRequest ??= fetchLayout();
    layoutRequest
      .then((loaded) => {
        if (!cancelled) setLayout(loaded);
      })
      .catch(() => {
        layoutRequest = null;
      });
    return () => {
      cancelled = true;
    };
  }, []);
  return layout;
}

/** Index of the latest of a neuron's spikes at or before ``step``, or -1. */
function lastSpikeIndex(first: number, count: number, steps: number, step: number) {
  if (first === NEVER_FIRED || count === 0 || step < first) return -1;
  return Math.min(count - 1, Math.floor(((step - first) * count) / Math.max(1, steps - first)));
}

function spikeStep(first: number, count: number, steps: number, index: number) {
  return first + Math.floor((index * Math.max(1, steps - first)) / count);
}

function glowSprite(color: string): HTMLCanvasElement {
  const sprite = document.createElement("canvas");
  sprite.width = sprite.height = 32;
  const context = sprite.getContext("2d");
  if (context) {
    const gradient = context.createRadialGradient(16, 16, 0, 16, 16, 16);
    gradient.addColorStop(0, "#ffffff");
    gradient.addColorStop(0.18, color);
    gradient.addColorStop(1, "transparent");
    context.fillStyle = gradient;
    context.fillRect(0, 0, 32, 32);
  }
  return sprite;
}

/** An original drawing of a fruit fly whose wings flutter while it thinks. */
function FlyGlyph({ thinking }: { thinking: boolean }) {
  const flutter = thinking
    ? { scaleY: [1, 0.35, 1], transition: { duration: 0.14, repeat: Infinity } }
    : { scaleY: 1 };
  return (
    <svg viewBox="0 0 48 48" className="h-10 w-10 shrink-0" aria-hidden>
      {[-1, 1].map((side) => (
        <motion.ellipse
          key={side}
          cx={24 + side * 11}
          cy={20}
          rx={11}
          ry={5}
          fill="rgba(210, 230, 255, 0.22)"
          stroke="rgba(210, 230, 255, 0.55)"
          strokeWidth={0.8}
          transform={`rotate(${side * -24} ${24 + side * 11} 20)`}
          style={{ transformBox: "fill-box", transformOrigin: side < 0 ? "right" : "left" }}
          animate={flutter}
        />
      ))}
      {[-1, 1].flatMap((side) =>
        [0, 1, 2].map((leg) => (
          <path
            key={`${side}-${leg}`}
            d={`M${24 + side * 3} ${24 + leg * 4} q${side * 7} ${-2 + leg * 3} ${side * 10} ${3 + leg * 4}`}
            stroke="#7c5a32"
            strokeWidth={1.2}
            fill="none"
            strokeLinecap="round"
          />
        )),
      )}
      <ellipse cx={24} cy={35} rx={5.5} ry={8} fill="#9a6b33" />
      {[31, 35, 39].map((y) => (
        <path key={y} d={`M18.8 ${y} h10.4`} stroke="#5b3b19" strokeWidth={1.4} />
      ))}
      <ellipse cx={24} cy={23} rx={6} ry={6.5} fill="#b07a3a" />
      <circle cx={24} cy={13} r={5.5} fill="#a8733a" />
      <circle cx={20} cy={12} r={3.2} fill="#d42f2f" />
      <circle cx={28} cy={12} r={3.2} fill="#d42f2f" />
    </svg>
  );
}

export function FlyBrainStage({
  diagnostics,
  turn,
  className,
}: {
  diagnostics: FlyCnsDiagnostics | null | undefined;
  turn?: number;
  className?: string;
}) {
  const layout = useBrainLayout();
  const reducedMotion = useReducedMotion();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const frameRef = useRef<HTMLDivElement | null>(null);
  const dragRef = useRef({ yaw: 0, pitch: 0.12, active: false, x: 0, y: 0 });
  const [step, setStep] = useState(0);
  const [replayKey, setReplayKey] = useState(0);

  const steps = diagnostics?.steps ?? 32;
  const activity = useMemo<Activity | null>(() => {
    const encoded = diagnostics?.neuron_activity;
    if (!encoded || !layout || encoded.graph !== layout.graph) return null;
    return { first: decodeBytes(encoded.first_spike_step), spikes: decodeBytes(encoded.spikes) };
  }, [diagnostics, layout]);

  // Exact per-step counters: neurons whose first spike has happened, and spikes so far.
  const counters = useMemo(() => {
    if (!activity || !layout) return null;
    const active = Array.from({ length: steps + 1 }, () => new Map<string, number>());
    for (let neuron = 0; neuron < activity.first.length; neuron++) {
      const first = activity.first[neuron];
      if (first === NEVER_FIRED) continue;
      const name = layout.populations[layout.population[neuron]];
      for (let at = first; at <= steps; at++) {
        active[at].set(name, (active[at].get(name) ?? 0) + 1);
      }
    }
    const spikes = [0];
    for (const count of diagnostics?.spikes_per_step ?? []) spikes.push(spikes.at(-1)! + count);
    return { active, spikes };
  }, [activity, layout, steps, diagnostics]);

  // A new decision changes `activity`, which restarts this replay; so does Replay.
  useEffect(() => {
    const canvas = canvasRef.current;
    const frame = frameRef.current;
    if (!canvas || !frame || !layout) return;
    const context = canvas.getContext("2d");
    if (!context) return;

    const sprites = Object.fromEntries(
      layout.populations.map((name) => [name, glowSprite(POPULATION_COLORS[name] ?? "#cbd5e1")]),
    );
    const colors = layout.populations.map((name) => POPULATION_COLORS[name] ?? "#cbd5e1");
    const started = performance.now();
    let animation = 0;
    let shownStep = -1;

    const resize = () => {
      const ratio = window.devicePixelRatio || 1;
      canvas.width = Math.round(frame.clientWidth * ratio);
      canvas.height = Math.round(CANVAS_HEIGHT * ratio);
    };
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(frame);

    const draw = (now: number) => {
      const elapsed = now - started;
      const progress = activity && !reducedMotion ? Math.min(steps, elapsed / STEP_MS) : steps;
      const currentStep = Math.floor(progress);
      if (currentStep !== shownStep) {
        shownStep = currentStep;
        setStep(currentStep);
      }

      const drag = dragRef.current;
      const sway = reducedMotion ? 0 : Math.sin(now / 2800) * 0.35;
      const yaw = sway + drag.yaw;
      const pitch = drag.pitch;
      const cosYaw = Math.cos(yaw);
      const sinYaw = Math.sin(yaw);
      const cosPitch = Math.cos(pitch);
      const sinPitch = Math.sin(pitch);
      const width = canvas.width;
      const height = canvas.height;
      // Fit the brain inside the canvas, leaving room for the sway and the counters.
      const halfWidth = Math.min(width * 0.4, (height * 0.4) / layout.halfHeight);
      const ratio = window.devicePixelRatio || 1;

      context.clearRect(0, 0, width, height);
      context.globalCompositeOperation = "source-over";
      const glowing: number[] = [];
      const projected = new Float32Array(layout.neuronCount * 3);

      for (let neuron = 0; neuron < layout.neuronCount; neuron++) {
        const x = layout.positions[neuron * 3];
        if (Number.isNaN(x)) continue;
        const y = layout.positions[neuron * 3 + 1];
        const z = layout.positions[neuron * 3 + 2];
        const rotatedX = x * cosYaw - z * sinYaw;
        const depth = x * sinYaw + z * cosYaw;
        const rotatedY = y * cosPitch - depth * sinPitch;
        const finalDepth = y * sinPitch + depth * cosPitch;
        const perspective = 3.2 / (3.2 + finalDepth);
        const screenX = width / 2 + rotatedX * halfWidth * perspective;
        const screenY = height * 0.52 + rotatedY * halfWidth * perspective;
        if (screenX < -20 || screenX > width + 20 || screenY < -20 || screenY > height + 20) continue;
        projected[neuron * 3] = screenX;
        projected[neuron * 3 + 1] = screenY;
        projected[neuron * 3 + 2] = perspective;

        let glow = 0;
        if (activity) {
          const first = activity.first[neuron];
          const count = activity.spikes[neuron];
          const index = lastSpikeIndex(first, count, steps, currentStep);
          if (index >= 0) {
            const since = progress - spikeStep(first, count, steps, index);
            const flash = Math.exp(-since / 1.6);
            // After the replay, neurons keep a faint glow in proportion to their activity.
            const settled = currentStep >= steps ? Math.min(0.55, count / 24) : 0;
            glow = Math.max(flash, settled);
          }
        }
        context.globalAlpha = glow > 0.05 ? 0.55 : 0.2;
        context.fillStyle = colors[layout.population[neuron]];
        const size = Math.max(1, 1.4 * ratio * perspective);
        context.fillRect(screenX - size / 2, screenY - size / 2, size, size);
        if (glow > 0.05) glowing.push(neuron, glow);
      }

      context.globalCompositeOperation = "lighter";
      for (let index = 0; index < glowing.length; index += 2) {
        const neuron = glowing[index];
        const glow = glowing[index + 1];
        const size = (5 + 7 * glow) * ratio * projected[neuron * 3 + 2];
        context.globalAlpha = Math.min(1, glow);
        context.drawImage(
          sprites[layout.populations[layout.population[neuron]]],
          projected[neuron * 3] - size / 2,
          projected[neuron * 3 + 1] - size / 2,
          size,
          size,
        );
      }
      context.globalAlpha = 1;
      context.globalCompositeOperation = "source-over";
      animation = requestAnimationFrame(draw);
    };
    animation = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(animation);
      observer.disconnect();
    };
  }, [layout, activity, steps, reducedMotion, replayKey]);

  const replaying = Boolean(activity) && step < steps;
  const chosen = diagnostics?.actions.find((action) => action.selected) ?? null;
  const chosenPhrase = chosen
    ? chosen.choice.startsWith("switch")
      ? `switched to ${chosen.label}`
      : `chose ${chosen.label}`
    : null;
  const topDescending = diagnostics?.top_descending[0];
  const activeNow = counters?.active[Math.min(step, steps)];
  const spikesNow = counters?.spikes[Math.min(step, counters.spikes.length - 1)] ?? 0;
  const neuronsNow = activeNow
    ? [...activeNow.values()].reduce((total, count) => total + count, 0)
    : 0;

  const timeline = (diagnostics?.populations ?? [])
    .filter((population) => population.first_spike_step !== null)
    .sort((a, b) => (a.first_spike_step ?? 0) - (b.first_spike_step ?? 0));

  return (
    <div
      className={cn(
        "relative shrink-0 overflow-hidden rounded-2xl border border-white/10 bg-[#05070b] text-white",
        className,
      )}
    >
      <div className="flex items-center gap-3 px-4 pt-3">
        <FlyGlyph thinking={replaying} />
        <div className="min-w-0 flex-1">
          <div className="text-sm font-semibold text-amber-200">
            {!diagnostics
              ? "The fly is waiting for its first move"
              : replaying
                ? "The fly is thinking…"
                : chosenPhrase
                  ? `The fly ${chosenPhrase}`
                  : "The fly decided"}
          </div>
          <div className="truncate text-[11px] text-white/45">
            {diagnostics
              ? `${turn ? `Turn ${turn} · ` : ""}spiking model on real fly wiring`
              : "A spiking model of the fruit fly's central nervous system plays the CPU side."}
          </div>
        </div>
        {activity && (
          <button
            type="button"
            onClick={() => setReplayKey((key) => key + 1)}
            className="inline-flex items-center gap-1 rounded-lg border border-white/10 px-2 py-1 text-[11px] text-white/60 transition hover:border-white/25 hover:text-white"
          >
            <RotateCcw className="h-3 w-3" aria-hidden />
            Replay
          </button>
        )}
      </div>

      <div
        ref={frameRef}
        className="relative mt-1 cursor-grab touch-none active:cursor-grabbing"
        style={{ height: CANVAS_HEIGHT }}
        onPointerDown={(event) => {
          dragRef.current = { ...dragRef.current, active: true, x: event.clientX, y: event.clientY };
          event.currentTarget.setPointerCapture(event.pointerId);
        }}
        onPointerMove={(event) => {
          const drag = dragRef.current;
          if (!drag.active) return;
          drag.yaw += (event.clientX - drag.x) * 0.01;
          drag.pitch = Math.max(-0.9, Math.min(0.9, drag.pitch + (event.clientY - drag.y) * 0.01));
          drag.x = event.clientX;
          drag.y = event.clientY;
        }}
        onPointerUp={() => {
          dragRef.current.active = false;
        }}
      >
        <canvas
          ref={canvasRef}
          className="absolute inset-0 h-full w-full"
          aria-label="The fly's neurons, drawn at their real positions, lighting up as they spike"
        />
        {!layout && (
          <div className="absolute inset-0 grid place-items-center text-xs text-white/35">
            Loading the fly&apos;s brain…
          </div>
        )}
        {diagnostics && (
          <div className="pointer-events-none absolute left-3 top-1 text-[11px] leading-tight">
            <div>
              <span className="text-sm font-semibold tabular-nums">
                {spikesNow.toLocaleString("en-US")}
              </span>{" "}
              <span className="text-white/50">spikes</span>
            </div>
            <div>
              <span className="text-sm font-semibold tabular-nums">
                {neuronsNow.toLocaleString("en-US")}
              </span>{" "}
              <span className="text-white/50">neurons active</span>
            </div>
          </div>
        )}
        {diagnostics && (
          <div className="pointer-events-none absolute right-3 top-1 text-[10px] tabular-nums text-white/40">
            step {Math.min(step, steps)} / {steps}
          </div>
        )}
      </div>

      {layout && (
        <div className="flex flex-wrap gap-x-3 gap-y-1 px-4 pb-1 text-[10px] text-white/60">
          {POPULATION_ORDER.filter((name) => layout.populations.includes(name)).map((name) => (
            <span key={name} className="inline-flex items-center gap-1">
              <span
                className="h-2 w-2 rounded-full"
                style={{ backgroundColor: POPULATION_COLORS[name] }}
              />
              {POPULATION_NAMES[name]}
              {diagnostics && (
                <span className="tabular-nums text-white/90">
                  {(activeNow?.get(name) ?? 0).toLocaleString("en-US")}
                </span>
              )}
            </span>
          ))}
        </div>
      )}

      {diagnostics && (
        <ol className="space-y-1 px-4 pb-2 pt-1 text-[11px] leading-snug">
          {timeline.map((population) => {
            const reached = step >= (population.first_spike_step ?? 0);
            return (
              <li
                key={population.key}
                className={cn(
                  "flex gap-2 transition-opacity duration-300",
                  reached ? "opacity-100" : "opacity-25",
                )}
              >
                <span className="w-12 shrink-0 font-semibold tabular-nums text-amber-200">
                  step {population.first_spike_step}
                </span>
                <span className="text-white/75">
                  {FIRST_SPIKE_NOTES[population.key] ?? `${population.label} fires.`}
                  {population.key === "descending" && topDescending
                    ? ` Busiest: ${topDescending.cell_type}.`
                    : ""}
                </span>
              </li>
            );
          })}
          {chosen && (
            <li
              className={cn(
                "flex gap-2 transition-opacity duration-300",
                replaying ? "opacity-25" : "opacity-100",
              )}
            >
              <span className="w-12 shrink-0 font-semibold tabular-nums text-amber-200">
                step {steps}
              </span>
              <span className="text-white/75">
                Descending activity is read out as{" "}
                {chosen.choice.startsWith("switch") ? "a switch to " : "a move: "}
                <span className="font-semibold text-white">{chosen.label}</span> (
                {Math.round(chosen.probability * 100)}% sure).
              </span>
            </li>
          )}
        </ol>
      )}

      {diagnostics && !activity && (
        <div className="px-4 pb-2 text-[10px] text-amber-200/60">
          {layout && diagnostics.neuron_activity
            ? "This brain layout was built for a different graph, so spikes aren't drawn."
            : "The model service didn't send per-neuron activity, so spikes aren't drawn."}
        </div>
      )}
      <div className="border-t border-white/5 px-4 py-1.5 text-[9px] text-white/30">
        {layout
          ? `${layout.placed.toLocaleString("en-US")} of ${layout.neuronCount.toLocaleString("en-US")} model neurons drawn at their cell bodies in the Janelia FlyEM male CNS connectome (v1.0), about ${Math.round(layout.extentUm)} µm across; sensory neurons with cell bodies outside the CNS aren't drawn. Drag to rotate.`
          : "Janelia FlyEM male CNS connectome (v1.0)."}
      </div>
    </div>
  );
}
