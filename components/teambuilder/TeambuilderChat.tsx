"use client";

import { RotateCcw, SendHorizontal } from "lucide-react";
import { useRef, useState } from "react";

import {
  ACCENT_BG,
  Panel,
  PanelHeader,
  boxButtonClass,
  formatIndex,
} from "@/components/battle/panel";
import { inputBoxClass, monoLabelClass } from "@/components/teambuilder/fields";
import type { ChatMessage, ChatResponse } from "@/lib/teambuilder/api-client";
import type { PokemonSlot, Team } from "@/lib/teambuilder/types";
import { normalizeSlot } from "@/lib/teambuilder/types";
import { cn } from "@/lib/utils";

interface TeambuilderChatProps {
  team: Team | null;
  onSlotsUpdated: (slots: PokemonSlot[]) => void;
  chatFn: (params: {
    messages: ChatMessage[];
    currentSlots?: PokemonSlot[];
    format?: string;
  }) => Promise<ChatResponse>;
  className?: string;
}

const SUGGESTION_CARDS: Array<{
  label: string;
  prompt: string;
}> = [
  {
    label: "Gen 9 OU Rain Team",
    prompt:
      "Build me a competitive Gen 9 OU rain team with Pelipper as the rain setter.",
  },
  {
    label: "Gen 4 Bug & Water Only",
    prompt:
      "Build a fun Gen 4 team using only Bug-type and Water-type Pokemon. Make it as viable as possible.",
  },
  {
    label: "Hyper Offense",
    prompt:
      "Build a Gen 9 OU hyper offense team with a suicide lead and 5 sweepers.",
  },
  {
    label: "Stall / Balance",
    prompt:
      "Build a Gen 9 OU stall or balance team focused on hazards and recovery. Include a Defogger.",
  },
  {
    label: "Monotype Fire",
    prompt:
      "Build a monotype Fire team for Gen 9. Cover as many weaknesses as possible within the type.",
  },
  {
    label: "Trick Room",
    prompt:
      "Build a Gen 9 OU Trick Room team. Pick slow, bulky attackers and a reliable setter.",
  },
];

export function TeambuilderChat({
  team,
  onSlotsUpdated,
  chatFn,
  className,
}: TeambuilderChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    requestAnimationFrame(() => {
      scrollRef.current?.scrollTo({
        top: scrollRef.current.scrollHeight,
        behavior: "smooth",
      });
    });
  };

  const sendMessage = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || isLoading) return;

    setError(null);
    const userMsg: ChatMessage = { role: "user", content: trimmed };
    const nextMessages = [...messages, userMsg];
    setMessages(nextMessages);
    setInput("");
    setIsLoading(true);
    scrollToBottom();

    try {
      const response = await chatFn({
        messages: nextMessages,
        currentSlots: team?.slots,
        format: team?.format,
      });

      const assistantMsg: ChatMessage = {
        role: "assistant",
        content: response.message,
      };
      setMessages((prev) => [...prev, assistantMsg]);

      if (response.slotUpdates?.length) {
        const normalized = response.slotUpdates.map((s) => {
          const raw = s as Partial<PokemonSlot> & { slot?: number };
          const norm = normalizeSlot(raw);
          if (typeof raw.slot === "number") {
            (norm as PokemonSlot & { slot?: number }).slot = raw.slot;
          }
          return norm;
        });
        onSlotsUpdated(normalized);
      }
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : "Chat request failed";
      setError(msg);
    } finally {
      setIsLoading(false);
      scrollToBottom();
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendMessage(input);
  };

  const showSuggestions = messages.length === 0 && !isLoading;

  return (
    <Panel className={cn("min-h-0", className)}>
      <PanelHeader
        title="Co-pilot"
        index={5}
        label="CO-PILOT"
        aside={
          messages.length > 0 && (
            <button
              type="button"
              onClick={() => {
                setMessages([]);
                setError(null);
              }}
              className={cn(boxButtonClass, "h-6 px-1.5 py-0 text-[11px]")}
              title="Clear conversation"
            >
              <RotateCcw className="size-3" />
              Clear
            </button>
          )
        }
      />

      <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto px-3 py-3">
        {showSuggestions && (
          <div className="grid gap-2">
            <p className="text-[12px] leading-5 text-white/50">
              Ask the AI to build, analyze, or improve your team. Its picks fill
              your slots directly.
            </p>
            <div className={cn(monoLabelClass, "mt-1")}>Try a suggestion</div>
            <ul className="grid gap-1">
              {SUGGESTION_CARDS.map((card, idx) => (
                <li key={card.label}>
                  <button
                    type="button"
                    onClick={() => sendMessage(card.prompt)}
                    disabled={!team}
                    title={card.prompt}
                    className="grid w-full grid-cols-[22px_minmax(0,1fr)] gap-x-2 rounded-[4px] border border-white/[0.07] px-2.5 py-2 text-left transition-colors hover:border-white/25 hover:bg-white/[0.03] disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <span className="pt-px font-mono text-[10px] text-white/35">
                      {formatIndex(idx + 1)}
                    </span>
                    <span className="min-w-0">
                      <span className="block text-[12.5px] text-white/85">
                        {card.label}
                      </span>
                      <span className="mt-0.5 line-clamp-2 block text-[11px] leading-4 text-white/40">
                        {card.prompt}
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="grid gap-2.5">
          {messages.map((msg, idx) => (
            <div
              key={idx}
              className={msg.role === "user" ? "flex justify-end" : ""}
            >
              <div
                className={cn(
                  "max-w-[90%] rounded-[4px] border px-3 py-2 text-[12.5px] leading-relaxed",
                  msg.role === "user"
                    ? "border-[#3b5bff]/45 bg-[#3b5bff]/[0.1] text-white/90"
                    : "border-white/10 bg-white/[0.02] text-white/80",
                )}
              >
                <div className="mb-1 font-mono text-[9.5px] uppercase tracking-[0.14em] text-white/35">
                  {msg.role === "user" ? "You" : "Co-pilot"}
                </div>
                <div className="whitespace-pre-wrap wrap-break-word">{msg.content}</div>
              </div>
            </div>
          ))}

          {isLoading && (
            <div className="inline-flex w-fit items-center gap-2 rounded-[4px] border border-white/10 px-3 py-2 font-mono text-[11px] text-white/55">
              <span className={cn("inline-block size-1.5 animate-pulse", ACCENT_BG)} />
              Thinking…
            </div>
          )}

          {error && (
            <div className="rounded-[4px] border border-red-400/25 bg-red-500/[0.06] px-3 py-2 text-[12px] text-red-200">
              {error}
            </div>
          )}
        </div>
      </div>

      <form
        onSubmit={handleSubmit}
        className="flex shrink-0 gap-2 border-t border-white/[0.07] p-2.5"
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={
            team
              ? "Describe the team you want…"
              : "Select or create a team first"
          }
          aria-label="Message the co-pilot"
          disabled={isLoading || !team}
          className={cn(inputBoxClass, "flex-1 disabled:opacity-40")}
        />
        <button
          type="submit"
          disabled={isLoading || !input.trim() || !team}
          className={cn(
            boxButtonClass,
            "h-8 shrink-0 border-[#3b5bff]/60 text-white hover:border-[#3b5bff] hover:bg-[#3b5bff]/90",
            ACCENT_BG,
          )}
        >
          <SendHorizontal className="size-3.5" />
          Send
        </button>
      </form>
    </Panel>
  );
}
