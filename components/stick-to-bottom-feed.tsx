"use client";

import { ArrowDownIcon } from "lucide-react";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
  type UIEvent,
} from "react";

import { cn } from "@/lib/utils";

/** Distance from the bottom, in px, that still counts as "at the bottom". */
const DEFAULT_THRESHOLD_PX = 48;

/**
 * How long after a click or key press inside the feed a size change is
 * treated as caused by the reader (covers the 200ms collapsible animation).
 */
const USER_RESIZE_WINDOW_MS = 600;

/**
 * Keeps a scroll container pinned to its newest (bottom) content while the
 * reader is at or near the bottom. Once they scroll up, new content no longer
 * moves the view; `hasNewContent` turns on so the UI can offer a jump back.
 *
 * Attach `scrollRef` and `onScroll` to the scrolling element and `contentRef`
 * to the element that wraps all of its content. Growth is detected with a
 * ResizeObserver on the content, so new entries, streamed text and expanding
 * collapsibles are all followed.
 */
export function useStickToBottom<
  TScroll extends HTMLElement = HTMLDivElement,
  TContent extends HTMLElement = HTMLDivElement,
>({ threshold = DEFAULT_THRESHOLD_PX }: { threshold?: number } = {}) {
  const scrollRef = useRef<TScroll | null>(null);
  const contentRef = useRef<TContent | null>(null);
  const stickRef = useRef(true);
  const lastHeightRef = useRef(0);
  const [isAtBottom, setIsAtBottom] = useState(true);
  const [hasNewContent, setHasNewContent] = useState(false);

  const onScroll = useCallback(
    (event: UIEvent<TScroll>) => {
      const el = event.currentTarget;
      const distance = el.scrollHeight - el.scrollTop - el.clientHeight;
      const atBottom = distance <= threshold;
      stickRef.current = atBottom;
      setIsAtBottom(atBottom);
      if (atBottom) setHasNewContent(false);
    },
    [threshold],
  );

  const scrollToBottom = useCallback((behavior: ScrollBehavior = "smooth") => {
    const el = scrollRef.current;
    if (!el) return;
    stickRef.current = true;
    setIsAtBottom(true);
    setHasNewContent(false);
    el.scrollTo({ top: el.scrollHeight, behavior });
  }, []);

  useEffect(() => {
    const scrollEl = scrollRef.current;
    const contentEl = contentRef.current;
    if (!scrollEl || !contentEl || typeof ResizeObserver === "undefined") {
      return;
    }

    // Size changes right after the reader clicks or types inside the feed
    // (e.g. expanding an older entry) are their own doing: don't scroll and
    // don't announce new content, just re-check whether they're at the bottom.
    let interactedAt = 0;
    const markInteraction = () => {
      interactedAt = Date.now();
    };
    scrollEl.addEventListener("pointerdown", markInteraction);
    scrollEl.addEventListener("keydown", markInteraction);

    const observer = new ResizeObserver(() => {
      const height = contentEl.scrollHeight;
      const grew = height > lastHeightRef.current;
      lastHeightRef.current = height;
      if (Date.now() - interactedAt < USER_RESIZE_WINDOW_MS) {
        const distance =
          scrollEl.scrollHeight - scrollEl.scrollTop - scrollEl.clientHeight;
        stickRef.current = distance <= threshold;
        setIsAtBottom(stickRef.current);
        return;
      }
      if (stickRef.current) {
        scrollEl.scrollTop = scrollEl.scrollHeight;
      } else if (grew) {
        setHasNewContent(true);
      }
    });
    observer.observe(contentEl);
    return () => {
      observer.disconnect();
      scrollEl.removeEventListener("pointerdown", markInteraction);
      scrollEl.removeEventListener("keydown", markInteraction);
    };
  }, [threshold]);

  return {
    scrollRef,
    contentRef,
    onScroll,
    isAtBottom,
    hasNewContent,
    scrollToBottom,
  };
}

/**
 * A scrolling feed that follows new entries (see useStickToBottom) and shows
 * a "Jump to latest" button when the reader has scrolled away from the bottom
 * and something new arrived.
 */
export function StickToBottomFeed({
  children,
  className,
  contentClassName,
  threshold,
  jumpLabel = "Jump to latest",
}: {
  children: ReactNode;
  /** Classes for the scrolling element (border, padding, background...). */
  className?: string;
  /** Classes for the inner content wrapper (e.g. `space-y-3`). */
  contentClassName?: string;
  threshold?: number;
  jumpLabel?: string;
}) {
  const { scrollRef, contentRef, onScroll, hasNewContent, scrollToBottom } =
    useStickToBottom({ threshold });

  return (
    <div className="relative flex min-h-0 flex-1 flex-col">
      <div
        ref={scrollRef}
        onScroll={onScroll}
        className={cn("min-h-0 flex-1 overflow-y-auto", className)}
      >
        <div ref={contentRef} className={contentClassName}>
          {children}
        </div>
      </div>
      {hasNewContent && (
        <button
          type="button"
          onClick={() => scrollToBottom()}
          className="absolute bottom-3 left-1/2 flex -translate-x-1/2 items-center gap-1 rounded-full border border-white/15 bg-black/80 px-2.5 py-1 text-[11px] text-white/80 shadow-lg backdrop-blur transition-colors hover:bg-black hover:text-white"
        >
          <ArrowDownIcon className="size-3" />
          {jumpLabel}
        </button>
      )}
    </div>
  );
}
