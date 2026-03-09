"use client";

import { useRef, useState } from "react";
import type { ChatMessage, ChatResponse } from "@/lib/teambuilder/api-client";
import type { PokemonSlot, Team } from "@/lib/teambuilder/types";
import { normalizeSlot } from "@/lib/teambuilder/types";

interface TeambuilderChatProps {
  team: Team | null;
  onSlotsUpdated: (slots: PokemonSlot[]) => void;
  chatFn: (params: {
    messages: ChatMessage[];
    currentSlots?: PokemonSlot[];
    format?: string;
  }) => Promise<ChatResponse>;
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
    <div className="flex h-full flex-col overflow-hidden rounded-2xl border border-white/10 bg-white/3 backdrop-blur">
      <div className="border-b border-white/10 px-4 py-3">
        <div className="text-xs tracking-[0.16em] text-white/40">
          TEAMBUILDER CO-PILOT
        </div>
        <div className="mt-0.5 truncate text-sm text-white/60">
          Ask the AI to build, analyze, or improve your team.
        </div>
      </div>

      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto px-4 py-3"
        style={{ minHeight: 0 }}
      >
        {showSuggestions && (
          <div className="space-y-3">
            <div className="text-xs text-white/45">
              Try a suggestion to get started:
            </div>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {SUGGESTION_CARDS.map((card) => (
                <button
                  key={card.label}
                  type="button"
                  onClick={() => sendMessage(card.prompt)}
                  className="rounded-xl border border-white/10 bg-white/3 px-3 py-2.5 text-left transition-colors hover:border-white/20 hover:bg-white/6"
                >
                  <div className="text-sm font-medium text-white/80">
                    {card.label}
                  </div>
                  <div className="mt-1 line-clamp-2 text-xs text-white/45">
                    {card.prompt}
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg, idx) => (
          <div
            key={idx}
            className={`mb-3 ${msg.role === "user" ? "flex justify-end" : ""}`}
          >
            <div
              className={`max-w-[85%] rounded-xl px-3.5 py-2.5 text-sm leading-relaxed ${
                msg.role === "user"
                  ? "bg-blue-600/20 text-white/90"
                  : "border border-white/10 bg-white/3 text-white/80"
              }`}
            >
              <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-white/35">
                {msg.role === "user" ? "You" : "Co-Pilot"}
              </div>
              <div className="whitespace-pre-wrap wrap-break-word">{msg.content}</div>
            </div>
          </div>
        ))}

        {isLoading && (
          <div className="mb-3">
            <div className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/3 px-3.5 py-2.5 text-sm text-white/60">
              <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-blue-400" />
              Thinking...
            </div>
          </div>
        )}

        {error && (
          <div className="mb-3 rounded-xl border border-red-400/20 bg-red-500/5 px-3 py-2 text-sm text-red-200">
            {error}
          </div>
        )}
      </div>

      <form
        onSubmit={handleSubmit}
        className="border-t border-white/10 px-4 py-3"
      >
        <div className="flex gap-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={
              team
                ? "Describe the team you want to build..."
                : "Select or create a team first"
            }
            disabled={isLoading || !team}
            className="flex-1 rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-white outline-none placeholder:text-white/30 focus:border-white/20 disabled:opacity-40"
          />
          <button
            type="submit"
            disabled={isLoading || !input.trim() || !team}
            className="rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Send
          </button>
        </div>
        {messages.length > 0 && (
          <button
            type="button"
            onClick={() => {
              setMessages([]);
              setError(null);
            }}
            className="mt-2 text-xs text-white/40 hover:text-white/60"
          >
            Clear conversation
          </button>
        )}
      </form>
    </div>
  );
}
