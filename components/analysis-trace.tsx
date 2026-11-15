"use client";

import { useState, type ReactNode } from "react";

import { cn } from "@/lib/utils";
import {
  Trace,
  TraceCollapsible,
  TraceCollapsibleContent,
  TraceCollapsibleTrigger,
  TraceDescription,
  TraceIcon,
  TraceLine,
  TraceTitle,
} from "@/components/ui/trace";

type TraceStatus = "running" | "error" | "pending";

export type AnalysisTraceStep = {
  id: string;
  icon?: ReactNode;
  title: ReactNode;
  /** Short trailing text that never truncates, e.g. "820 ms". */
  description?: ReactNode;
  /** Optional detail. When present the step becomes collapsible. */
  detail?: ReactNode;
  /** Whether the detail starts expanded. */
  defaultOpen?: boolean;
  status?: TraceStatus;
};

export type AnalysisTraceItem = {
  id: string;
  icon?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  status?: TraceStatus;
  steps: AnalysisTraceStep[];
};

function TraceRow({
  icon,
  title,
  description,
  status,
}: {
  icon?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  status?: TraceStatus;
}) {
  return (
    <TraceLine status={status}>
      {icon && <TraceIcon>{icon}</TraceIcon>}
      <TraceTitle>{title}</TraceTitle>
      {description != null && description !== "" && (
        <TraceDescription>{description}</TraceDescription>
      )}
    </TraceLine>
  );
}

function AnalysisTraceStepRow({ step }: { step: AnalysisTraceStep }) {
  if (step.detail == null) {
    return (
      <TraceRow
        icon={step.icon}
        title={step.title}
        description={step.description}
        status={step.status}
      />
    );
  }

  return (
    <TraceCollapsible defaultOpen={step.defaultOpen}>
      <TraceCollapsibleTrigger>
        <TraceRow
          icon={step.icon}
          title={step.title}
          description={step.description}
          status={step.status}
        />
      </TraceCollapsibleTrigger>
      <TraceCollapsibleContent>{step.detail}</TraceCollapsibleContent>
    </TraceCollapsible>
  );
}

/**
 * A compact, reusable history of AI analysis built on the shadcn Trace
 * primitives. Each item is a collapsible group of steps (reasoning, decision,
 * latency, model, ...). Items are ordered oldest to newest; the newest is
 * expanded and older ones collapse, unless the reader toggled them.
 */
export function AnalysisTrace({
  items,
  pending,
  empty,
  className,
}: {
  items: AnalysisTraceItem[];
  /** A running line shown after the items, e.g. "Analyzing turn 4...". */
  pending?: { title: ReactNode; icon?: ReactNode } | null;
  /** Shown when there are no items and nothing pending. */
  empty?: ReactNode;
  className?: string;
}) {
  const [openOverrides, setOpenOverrides] = useState<Record<string, boolean>>(
    {},
  );
  const newestId = items.at(-1)?.id;

  if (items.length === 0 && !pending) {
    return empty ? <>{empty}</> : null;
  }

  return (
    // The page is styled dark without the `dark` class on <html>, so scope the
    // dark theme tokens here for the token-based Trace styles.
    <Trace
      className={cn(
        "dark gap-1.5 [&_[data-slot=trace-line]]:text-xs [&_[data-slot=trace-collapsible-content-inner]]:mt-1.5 [&_[data-slot=trace-collapsible-content-inner]]:text-[11px]",
        className,
      )}
    >
      {items.map((item) => {
        const open = openOverrides[item.id] ?? item.id === newestId;
        return (
          <TraceCollapsible
            key={item.id}
            open={open}
            onOpenChange={(next) =>
              setOpenOverrides((prev) => ({ ...prev, [item.id]: next }))
            }
          >
            <TraceCollapsibleTrigger>
              <TraceRow
                icon={item.icon}
                title={item.title}
                description={item.description}
                status={item.status}
              />
            </TraceCollapsibleTrigger>
            <TraceCollapsibleContent>
              <Trace className="gap-1">
                {item.steps.map((step) => (
                  <AnalysisTraceStepRow key={step.id} step={step} />
                ))}
              </Trace>
            </TraceCollapsibleContent>
          </TraceCollapsible>
        );
      })}
      {pending && (
        <TraceRow icon={pending.icon} title={pending.title} status="running" />
      )}
    </Trace>
  );
}
