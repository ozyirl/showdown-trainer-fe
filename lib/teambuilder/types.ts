export const STAT_KEYS = ["hp", "atk", "def", "spa", "spd", "spe"] as const;

export type StatKey = (typeof STAT_KEYS)[number];

export type StatSpread = Record<StatKey, number>;

export interface PokemonSlot {
  id?: string;
  species: string;
  item: string;
  ability: string;
  moves: string[];
  evs: StatSpread;
  ivs: StatSpread;
  nature: string;
  nickname?: string;
}

export interface Team {
  id: string;
  name: string;
  format: string;
  notes?: string;
  slots: PokemonSlot[];
  createdAt?: string;
  updatedAt?: string;
}

export interface TeamListResponse {
  teams: Team[];
}

export interface TeamCreateInput {
  name: string;
  format: string;
  notes?: string;
  slots?: PokemonSlot[];
}

export type TeamPatchInput = Partial<Omit<Team, "id">>;
export type TeamSavePayload = Omit<Team, "id" | "createdAt" | "updatedAt">;

export interface ApiErrorPayload {
  message?: string | string[];
  error?: string;
  statusCode?: number;
}

export const DEFAULT_EVS: StatSpread = {
  hp: 0,
  atk: 0,
  def: 0,
  spa: 0,
  spd: 0,
  spe: 0,
};

export const DEFAULT_IVS: StatSpread = {
  hp: 31,
  atk: 31,
  def: 31,
  spa: 31,
  spd: 31,
  spe: 31,
};

export function createEmptySlot(): PokemonSlot {
  return {
    species: "",
    item: "",
    ability: "",
    moves: ["", "", "", ""],
    evs: { ...DEFAULT_EVS },
    ivs: { ...DEFAULT_IVS },
    nature: "Serious",
    nickname: "",
  };
}

export function createEmptyTeam(overrides?: Partial<Team>): Team {
  return {
    id: overrides?.id ?? "",
    name: overrides?.name ?? "Untitled Team",
    format: overrides?.format ?? "gen9ou",
    notes: overrides?.notes ?? "",
    slots: normalizeSlots(overrides?.slots ?? []),
    createdAt: overrides?.createdAt,
    updatedAt: overrides?.updatedAt,
  };
}

export function normalizeSpread(input?: Partial<StatSpread>, kind: "ev" | "iv" = "ev"): StatSpread {
  const defaults = kind === "ev" ? DEFAULT_EVS : DEFAULT_IVS;
  return {
    hp: clampStat(input?.hp ?? defaults.hp, kind),
    atk: clampStat(input?.atk ?? defaults.atk, kind),
    def: clampStat(input?.def ?? defaults.def, kind),
    spa: clampStat(input?.spa ?? defaults.spa, kind),
    spd: clampStat(input?.spd ?? defaults.spd, kind),
    spe: clampStat(input?.spe ?? defaults.spe, kind),
  };
}

export function normalizeSlot(slot?: Partial<PokemonSlot>): PokemonSlot {
  const moves = Array.isArray(slot?.moves) ? [...slot!.moves] : [];
  while (moves.length < 4) moves.push("");
  return {
    id: slot?.id,
    species: slot?.species ?? "",
    item: slot?.item ?? "",
    ability: slot?.ability ?? "",
    moves: moves.slice(0, 4).map((m) => m ?? ""),
    evs: normalizeSpread(slot?.evs, "ev"),
    ivs: normalizeSpread(slot?.ivs, "iv"),
    nature: slot?.nature ?? "Serious",
    nickname: slot?.nickname ?? "",
  };
}

export function normalizeSlots(slots: Partial<PokemonSlot>[]): PokemonSlot[] {
  return slots.slice(0, 6).map(normalizeSlot);
}

export function normalizeTeam(input: Partial<Team>): Team {
  return createEmptyTeam({
    ...input,
    id: input.id ?? "",
    slots: normalizeSlots(Array.isArray(input.slots) ? input.slots : []),
  });
}

export function clampStat(value: number, kind: "ev" | "iv"): number {
  const max = kind === "ev" ? 252 : 31;
  const min = 0;
  if (!Number.isFinite(value)) return min;
  return Math.max(min, Math.min(max, Math.round(value)));
}

export function totalEvs(slot: PokemonSlot): number {
  return STAT_KEYS.reduce((sum, key) => sum + (slot.evs[key] ?? 0), 0);
}

export function remainingEvs(slot: PokemonSlot): number {
  return 510 - totalEvs(slot);
}

export function validateSlot(slot: PokemonSlot): string[] {
  const errors: string[] = [];
  const total = totalEvs(slot);
  if (total > 510) errors.push(`Total EVs exceed 510 (${total})`);
  for (const key of STAT_KEYS) {
    const ev = slot.evs[key];
    const iv = slot.ivs[key];
    if (ev < 0 || ev > 252) errors.push(`${key.toUpperCase()} EV must be 0-252`);
    if (iv < 0 || iv > 31) errors.push(`${key.toUpperCase()} IV must be 0-31`);
  }
  if (slot.moves.filter((m) => m.trim()).length > 4) {
    errors.push("A Pokemon can have at most 4 moves");
  }
  return errors;
}

export function validateTeam(team: Team): string[] {
  const errors: string[] = [];
  if (team.slots.length > 6) errors.push("Team cannot have more than 6 Pokemon");
  team.slots.forEach((slot, idx) => {
    for (const err of validateSlot(slot)) errors.push(`Slot ${idx + 1}: ${err}`);
  });
  return errors;
}

function isSlotEmpty(slot: PokemonSlot): boolean {
  return (
    !slot.species.trim() &&
    !slot.item.trim() &&
    !slot.ability.trim() &&
    !slot.nickname?.trim() &&
    slot.moves.every((m) => !m.trim())
  );
}

export function sanitizeSlotForSave(slot: PokemonSlot): PokemonSlot {
  return {
    ...slot,
    species: slot.species.trim(),
    item: slot.item.trim(),
    ability: slot.ability.trim(),
    nickname: slot.nickname?.trim() || "",
    nature: slot.nature.trim() || "Serious",
    moves: slot.moves.map((m) => m.trim()).filter(Boolean).slice(0, 4),
    evs: normalizeSpread(slot.evs, "ev"),
    ivs: normalizeSpread(slot.ivs, "iv"),
  };
}

export function sanitizeTeamForSave(team: Team): TeamSavePayload {
  const cleanedSlots = team.slots
    .map(sanitizeSlotForSave)
    .filter((slot) => !isSlotEmpty(slot))
    .slice(0, 6);

  return {
    name: team.name.trim() || "Untitled Team",
    format: team.format.trim() || "gen9ou",
    notes: team.notes?.trim() || "",
    slots: cleanedSlots,
  };
}

export function coerceTeamListResponse(data: unknown): Team[] {
  if (Array.isArray(data)) return data.map((team) => normalizeTeam(team as Partial<Team>));
  if (data && typeof data === "object" && Array.isArray((data as TeamListResponse).teams)) {
    return (data as TeamListResponse).teams.map((team) => normalizeTeam(team));
  }
  return [];
}
