"use client";

import { UserButton } from "@clerk/nextjs";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import TextCursorProximity from "@/components/fancy/text/text-cursor-proximity";
import ScrambleHover from "@/components/fancy/text/scramble-hover";
import PixelTrail from "@/components/fancy/background/pixel-trail";
import Float from "@/components/fancy/blocks/float";
import { HeartIcon } from "lucide-react";

const BRAND = "#0015ff";

const POKEMON = [
  { name: "Charizard", types: ["Fire", "Flying"] },
  { name: "Gengar", types: ["Ghost", "Poison"] },
  { name: "Mewtwo", types: ["Psychic"] },
  { name: "Dragonite", types: ["Dragon", "Flying"] },
];

const TYPE_COLOR: Record<string, string> = {
  Normal: "bg-zinc-400/20 text-zinc-300",
  Fire: "bg-orange-500/20 text-orange-300",
  Water: "bg-blue-500/20 text-blue-300",
  Electric: "bg-yellow-400/20 text-yellow-300",
  Grass: "bg-green-500/20 text-green-300",
  Ice: "bg-cyan-400/20 text-cyan-300",
  Fighting: "bg-red-600/20 text-red-400",
  Poison: "bg-fuchsia-500/20 text-fuchsia-300",
  Ground: "bg-amber-600/20 text-amber-400",
  Flying: "bg-sky-400/20 text-sky-300",
  Psychic: "bg-pink-500/20 text-pink-300",
  Bug: "bg-lime-500/20 text-lime-300",
  Rock: "bg-stone-500/20 text-stone-300",
  Ghost: "bg-purple-500/20 text-purple-300",
  Dragon: "bg-indigo-500/20 text-indigo-300",
  Dark: "bg-neutral-600/20 text-neutral-300",
  Steel: "bg-slate-400/20 text-slate-300",
  Fairy: "bg-rose-400/20 text-rose-300",
};

const TAGS = [
  "Random Battle",
  "Gen 9",
  "Competitive",
  "OU Tier",
  "Team Preview",
  "EV Training",
  "Metagame",
  "Ladder",
];

const proximityStyles = {
  title: { filter: { from: "blur(0px)", to: "blur(6px)" } },
} as const;

function spriteGif(name: string) {
  return `https://play.pokemonshowdown.com/sprites/gen5ani/${name.toLowerCase()}.gif`;
}

function spritePng(name: string) {
  return `https://play.pokemonshowdown.com/sprites/gen5/${name.toLowerCase()}.png`;
}

function PokemonSprite({
  name,
  className,
  width,
  height,
}: {
  name: string;
  className: string;
  width: number;
  height: number;
}) {
  const gifSrc = spriteGif(name);
  const pngSrc = spritePng(name);
  const [src, setSrc] = useState(gifSrc);

  useEffect(() => {
    setSrc(gifSrc);
  }, [gifSrc]);

  return (
    <Image
      src={src}
      alt={name}
      width={width}
      height={height}
      unoptimized
      className={className}
      onError={() => {
        if (src !== pngSrc) setSrc(pngSrc);
      }}
    />
  );
}

function TypeChip({ type }: { type: string }) {
  const colors = TYPE_COLOR[type] ?? "bg-white/10 text-white/70";
  return (
    <span
      className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${colors}`}
    >
      {type}
    </span>
  );
}

const maskBase: React.CSSProperties = {
  WebkitMaskSize: "100% 100%",
  maskSize: "100% 100%",
  WebkitMaskRepeat: "no-repeat",
  maskRepeat: "no-repeat",
  WebkitMaskPosition: "center",
  maskPosition: "center",
};

const glass =
  "rounded-3xl border border-white/10 bg-white/5 backdrop-blur-md overflow-hidden";

export default function Home() {
  const pageRef = useRef<HTMLDivElement>(null);

  return (
    <div className="relative min-h-screen bg-[#efefef] text-white">
      {/* Fixed gradient background */}

      {/* Pixel trail cursor effect */}
      <div className="fixed inset-0 z-0">
        <PixelTrail
          pixelSize={48}
          fadeDuration={500}
          pixelClassName="bg-white/8"
        />
      </div>

      {/* Page content */}
      <div className="relative z-10 min-h-screen bg-black">
        <div
          ref={pageRef}
          className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8"
        >
          {/* ── Navigation ── */}
          <nav className="mb-10 flex items-center justify-between">
            <Link href="/" className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/10 text-base">
                ⚔️
              </div>
              <span className="text-sm font-bold uppercase tracking-[0.08em]">
                Showdown Trainer
              </span>
            </Link>
            <div className="flex items-center gap-6 text-sm">
              <Link
                href="/battle"
                className="text-white/60 transition-colors hover:text-white"
              >
                <ScrambleHover
                  text="Battle"
                  scrambleSpeed={40}
                  maxIterations={6}
                  className="cursor-pointer"
                />
              </Link>
              <Link
                href="/teambuilder"
                className="text-white/60 transition-colors hover:text-white"
              >
                <ScrambleHover
                  text="Teambuilder"
                  scrambleSpeed={40}
                  maxIterations={6}
                  className="cursor-pointer"
                />
              </Link>
              <UserButton afterSignOutUrl="/" />
            </div>
          </nav>

          {/* ── Shaped Bento Hero ── */}
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1.4fr_1fr]">
            {/* ─ Left panel: sub1.png mask ─ */}
            <div
              className="relative min-h-[520px] border border-white/10 bg-white/5 px-8 pb-8 pt-18 backdrop-blur-md lg:min-h-[560px]"
              style={{
                ...maskBase,
                WebkitMaskImage: "url(/sub1.png)",
                maskImage: "url(/sub1.png)",
              }}
            >
              {/* Top: hero text + tags */}
              <div>
                <div className="max-w-md uppercase leading-[0.95] tracking-tight">
                  <TextCursorProximity
                    className="block text-3xl font-bold text-white sm:text-5xl"
                    styles={proximityStyles.title}
                    falloff="gaussian"
                    radius={110}
                    containerRef={pageRef}
                  >
                    Build Your Team
                  </TextCursorProximity>
                  <TextCursorProximity
                    className="block text-3xl font-bold sm:text-5xl"
                    styles={proximityStyles.title}
                    falloff="gaussian"
                    radius={110}
                    containerRef={pageRef}
                    style={{ color: BRAND }}
                  >
                    Train With AI
                  </TextCursorProximity>
                </div>
                <div className="mt-5 flex flex-wrap gap-2">
                  {TAGS.map((tag) => (
                    <span
                      key={tag}
                      className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-white/55 transition-colors hover:border-white/20 hover:text-white/80"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </div>

              {/* Bottom: featured Pokemon */}
              <div className="mt-8 flex items-start justify-between">
                <div>
                  <p className="mt-2 max-w-xs text-md font-semibold leading-relaxed text-white/50">
                    Built by oz2ez
                  </p>
                </div>
                <Float
                  speed={0.3}
                  amplitude={[8, 15, 10]}
                  rotationRange={[5, 8, 3]}
                >
                  <PokemonSprite
                    name={POKEMON[0].name}
                    width={192}
                    height={192}
                    className="h-36 w-36 object-contain drop-shadow-[0_0_40px_rgba(255,120,0,0.3)] lg:h-48 lg:w-48"
                  />
                </Float>
              </div>
            </div>

            {/* ─ Right panel: sub2.png mask ─ */}
            <div
              className="relative min-h-[520px] border border-white/10 bg-white/5 px-8 pb-8 pt-18 backdrop-blur-md lg:min-h-[560px]"
              style={{
                ...maskBase,
                WebkitMaskImage: "url(/sub2.png)",
                maskImage: "url(/sub2.png)",
              }}
            >
              <div className="flex h-full flex-col justify-between">
                {/* Welcome + Description */}
                <div>
                  <div className="text-[10px] font-medium tracking-[0.18em] text-white/40">
                    WELCOME
                  </div>
                  <p className="mt-3 max-w-sm text-sm leading-relaxed text-white/70">
                    Build your dream team, battle an AI opponent with real-time
                    reasoning, and sharpen your competitive strategy.
                  </p>

                  <Link
                    href="/battle"
                    className="group mt-4 flex items-center gap-2 text-sm font-medium text-white/60 transition-colors hover:text-white"
                  >
                    Get started
                    <span className="transition-transform group-hover:translate-x-1">
                      →
                    </span>
                  </Link>
                </div>

                {/* CTA + Pokemon showcase */}
                <div className="mt-6 flex items-end justify-between gap-4">
                  <div>
                    <div className="text-lg font-bold tracking-tight">
                      Start Battle
                    </div>
                    <p className="mt-1 text-xs text-white/45">
                      Challenge the AI in a competitive match.
                    </p>
                    <Link
                      href="/battle"
                      className="mt-4 inline-flex rounded-full px-6 py-2.5 text-sm font-semibold text-white transition-all hover:scale-105 hover:shadow-[0_0_30px_-5px_rgba(0,21,255,0.6)]"
                      style={{ backgroundColor: BRAND }}
                    >
                      Play Now
                    </Link>
                  </div>
                  <Float
                    speed={0.25}
                    amplitude={[6, 10, 8]}
                    rotationRange={[4, 6, 2]}
                    timeOffset={2}
                  >
                    <PokemonSprite
                      name={POKEMON[3].name}
                      width={144}
                      height={144}
                      className="h-28 w-28 object-contain drop-shadow-[0_0_25px_rgba(100,100,255,0.2)] lg:h-36 lg:w-36"
                    />
                  </Float>
                </div>
              </div>
            </div>
          </div>

          {/* ── Pokemon Showcase Strip ── */}

          {/* ── Feature Cards ── */}
          <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-3">
            <Link
              href="/teambuilder"
              className={`${glass} p-5 transition-colors hover:border-white/20`}
            >
              <div className="text-[10px] font-medium tracking-[0.18em] text-white/40">
                TEAMBUILDER
              </div>
              <div className="mt-2 text-base font-semibold">
                Create Custom Teams
              </div>
              <p className="mt-1.5 text-xs leading-relaxed text-white/50">
                Build and save teams with custom move sets, EVs, and items
                before queueing into battles.
              </p>
            </Link>

            <div
              className="rounded-3xl border border-white/15 p-5 backdrop-blur-md"
              style={{
                background: `linear-gradient(160deg, ${BRAND}10, transparent)`,
              }}
            >
              <div className="text-[10px] font-medium tracking-[0.18em] text-white/40">
                ELITE FOUR MODE
              </div>
              <div className="mt-2 text-base font-semibold">
                Fight Elite 4 &bull; Any Region
              </div>
              <p className="mt-1.5 text-xs leading-relaxed text-white/50">
                Progression mode with region presets, staged teams, and run
                tracking.
              </p>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {["Kanto", "Johto", "Hoenn", "Sinnoh", "Unova", "Paldea"].map(
                  (r) => (
                    <span
                      key={r}
                      className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] text-white/45"
                    >
                      {r}
                    </span>
                  ),
                )}
              </div>
            </div>

            <div className={`${glass} p-5`}>
              <div className="text-[10px] font-medium tracking-[0.18em] text-white/40">
                AI TRAINER
              </div>
              <div className="mt-2 text-base font-semibold">
                Live CPU Reasoning
              </div>
              <p className="mt-1.5 text-xs leading-relaxed text-white/50">
                See exactly why the AI chose each move with confidence scores,
                matchup analysis, and alternative plays.
              </p>
              <div
                className="mt-3 inline-flex rounded-full border px-2.5 py-1 text-[10px]"
                style={{
                  borderColor: `${BRAND}33`,
                  backgroundColor: `${BRAND}12`,
                  color: "rgba(173,186,255,0.95)",
                }}
              >
                Powered by AI analysis
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="sticky bottom-0 left-0 z-0 h-80 w-full bg-[#0015ff]">
        <div className="relative flex h-full w-full items-start justify-end overflow-hidden px-8 py-10 text-right text-white sm:px-12">
          <div className="absolute left-6 top-6 sm:left-10 sm:top-10">
            <Float
              speed={0.22}
              amplitude={[4, 8, 6]}
              rotationRange={[2, 4, 2]}
              timeOffset={1}
            >
              <PokemonSprite
                name={POKEMON[1].name}
                width={96}
                height={96}
                className="h-20 w-20 object-contain drop-shadow-[0_0_24px_rgba(255,255,255,0.28)] lg:h-24 lg:w-24"
              />
            </Float>
          </div>
          <div className="flex flex-row space-x-12 text-sm sm:space-x-16 sm:text-lg md:space-x-24 md:text-xl">
            <ul>
              <li>
                <Link className="hover:underline" href="/battle">
                  Battle
                </Link>
              </li>
              <li>
                <Link className="hover:underline" href="/teambuilder">
                  Teambuilder
                </Link>
              </li>
            </ul>
            <ul>
              <li>
                <a
                  className="hover:underline"
                  href="https://github.com/ozyirl"
                  target="_blank"
                  rel="noreferrer"
                >
                  Github
                </a>
              </li>
              <li>
                <a
                  className="hover:underline"
                  href="https://www.ozy.ninja/"
                  target="_blank"
                  rel="noreferrer"
                >
                  Portfolio
                </a>
              </li>
              <li>
                <a
                  className="hover:underline"
                  href="https://x.com/ozy2ez"
                  target="_blank"
                  rel="noreferrer"
                >
                  X (Twitter)
                </a>
              </li>
            </ul>
          </div>
          <div className="absolute bottom-4 right-8 flex items-center text-xs text-white/75 sm:right-12">
            Happy pokemon 30
            <HeartIcon className="ml-2 h-4 w-4 fill-white" />
          </div>
          <h2 className="absolute bottom-0 left-0 translate-y-1/3 text-[40px] font-bold uppercase text-white/20 sm:text-[128px] md:text-[192px]">
            kekeke
          </h2>
        </div>
      </div>
    </div>
  );
}
