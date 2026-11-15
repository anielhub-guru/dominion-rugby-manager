import { Rng, hashSeed } from "./rng";

/**
 * Match weather. It is cosmetic: rain is drawn over the match and the narrator mentions it now and
 * then, but nothing about the match itself changes. It is picked from the match id with its own
 * hash, so it never touches the match Rng and a replay shows the same sky.
 */
export type WeatherId = "clear" | "drizzle" | "rain" | "storm" | "windy" | "harmattan" | "sunny" | "hot";

export interface Weather {
  id: WeatherId;
  /** Sideways drift of rain and dust, -1 (blowing left) to 1 (blowing right). */
  wind: number;
  /** Temperature in °C, for the match report. Missing on logs saved before it existed. */
  temp?: number;
}

/** How a sky is drawn: falling rain, dust and leaves blown sideways, a dusty haze with slow specks, a sunny glow, or heat shimmer. */
export type WeatherFx = "none" | "rain" | "gust" | "haze" | "sun" | "heat";

export const WEATHERS: Record<WeatherId, { label: string; odds: number; fx: WeatherFx; drops: number; speed: number; alpha: number }> = {
  clear: { label: "Clear", odds: 0.36, fx: "none", drops: 0, speed: 0, alpha: 0 },
  drizzle: { label: "Drizzle", odds: 0.12, fx: "rain", drops: 70, speed: 620, alpha: 0.28 },
  rain: { label: "Rain", odds: 0.12, fx: "rain", drops: 170, speed: 820, alpha: 0.38 },
  storm: { label: "Heavy rain", odds: 0.04, fx: "rain", drops: 320, speed: 1000, alpha: 0.5 },
  windy: { label: "Windy", odds: 0.09, fx: "gust", drops: 60, speed: 520, alpha: 0.4 },
  harmattan: { label: "Harmattan haze", odds: 0.06, fx: "haze", drops: 70, speed: 40, alpha: 0.5 },
  sunny: { label: "Sunny", odds: 0.12, fx: "sun", drops: 0, speed: 0, alpha: 0.3 },
  hot: { label: "Hot", odds: 0.09, fx: "heat", drops: 14, speed: 30, alpha: 0.18 },
};

const ORDER: readonly WeatherId[] = ["clear", "drizzle", "rain", "storm", "windy", "harmattan", "sunny", "hot"];

/** Daytime temperature range (°C) for each sky. */
const TEMP: Record<WeatherId, readonly [number, number]> = {
  clear: [25, 32],
  drizzle: [22, 26],
  rain: [21, 25],
  storm: [20, 24],
  windy: [25, 30],
  harmattan: [27, 33],
  sunny: [29, 34],
  hot: [35, 40],
};

const ICON: Record<WeatherId, string> = { clear: "⛅", drizzle: "🌦", rain: "🌧", storm: "⛈", windy: "💨", harmattan: "🌫", sunny: "☀️", hot: "🌡" };

export function weatherFor(matchId: string): Weather {
  const rng = new Rng(hashSeed(matchId, "weather"));
  let roll = rng.next();
  let id: WeatherId = "clear";
  for (const w of ORDER) {
    id = w;
    roll -= WEATHERS[w].odds;
    if (roll < 0) break;
  }
  let wind = id === "storm" ? rng.signed() * 1.6 : rng.signed();
  // A windy day always blows hard one way or the other.
  if (id === "windy") wind = (wind < 0 ? -1 : 1) * (0.6 + Math.abs(wind) * 0.4);
  const [lo, hi] = TEMP[id];
  return { id, wind: Math.max(-1, Math.min(1, wind)), temp: rng.int(lo, hi) };
}

export const isWet = (w: Weather | undefined): boolean => !!w && WEATHERS[w.id].fx === "rain";

/** Short description for the match header, e.g. "Heavy rain". */
export const weatherLabel = (w: Weather | undefined): string => WEATHERS[w?.id ?? "clear"].label;

type Line = readonly string[];
type Bank = Partial<Record<"kickoff" | "halftime" | "knock-on" | "kick" | "try" | "miss", Record<Exclude<WeatherId, "clear">, Line>>>;

const BANK: Bank = {
  kickoff: {
    drizzle: ["A fine drizzle is settling over the pitch.", "There is a light drizzle in the air."],
    rain: ["The rain is coming down steadily.", "It is a wet night at the Arena, with the rain falling steadily."],
    storm: ["The rain is hammering down. These are testing conditions.", "A real downpour tonight, and the pitch is already greasy."],
    windy: ["A strong wind is blowing across the Arena.", "It is a blustery day, and the flags are standing straight out."],
    harmattan: ["The harmattan haze hangs over the Arena, dry and dusty.", "A hazy, dusty harmattan afternoon, with the dust hanging in the air."],
    sunny: ["The sun is shining on the Arena.", "A bright, sunny afternoon, perfect for rugby."],
    hot: ["It is sweltering out there. Both sides will feel the heat.", "A scorching afternoon at the Arena, with the heat shimmering off the pitch."],
  },
  halftime: {
    drizzle: ["The drizzle has not let up."],
    rain: ["The rain has not eased at all."],
    storm: ["The rain is still lashing down. Both sides will be glad of the break."],
    windy: ["The wind has not dropped at all."],
    harmattan: ["The harmattan haze is still hanging over the pitch."],
    sunny: ["The sun is still shining as the teams head off."],
    hot: ["The heat is still intense. Plenty of water bottles out there."],
  },
  "knock-on": {
    drizzle: ["The ball is a touch slippery in the damp.", "The drizzle is making the ball hard to hold."],
    rain: ["Hardly surprising in this rain.", "The ball is greasy in the wet."],
    storm: ["Nobody could blame ${p} in this downpour.", "Impossible to hold the ball in this weather."],
    windy: ["The wind gets under the ball.", "A gust did not help there."],
    harmattan: ["Dry hands and dust, and the ball squirts out.", "The dust is making it hard to hold on."],
    sunny: ["The ball is dropped in the bright sunshine.", "Perhaps the sun was in the eyes there."],
    hot: ["Sweaty hands, and the ball slips out.", "The heat is getting to the handling."],
  },
  kick: {
    drizzle: ["The ball sails through the drizzle.", "A damp ball and a damp pitch."],
    rain: ["The ball hangs in the rain.", "A tough kick in the wet."],
    storm: ["That is a hard one to judge through the downpour.", "The rain is making it a lottery out there."],
    windy: ["The wind carries the ball.", "A kick into the teeth of the wind."],
    harmattan: ["The ball goes up into the haze.", "Hard to pick out through the harmattan dust."],
    sunny: ["The ball goes up into the sun.", "A kick into the bright sunshine."],
    hot: ["The ball hangs in the hot, still air.", "A kick through the shimmering heat."],
  },
  try: {
    drizzle: ["A fine score in the drizzle.", "That drizzle has not stopped them."],
    rain: ["Superb handling in these wet conditions.", "They keep their hands in the rain."],
    storm: ["A try in the middle of a downpour. Wonderful stuff.", "Brilliant in conditions like this."],
    windy: ["Fine handling in this wind.", "The wind has not troubled them."],
    harmattan: ["A try through the harmattan haze. Lovely.", "They cut through the dust."],
    sunny: ["A lovely score in the sunshine.", "Glorious rugby on a glorious day."],
    hot: ["A try in this heat. Remarkable energy.", "They find the legs to score despite the heat."],
  },
  miss: {
    drizzle: ["The damp may have played its part."],
    rain: ["The wet ball does not help.", "The rain did not make that any easier."],
    storm: ["Kicking in this downpour is no easy task.", "The rain is making goal-kicking a nightmare."],
    windy: ["The wind carried that away.", "A gust took it wide."],
    harmattan: ["The haze is making it hard to pick out the posts.", "Dry and dusty, and the kick suffers."],
    sunny: ["The low sun may have been a distraction there."],
    hot: ["The heat shimmer makes the posts hard to see.", "Tough to focus in this heat, and the kick drifts away."],
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

/** The wind in a word, from how hard it blows (0 to 1 either way). */
const windWord = (w: Weather): string => {
  const f = Math.abs(w.wind);
  return w.id === "windy" ? (f > 0.85 ? "Strong wind" : "Gusty") : f < 0.3 ? "Calm" : f < 0.7 ? "Light breeze" : "Breezy";
};

/** One line of shorthand for the match centre, e.g. "☀️ Sunny · 31°C · Light breeze". */
export const weatherReport = (w: Weather): string => [`${ICON[w.id]} ${WEATHERS[w.id].label}`, w.temp !== undefined ? `${w.temp}°C` : "", windWord(w)].filter(Boolean).join(" · ");
