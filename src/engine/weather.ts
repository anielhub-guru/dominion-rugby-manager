import { Rng, hashSeed } from "./rng";

/**
 * Match weather. It is cosmetic: rain is drawn over the match and the narrator mentions it now and
 * then, but nothing about the match itself changes. It is picked from the match id with its own
 * hash, so it never touches the match Rng and a replay shows the same sky.
 */
export type WeatherId = "clear" | "drizzle" | "rain" | "storm";

export interface Weather {
  id: WeatherId;
  /** Sideways drift of the rain, -1 (blowing left) to 1 (blowing right). */
  wind: number;
}

export const WEATHERS: Record<WeatherId, { label: string; odds: number; drops: number; speed: number; alpha: number }> = {
  clear: { label: "Clear", odds: 0.6, drops: 0, speed: 0, alpha: 0 },
  drizzle: { label: "Drizzle", odds: 0.18, drops: 70, speed: 620, alpha: 0.28 },
  rain: { label: "Rain", odds: 0.16, drops: 170, speed: 820, alpha: 0.38 },
  storm: { label: "Heavy rain", odds: 0.06, drops: 320, speed: 1000, alpha: 0.5 },
};

const ORDER: readonly WeatherId[] = ["clear", "drizzle", "rain", "storm"];

export function weatherFor(matchId: string): Weather {
  const rng = new Rng(hashSeed(matchId, "weather"));
  let roll = rng.next();
  let id: WeatherId = "clear";
  for (const w of ORDER) {
    id = w;
    roll -= WEATHERS[w].odds;
    if (roll < 0) break;
  }
  const wind = id === "storm" ? rng.signed() * 1.6 : rng.signed();
  return { id, wind: Math.max(-1, Math.min(1, wind)) };
}

export const isWet = (w: Weather | undefined): boolean => !!w && w.id !== "clear";

/** Short description for the match header, e.g. "Heavy rain". */
export const weatherLabel = (w: Weather | undefined): string => WEATHERS[w?.id ?? "clear"].label;

type Line = readonly string[];
type Bank = Partial<Record<"kickoff" | "halftime" | "knock-on" | "kick" | "try" | "miss", Record<Exclude<WeatherId, "clear">, Line>>>;

const BANK: Bank = {
  kickoff: {
    drizzle: ["A fine drizzle is settling over the pitch.", "There is a light drizzle in the air."],
    rain: ["The rain is coming down steadily.", "It is a wet night at the Arena, with the rain falling steadily."],
    storm: ["The rain is hammering down. These are testing conditions.", "A real downpour tonight, and the pitch is already greasy."],
  },
  halftime: {
    drizzle: ["The drizzle has not let up."],
    rain: ["The rain has not eased at all."],
    storm: ["The rain is still lashing down. Both sides will be glad of the break."],
  },
  "knock-on": {
    drizzle: ["The ball is a touch slippery in the damp.", "The drizzle is making the ball hard to hold."],
    rain: ["Hardly surprising in this rain.", "The ball is greasy in the wet."],
    storm: ["Nobody could blame ${p} in this downpour.", "Impossible to hold the ball in this weather."],
  },
  kick: {
    drizzle: ["The ball sails through the drizzle.", "A damp ball and a damp pitch."],
    rain: ["The ball hangs in the rain.", "A tough kick in the wet."],
    storm: ["That is a hard one to judge through the downpour.", "The rain is making it a lottery out there."],
  },
  try: {
    drizzle: ["A fine score in the drizzle.", "That drizzle has not stopped them."],
    rain: ["Superb handling in these wet conditions.", "They keep their hands in the rain."],
    storm: ["A try in the middle of a downpour. Wonderful stuff.", "Brilliant in conditions like this."],
  },
  miss: {
    drizzle: ["The damp may have played its part."],
    rain: ["The wet ball does not help.", "The rain did not make that any easier."],
    storm: ["Kicking in this downpour is no easy task.", "The rain is making goal-kicking a nightmare."],
  },
};

const BANK_KEY: Partial<Record<string, keyof Bank>> = {
  kickoff: "kickoff",
  halftime: "halftime",
  "knock-on": "knock-on",
  kick: "kick",
  try: "try",
  "conversion-miss": "miss",
  "penalty-miss": "miss",
  "drop-miss": "miss",
};

/** Chance that a moment gets a weather remark. Kick-off and half time always do. */
const CHANCE: Partial<Record<keyof Bank, number>> = { kickoff: 1, halftime: 1, "knock-on": 0.5, kick: 0.12, try: 0.2, miss: 0.5 };

/**
 * Gives out weather remarks for the narrator. It owns its own Rng, so in the dry the commentary is
 * exactly what it was before weather existed.
 */
export class WeatherTalk {
  private rng: Rng;
  private last = new Map<string, string>();
  constructor(
    private weather: Weather,
    seed: number,
  ) {
    this.rng = new Rng((seed ^ 0x51ed270b) >>> 0);
  }

  /** A sentence to add after an event's text, or "" when there is nothing to say. */
  remark(type: string, player?: string): string {
    if (this.weather.id === "clear") return "";
    const key = BANK_KEY[type];
    const lines = key && BANK[key]?.[this.weather.id as Exclude<WeatherId, "clear">];
    if (!key || !lines) return "";
    if (!this.rng.chance(CHANCE[key] ?? 0)) return "";
    const options = lines.length > 1 ? lines.filter((l) => l !== this.last.get(key)) : lines;
    const line = this.rng.pick(options);
    this.last.set(key, line);
    return line.replace("${p}", player ?? "anyone");
  }
}
