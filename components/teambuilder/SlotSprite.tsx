"use client";

import Image from "next/image";
import { useState, type ReactNode } from "react";

import {
  getPokemonFallbackSpriteUrl,
  getPokemonSpriteUrl,
} from "@/lib/teambuilder/catalog";
import { cn } from "@/lib/utils";

/**
 * Pokémon sprite that tries the animated sprite, then the static one, then
 * shows `fallback`. Failed URLs are remembered per source, so a new species
 * gets a fresh try without resetting state in an effect.
 */
export function SlotSprite({
  species,
  size,
  animated = true,
  className,
  fallback = null,
}: {
  species: string;
  size: number;
  /** Use the animated gen5 sprite first (static PNG otherwise). */
  animated?: boolean;
  className?: string;
  fallback?: ReactNode;
}) {
  const [failed, setFailed] = useState<string[]>([]);
  const candidates = [
    animated ? getPokemonSpriteUrl(species) : null,
    getPokemonFallbackSpriteUrl(species),
  ].filter((src): src is string => !!src && !failed.includes(src));
  const src = candidates[0];

  if (!src) return <>{fallback}</>;
  return (
    <Image
      key={src}
      src={src}
      alt={species}
      width={size}
      height={size}
      unoptimized
      className={cn("object-contain", className)}
      style={{ width: size, height: size, imageRendering: "pixelated" }}
      onError={() => setFailed((prev) => [...prev, src])}
    />
  );
}
