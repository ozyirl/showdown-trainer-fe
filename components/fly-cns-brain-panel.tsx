"use client";

import { useState } from "react";
import { Brain, ChevronDown } from "lucide-react";
import { motion } from "motion/react";
import { cn } from "@/lib/utils";

/** The spike simulation and policy readout the API returns for a Fly CNS decision. */
export type FlyCnsDiagnostics = {
  total_spikes: number;
  active_neurons: number;
  neuron_count: number;
  sensory_neurons_stimulated: number;
  steps: number | null;
  spikes_per_step: number[];
  populations: {
    key: string;
    label: string;
    neurons: number;
    active: number;
    spikes: number;
    first_spike_step: number | null;
  }[];
  top_descending: { root_id: number; cell_type: string; spikes: number }[];
  actions: {
    index: number;
    choice: string;
    label: string;
    probability: number;
    selected: boolean;
  }[];
  state_value: number;
};

const POPULATION_STYLES: Record<string, { dot: string; bar: string }> = {
  sensory: { dot: "bg-white", bar: "bg-white/70" },
  kenyon: { dot: "bg-orange-400", bar: "bg-orange-400/80" },
  modulatory: { dot: "bg-fuchsia-400", bar: "bg-fuchsia-400/80" },
  central: { dot: "bg-blue-400", bar: "bg-blue-400/80" },
  descending: { dot: "bg-emerald-400", bar: "bg-emerald-400/80" },
};

// What each population's first spike means, for the timeline.
const FIRST_SPIKE_NOTES: Record<string, string> = {
  sensory: "Battle state reaches the sensory neurons.",
  central: "Central brain relays start passing the signal on.",
  kenyon:
    "Kenyon cells light up: the mushroom body, the fly's centre for learning and memory.",
  modulatory:
    "Dopamine, serotonin and octopamine neurons fire. No learning happens here: the wiring is frozen.",
  descending:
    "First descending neuron spikes: a command channel from the brain to the body.",
};

const numberFormat = new Intl.NumberFormat("en-US");

function styleFor(key: string) {
  return POPULATION_STYLES[key] ?? { dot: "bg-white/50", bar: "bg-white/40" };
}

export function FlyCnsBrainPanel({
  diagnostics,
  className,
}: {
  diagnostics: FlyCnsDiagnostics;
  className?: string;
}) {
  const [showTrace, setShowTrace] = useState(false);
  const peakStep = Math.max(1, ...diagnostics.spikes_per_step);
  const timeline = diagnostics.populations
    .filter((population) => population.first_spike_step !== null)
    .sort(
      (a, b) =>
        (a.first_spike_step ?? 0) - (b.first_spike_step ?? 0) ||
        a.label.localeCompare(b.label),
    );

  return (
    <div
      className={cn(
        "rounded-xl border border-emerald-400/15 bg-emerald-400/[0.04] p-3",
        className,
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-emerald-300/80">
          <Brain className="h-3.5 w-3.5" />
          Fly brain activity
        </div>
        <div className="text-[10px] text-white/35">
          {diagnostics.steps ?? diagnostics.spikes_per_step.length} simulation
          steps
        </div>
      </div>

      <div className="mt-2 flex items-baseline gap-4">
        <div>
          <span className="text-lg font-semibold text-white">
            {numberFormat.format(diagnostics.total_spikes)}
          </span>{" "}
          <span className="text-xs text-white/50">spikes</span>
        </div>
        <div>
          <span className="text-lg font-semibold text-white">
            {numberFormat.format(diagnostics.active_neurons)}
          </span>{" "}
          <span className="text-xs text-white/50">
            of {numberFormat.format(diagnostics.neuron_count)} neurons active
          </span>
        </div>
      </div>

      <div
        className="mt-2 flex h-6 items-end gap-px"
        aria-label="Spikes per simulation step"
      >
        {diagnostics.spikes_per_step.map((count, step) => (
          <motion.div
            key={step}
            className="flex-1 rounded-sm bg-emerald-300/50"
            initial={{ height: 0 }}
            animate={{ height: `${Math.max(4, (count / peakStep) * 100)}%` }}
            transition={{ delay: step * 0.015, duration: 0.25 }}
            title={`Step ${step}: ${count} spikes`}
          />
        ))}
      </div>

      <div className="mt-3 space-y-1.5">
        {diagnostics.populations.map((population) => {
          const style = styleFor(population.key);
          const share = population.neurons
            ? population.active / population.neurons
            : 0;
          return (
            <div key={population.key} className="text-xs">
              <div className="flex items-center justify-between gap-2">
                <div className="flex min-w-0 items-center gap-2 text-white/75">
                  <span
                    className={cn("h-2 w-2 shrink-0 rounded-full", style.dot)}
                  />
                  <span className="truncate">{population.label}</span>
                </div>
                <div className="shrink-0 tabular-nums text-white/50">
                  {numberFormat.format(population.active)}
                  <span className="text-white/30">
                    /{numberFormat.format(population.neurons)}
                  </span>
                </div>
              </div>
              <div className="mt-1 h-1 overflow-hidden rounded-full bg-white/5">
                <motion.div
                  className={cn("h-full rounded-full", style.bar)}
                  initial={{ width: 0 }}
                  animate={{ width: `${share * 100}%` }}
                  transition={{ duration: 0.4 }}
                />
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-4">
        <div className="text-[10px] uppercase tracking-[0.16em] text-white/40">
          Readout: chance of each choice
        </div>
        <div className="mt-2 space-y-1.5">
          {diagnostics.actions.map((action) => (
            <div key={action.index} className="text-xs">
              <div className="flex items-center justify-between gap-2">
                <span
                  className={cn(
                    "truncate",
                    action.selected
                      ? "font-medium text-emerald-200"
                      : "text-white/60",
                  )}
                >
                  {action.label}
                  <span className="ml-1.5 text-[10px] text-white/30">
                    {action.choice}
                  </span>
                </span>
                <span
                  className={cn(
                    "shrink-0 tabular-nums",
                    action.selected ? "text-emerald-200" : "text-white/45",
                  )}
                >
                  {(action.probability * 100).toFixed(1)}%
                </span>
              </div>
              <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-white/5">
                <motion.div
                  className={cn(
                    "h-full rounded-full",
                    action.selected ? "bg-emerald-400" : "bg-white/25",
                  )}
                  initial={{ width: 0 }}
                  animate={{ width: `${action.probability * 100}%` }}
                  transition={{ duration: 0.4 }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      <button
        type="button"
        onClick={() => setShowTrace((current) => !current)}
        className="mt-3 flex items-center gap-1 text-[11px] text-white/50 hover:text-white/80"
      >
        <ChevronDown
          className={cn(
            "h-3 w-3 transition-transform",
            showTrace && "rotate-180",
          )}
        />
        {showTrace ? "Hide brain trace" : "Show brain trace"}
      </button>

      {showTrace && (
        <div className="mt-2 space-y-3">
          {timeline.length > 0 && (
            <ol className="space-y-1.5">
              {timeline.map((population) => (
                <li key={population.key} className="flex gap-2 text-xs">
                  <span className="w-12 shrink-0 tabular-nums text-amber-200/80">
                    step {population.first_spike_step}
                  </span>
                  <span className="text-white/65">
                    {FIRST_SPIKE_NOTES[population.key] ??
                      `${population.label} fires.`}
                  </span>
                </li>
              ))}
            </ol>
          )}

          {diagnostics.top_descending.length > 0 && (
            <div>
              <div className="text-[10px] uppercase tracking-[0.16em] text-white/40">
                Busiest descending neurons
              </div>
              <div className="mt-1.5 flex flex-wrap gap-1">
                {diagnostics.top_descending.map((neuron) => (
                  <span
                    key={neuron.root_id}
                    className="rounded-md border border-emerald-400/15 bg-emerald-400/5 px-1.5 py-0.5 font-mono text-[10px] text-emerald-100/80"
                    title={`Root ID ${neuron.root_id}`}
                  >
                    {neuron.cell_type} · {neuron.spikes}
                  </span>
                ))}
              </div>
            </div>
          )}

          <div className="text-[10px] leading-relaxed text-white/35">
            {numberFormat.format(diagnostics.sensory_neurons_stimulated)} sensory
            neurons stimulated by the battle state. The descending neurons feed
            the trained readout, which values this position at{" "}
            {diagnostics.state_value.toFixed(2)}.
          </div>
        </div>
      )}
    </div>
  );
}
