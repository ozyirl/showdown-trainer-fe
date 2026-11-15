export const COMMON_SPECIES = [
  "Charizard",
  "Gengar",
  "Dragonite",
  "Great Tusk",
  "Gholdengo",
  "Kingambit",
  "Iron Valiant",
  "Landorus-Therian",
  "Rotom-Wash",
  "Corviknight",
  "Dragapult",
  "Heatran",
  "Gliscor",
  "Clefable",
  "Rillaboom",
  "Zamazenta",
  "Samurott-Hisui",
  "Ogerpon-Wellspring",
  "Raging Bolt",
  "Garganacl",
];

export const COMMON_ITEMS = [
  "Heavy-Duty Boots",
  "Leftovers",
  "Choice Scarf",
  "Choice Specs",
  "Choice Band",
  "Life Orb",
  "Focus Sash",
  "Rocky Helmet",
  "Assault Vest",
  "Booster Energy",
  "Air Balloon",
  "Covert Cloak",
  "Loaded Dice",
  "Black Sludge",
  "Sitrus Berry",
  "Lum Berry",
  "Custap Berry",
  "Eviolite",
  "Expert Belt",
  "Safety Goggles",
  "Weakness Policy",
  "Power Herb",
  "Mental Herb",
  "Mirror Herb",
  "Red Card",
  "Clear Amulet",
  "Terrain Extender",
  "Light Clay",
  "Flame Orb",
  "Toxic Orb",
  "Scope Lens",
  "Shell Bell",
  "Throat Spray",
  "White Herb",
  "Room Service",
  "Wide Lens",
  "King's Rock",
  "Razor Claw",
  "Rocky Payload",
  "Black Glasses",
  "Charcoal",
  "Mystic Water",
  "Magnet",
  "Spell Tag",
  "Soft Sand",
  "Never-Melt Ice",
  "Poison Barb",
  "Twisted Spoon",
  "Sharp Beak",
  "Dragon Fang",
  "Metal Coat",
  "Miracle Seed",
  "Silk Scarf",
  "Punching Glove",
  "Protective Pads",
  "Ability Shield",
  "Focus Band",
  "Quick Claw",
  "Metronome",
  "Wise Glasses",
  "Muscle Band",
  "Lagging Tail",
  "Damp Rock",
  "Smooth Rock",
  "Heat Rock",
  "Icy Rock",
];

export const COMMON_MOVES = [
  "Flamethrower",
  "Fire Blast",
  "Air Slash",
  "Roost",
  "Earthquake",
  "U-turn",
  "Knock Off",
  "Stealth Rock",
  "Rapid Spin",
  "Shadow Ball",
  "Thunderbolt",
  "Focus Blast",
  "Recover",
  "Draco Meteor",
  "Moonblast",
  "Protect",
  "Will-O-Wisp",
  "Taunt",
  "Toxic",
  "Substitute",
  "Swords Dance",
  "Nasty Plot",
  "Calm Mind",
  "Dragon Dance",
  "Bulk Up",
  "Close Combat",
  "Aura Sphere",
  "Hydro Pump",
  "Surf",
  "Scald",
  "Volt Switch",
  "Thunder Wave",
  "Ice Beam",
  "Blizzard",
  "Dark Pulse",
  "Shadow Sneak",
  "Hex",
  "Sludge Bomb",
  "Sludge Wave",
  "Moonlight",
  "Morning Sun",
  "Wish",
  "Teleport",
  "Defog",
  "Spikes",
  "Toxic Spikes",
  "Sticky Web",
  "Encore",
  "Trick",
  "Psyshock",
  "Psychic",
  "Draining Kiss",
  "Body Press",
  "Iron Head",
  "Flash Cannon",
  "Earth Power",
  "Leaf Storm",
  "Giga Drain",
  "Flower Trick",
  "Aqua Jet",
  "Extreme Speed",
  "First Impression",
  "Sucker Punch",
];

const NATURE_EFFECTS: Record<
  string,
  { up?: keyof BaseStats; down?: keyof BaseStats }
> = {
  Lonely: { up: "atk", down: "def" },
  Brave: { up: "atk", down: "spe" },
  Adamant: { up: "atk", down: "spa" },
  Naughty: { up: "atk", down: "spd" },
  Bold: { up: "def", down: "atk" },
  Relaxed: { up: "def", down: "spe" },
  Impish: { up: "def", down: "spa" },
  Lax: { up: "def", down: "spd" },
  Timid: { up: "spe", down: "atk" },
  Hasty: { up: "spe", down: "def" },
  Jolly: { up: "spe", down: "spa" },
  Naive: { up: "spe", down: "spd" },
  Modest: { up: "spa", down: "atk" },
  Mild: { up: "spa", down: "def" },
  Quiet: { up: "spa", down: "spe" },
  Rash: { up: "spa", down: "spd" },
  Calm: { up: "spd", down: "atk" },
  Gentle: { up: "spd", down: "def" },
  Sassy: { up: "spd", down: "spe" },
  Careful: { up: "spd", down: "spa" },
};

export interface BaseStats {
  hp: number;
  atk: number;
  def: number;
  spa: number;
  spd: number;
  spe: number;
}

export interface PokemonLookup {
  name: string;
  types?: string[];
  tier?: string;
}

export interface PokemonDetails {
  name: string;
  baseStats: BaseStats;
  types?: string[];
  abilities?: Record<string, string>;
  tier?: string;
}

export function rankSearch(
  items: string[],
  query: string,
  limit = 20,
): string[] {
  const q = query.trim().toLowerCase();
  const source = Array.from(new Set(items));
  if (!q) return source.slice(0, limit);

  return source
    .map((item) => {
      const value = item.toLowerCase();
      let score = 9999;
      if (value === q) score = 0;
      else if (value.startsWith(q)) score = 1;
      else if (value.includes(` ${q}`) || value.includes(`-${q}`)) score = 2;
      else if (value.includes(q)) score = 3;
      return { item, score, pos: value.indexOf(q) };
    })
    .filter((row) => row.score < 9999)
    .sort(
      (a, b) =>
        a.score - b.score || a.pos - b.pos || a.item.localeCompare(b.item),
    )
    .slice(0, limit)
    .map((row) => row.item);
}

export async function searchPokemonCatalog(
  query: string,
  limit = 25,
): Promise<PokemonLookup[]> {
  const base = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:5200/api";
  const response = await fetch(
    `${base}/battle/pokemon?q=${encodeURIComponent(query)}&limit=${limit}`,
  );
  if (!response.ok) {
    throw new Error("Failed to search Pokemon");
  }
  const data = (await response.json()) as unknown;
  if (!Array.isArray(data)) return [];
  return data
    .map((entry) =>
      entry && typeof entry === "object"
        ? (entry as Record<string, unknown>)
        : null,
    )
    .filter(Boolean)
    .map((entry) => ({
      name: String(entry?.name ?? ""),
      types: Array.isArray(entry?.types)
        ? (entry?.types as string[])
        : undefined,
      tier: typeof entry?.tier === "string" ? entry.tier : undefined,
    }))
    .filter((entry) => entry.name);
}

export async function fetchPokemonDetails(
  species: string,
): Promise<PokemonDetails | null> {
  const q = species.trim();
  if (!q) return null;
  const base = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:5200/api";
  const response = await fetch(
    `${base}/battle/pokemon/${encodeURIComponent(q)}`,
  );
  if (!response.ok) return null;
  const data = (await response.json()) as Partial<PokemonDetails>;
  if (!data?.baseStats || !data.name) return null;
  return {
    name: data.name,
    baseStats: data.baseStats,
    types: data.types,
    abilities: data.abilities,
    tier: data.tier,
  };
}

export function getNatureModifier(
  nature: string,
  stat: keyof BaseStats,
): number {
  if (stat === "hp") return 1;
  const effect = NATURE_EFFECTS[nature];
  if (!effect) return 1;
  if (effect.up === stat) return 1.1;
  if (effect.down === stat) return 0.9;
  return 1;
}

export function calculateStat(
  stat: keyof BaseStats,
  base: number,
  iv: number,
  ev: number,
  level = 100,
  nature = "Serious",
): number {
  if (stat === "hp") {
    if (base === 1) return 1;
    return (
      Math.floor(((2 * base + iv + Math.floor(ev / 4)) * level) / 100) +
      level +
      10
    );
  }
  const raw =
    Math.floor(((2 * base + iv + Math.floor(ev / 4)) * level) / 100) + 5;
  return Math.floor(raw * getNatureModifier(nature, stat));
}

function normalizeSpriteName(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[\s.']/g, "")
    .replace(/♀/g, "f")
    .replace(/♂/g, "m");
}

export function getPokemonSpriteUrl(species?: string): string | null {
  if (!species?.trim()) return null;
  return `https://play.pokemonshowdown.com/sprites/gen5ani/${normalizeSpriteName(species)}.gif`;
}

export function getPokemonFallbackSpriteUrl(species?: string): string | null {
  if (!species?.trim()) return null;
  return `https://play.pokemonshowdown.com/sprites/gen5/${normalizeSpriteName(species)}.png`;
}
