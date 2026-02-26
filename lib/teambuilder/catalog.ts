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
];

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

export function getItemSpriteUrl(item?: string): string | null {
  if (!item?.trim()) return null;
  const slug = item
    .trim()
    .toLowerCase()
    .replace(/[']/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/${slug}.png`;
}

