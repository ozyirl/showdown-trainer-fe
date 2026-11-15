"use client";

import type { CSSProperties, ReactNode } from "react";
import { useSyncExternalStore } from "react";

import { ITEM_SPRITE_NUMS } from "@/lib/item-sprites";
import { cn } from "@/lib/utils";

// Vendored copy of https://play.pokemonshowdown.com/sprites/itemicons-sheet.png
// (384x1152: 24x24 cells, 16 per row), kept in step with lib/item-sprites.ts.
const SHEET_URL = "/sprites/itemicons-sheet.png";
const CELL = 24;
const PER_ROW = 16;
const SHEET_WIDTH = CELL * PER_ROW;
const SHEET_HEIGHT = 1152;

type SheetStatus = "loading" | "loaded" | "error";

let sheetStatus: SheetStatus = "loading";
let sheetRequested = false;
const listeners = new Set<() => void>();

function setSheetStatus(next: SheetStatus) {
  sheetStatus = next;
  listeners.forEach((listener) => listener());
}

// Load the sheet once so a missing or blocked sheet hides every icon instead
// of leaving empty boxes next to item names.
function subscribe(listener: () => void) {
  listeners.add(listener);
  if (!sheetRequested) {
    sheetRequested = true;
    const img = new window.Image();
    img.onload = () => setSheetStatus("loaded");
    img.onerror = () => setSheetStatus("error");
    img.src = SHEET_URL;
  }
  return () => {
    listeners.delete(listener);
  };
}

function toID(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, "");
}

/** Showdown sprite index for an item name or id, or null when unknown. */
export function getItemSpriteNum(item: string | null | undefined): number | null {
  if (!item) return null;
  const num = ITEM_SPRITE_NUMS[toID(item)];
  return typeof num === "number" ? num : null;
}

interface ItemIconProps {
  /** Item name ("Choice Scarf") or id ("choicescarf"). */
  item: string | null | undefined;
  /** Rendered size in px; multiples of 24 stay pixel-perfect. */
  size?: number;
  className?: string;
  /** Shown instead when the item is unknown or the sheet fails to load. */
  fallback?: ReactNode;
}

export function ItemIcon({ item, size = CELL, className, fallback = null }: ItemIconProps) {
  const status = useSyncExternalStore(
    subscribe,
    () => sheetStatus,
    () => "loading" as SheetStatus,
  );
  const num = getItemSpriteNum(item);
  if (num === null || status === "error") return <>{fallback}</>;

  const scale = size / CELL;
  const style: CSSProperties = {
    width: size,
    height: size,
    backgroundImage: `url(${SHEET_URL})`,
    backgroundRepeat: "no-repeat",
    backgroundSize: `${SHEET_WIDTH * scale}px ${SHEET_HEIGHT * scale}px`,
    backgroundPosition: `-${(num % PER_ROW) * size}px -${Math.floor(num / PER_ROW) * size}px`,
    imageRendering: "pixelated",
  };

  return (
    <span
      aria-hidden="true"
      className={cn("inline-block shrink-0 align-middle", className)}
      style={style}
    />
  );
}
