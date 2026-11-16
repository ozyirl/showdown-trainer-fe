import { CornerFrame } from "@/components/battle/panel";
import { cn } from "@/lib/utils";

/**
 * A dotted drawing of a fruit-fly brain (two optic lobes either side of the central
 * brain), used as the badge of the Fly CNS model card. Its colours echo the neuron
 * populations of the battle screen's fly brain: mostly central (blue), with the
 * mushroom bodies (orange) and a few descending neurons (green).
 */

const WIDTH = 96;
const HEIGHT = 56;
const STEP = 3;

type Dot = {
  x: number;
  y: number;
  fill: string;
  opacity: number;
  spark: boolean;
};

function inEllipse(
  x: number,
  y: number,
  cx: number,
  cy: number,
  rx: number,
  ry: number,
) {
  return ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1;
}

/** Deterministic 0..1 hash noise so the drawing is the same on server and client. */
function noise(x: number, y: number) {
  let hash = Math.imul(x, 374761393) + Math.imul(y, 668265263);
  hash = Math.imul(hash ^ (hash >>> 13), 1274126177);
  hash ^= hash >>> 16;
  return (hash >>> 0) / 4294967296;
}

const DOTS: Dot[] = (() => {
  const dots: Dot[] = [];
  for (let y = STEP; y < HEIGHT; y += STEP) {
    for (let x = STEP; x < WIDTH; x += STEP) {
      const central = inEllipse(x, y, 48, 27, 17, 15);
      const lobe =
        inEllipse(x, y, 17, 26, 12.5, 18) || inEllipse(x, y, 79, 26, 12.5, 18);
      const cord = inEllipse(x, y, 48, 44, 5, 9);
      if (!central && !lobe && !cord) continue;
      const n = noise(x, y);
      if (n < (lobe ? 0.24 : 0.12)) continue;
      const spark = n > 0.93;
      const mushroom =
        inEllipse(x, y, 41, 19, 4.5, 5) || inEllipse(x, y, 55, 19, 4.5, 5);
      if (mushroom && n > 0.3) {
        dots.push({ x, y, fill: "#fb923c", opacity: 1, spark });
      } else if (cord && n > 0.5) {
        dots.push({ x, y, fill: "#34d399", opacity: 0.9, spark });
      } else {
        const shade = n > 0.8 ? "#e2e7ff" : n > 0.5 ? "#9aabff" : "#5f78ff";
        dots.push({
          x,
          y,
          fill: shade,
          opacity: lobe ? 0.5 + n * 0.4 : 0.65 + n * 0.35,
          spark,
        });
      }
    }
  }
  return dots;
})();

export function FlyBrainMotif({
  active,
  className,
}: {
  active: boolean;
  className?: string;
}) {
  return (
    <CornerFrame
      className={cn("grid shrink-0 place-items-center p-1.5", className)}
    >
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        className={cn(
          "h-full w-full transition-opacity",
          active ? "opacity-100" : "opacity-75",
        )}
        aria-hidden
      >
        {DOTS.map((dot) => (
          <rect
            key={`${dot.x}-${dot.y}`}
            x={dot.x - 0.85}
            y={dot.y - 0.85}
            width={1.7}
            height={1.7}
            fill={dot.spark && active ? "#ffffff" : dot.fill}
            opacity={dot.opacity}
            // While the card is selected a few neurons "fire".
            className={
              dot.spark && active ? "motion-safe:animate-pulse" : undefined
            }
            style={
              dot.spark && active
                ? { animationDelay: `${((dot.x * 7 + dot.y * 13) % 20) / 10}s` }
                : undefined
            }
          />
        ))}
      </svg>
    </CornerFrame>
  );
}
