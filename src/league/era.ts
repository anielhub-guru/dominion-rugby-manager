import { hashSeed, Rng } from "../engine/rng";
import type { Player, Role, Team } from "../engine/types";
import { makeProspects, overall } from "./teams";
import { STORY_KEYS, closeLedger, pruneVs, vsCandidates, type Candidate, type Ledger, type VsRecord } from "./moments";
import { SHORT, storyText, type WordKey } from "./wording";

/**
 * Era prospects: now and then the intake marks one youngster and the game follows whatever career the simulation
 * gives them. There is no protection: they may never get a contract, never play, or retire quietly. Everything the
 * game says about them is a fact (clubs, seasons, appearances), never a motive. See docs/era-prospect-design.md.
 */

export type EraStatus = "intake" | "unattached" | "playing" | "retired" | "closed";

export type ChronicleKey = "introduced" | "no-contract" | "joined" | "debut" | "first-regular-season" | "title" | "retired" | WordKey;

export interface ChronicleEntry {
  season: number;
  key: ChronicleKey;
  clubId?: string;
  value?: number;
  /** Another player in the story, for pairs and replacements. */
  otherId?: string;
  otherName?: string;
  /** The opposing club, and the final score from the player's club's side, for a deciding moment. */
  vsId?: string;
  score?: string;
  minute?: number;
  /** First meeting with the origin club: "passed" if it never signed them, "left" if they were once on its books. */
  detail?: string;
}

/** One season on a roster. The optional fields are absent on seasons recorded by older saves. */
export interface SeasonLine {
  season: number;
  clubId: string;
  apps: number;
  points?: number;
  /** Matches the club played that season. */
  matches?: number;
  /** The club's league finish. */
  position?: number;
  /** Age and overall at the end of the season. */
  age?: number;
  overall?: number;
}

export interface EraProspect {
  /** Player id. Followed across clubs. */
  id: string;
  name: string;
  role: Role;
  /** The club whose intake introduced them. */
  originClubId: string;
  introducedSeason: number;
  status: EraStatus;
  /** An unsigned prospect, kept off every roster while a club may still take them. */
  waiting?: Player;
  /** Offseasons left in which an AI club may sign an unattached prospect. */
  windowLeft?: number;
  /** One line per season spent on a roster. */
  seasons: SeasonLine[];
  /** Age and overall when the intake introduced them. Absent on older saves. */
  introducedAge?: number;
  introducedOverall?: number;
  /** Set once the manager has been shown the "followed player joined the shortlist" popup. */
  announced?: boolean;
  /** What the season in progress has shown about them. Turned into chronicle entries when the season closes. */
  ledger?: Ledger;
  /** How they have fared against other clubs and their players, over the whole career. */
  vs?: VsRecord;
  /** The retirement entry, kept for the profile. */
  summary?: string;
  /** Sparse permanent facts. Text is built from these when shown. */
  chronicle: ChronicleEntry[];
}

/** Chance each offseason that the intake marks a prospect. */
export const ERA_CHANCE = 0.22;
/** Seasons without one after which the next offseason always marks one. */
export const ERA_PITY_SEASONS = 3;
/** A new game guarantees its first era prospect by this season's intake. */
export const ERA_FIRST_BY = 2;
/** Most era prospects being followed at once. */
export const ERA_MAX_LIVE = 3;
/** Offseasons in which an unsigned prospect may still be taken by an AI club. */
export const ERA_WINDOW = 2;
/** Chance per offseason that an AI club with a vacancy in the right role takes an unattached prospect. */
export const ERA_RETURN_CHANCE = 0.5;
/** A season counts as regular when the player appears in this share of the matches. */
export const REGULAR_SHARE = 0.6;

export const isLive = (r: EraProspect) => r.status === "intake" || r.status === "unattached" || r.status === "playing";

/** Whether this offseason's intake marks a prospect. Deterministic from the save seed, so reloading cannot reroll it. */
export function eraDue(seed: number, season: number, lastEraSeason: number | undefined, live: number): boolean {
  if (live >= ERA_MAX_LIVE) return false;
  if (lastEraSeason === undefined ? season >= ERA_FIRST_BY : season - lastEraSeason >= ERA_PITY_SEASONS) return true;
  return new Rng(hashSeed(seed, season, "era")).chance(ERA_CHANCE);
}

/** A prospect from the club's normal range. Marked players are remembered, not special: potential is not raised. */
export function makeEraProspect(team: Team, season: number, role: Role, seed: number): Player {
  return makeProspects(team, `era${season}`, role, seed, 1)[0];
}

export const newEraProspect = (p: Player, originClubId: string, season: number): EraProspect => ({
  id: p.id,
  name: p.name,
  role: p.role,
  originClubId,
  introducedSeason: season,
  status: "intake",
  introducedAge: p.age,
  introducedOverall: overall(p),
  seasons: [],
  chronicle: [{ season, key: "introduced", clubId: originClubId }],
});

/** Whether an AI club with a vacancy takes this unattached prospect this offseason. */
export const returns = (seed: number, season: number, id: string): boolean => new Rng(hashSeed(seed, season, "era-return", id)).chance(ERA_RETURN_CHANCE);

// ------------------------------------------------------------------ facts

export const introNews = (p: Player) => `${p.name}, a ${p.role} aged ${p.age}, is on your youth shortlist. Dominion will follow this career.`;

export const noContractNews = (name: string) => `No contract offered. ${name} leaves the intake without joining a club.`;

export const joinedElsewhereNews = (name: string, originName: string, introducedSeason: number, clubName: string) =>
  `A first chance elsewhere. ${name}, not signed by ${originName} in the season ${introducedSeason} intake, joins ${clubName}.`;

/** Coming back to the club whose intake introduced them. `value` is the seasons since they were last on its books, or since the intake. */
export function returnEntry(r: EraProspect, season: number, clubId: string): ChronicleEntry {
  const lastThere = [...r.seasons].reverse().find((x) => x.clubId === clubId && x.season < season)?.season;
  const was = lastThere !== undefined || r.chronicle.some((c) => c.key === "joined" && c.clubId === clubId && c.season < season);
  return { season, key: "return", clubId, value: Math.max(1, season - (lastThere ?? r.introducedSeason) - 1), detail: was ? "left" : "passed" };
}

/** The season just played, recorded for a player on a roster. Returns news lines and adds chronicle facts. */
export function recordEraSeason(r: EraProspect, season: number, clubId: string, apps: number, matches: number, clubName: string, points = 0, extra: Pick<SeasonLine, "position" | "age" | "overall"> = {}): string[] {
  const earlier = r.seasons.filter((x) => x.season < season);
  r.seasons.push({ season, clubId, apps, points, matches, ...extra });
  if (extra.position === 1 && apps > 0) r.chronicle.push({ season, key: "title", clubId, value: apps });
  const before = earlier.reduce((t, x) => t + x.apps, 0);
  const prev = earlier[earlier.length - 1];
  if (prev && prev.clubId !== clubId) {
    r.chronicle.push({ season, key: "joined", clubId });
    if (clubId === r.originClubId) r.chronicle.push(returnEntry(r, season, clubId));
  }
  const regular = (n: number) => n >= Math.ceil(matches * REGULAR_SHARE);
  const news: string[] = [];
  const debut = apps > 0 && before === 0;
  const firstRegular = regular(apps) && !earlier.some((x) => regular(x.apps));
  if (debut) r.chronicle.push({ season, key: "debut", clubId, value: apps });
  if (firstRegular) r.chronicle.push({ season, key: "first-regular-season", clubId, value: apps });
  if (firstRegular) {
    const more = before > 0 && apps > before ? `, more than in ${earlier.length === 1 ? "the season" : `the previous ${earlier.length} seasons`} before combined` : "";
    news.push(`A first regular season. ${r.name} played ${apps} of ${matches} matches for ${clubName}${more}.`);
  } else if (debut) {
    const joined = r.chronicle.find((c) => c.key === "joined")?.season ?? r.introducedSeason;
    const waited = season - joined;
    news.push(`A first league season. ${r.name} made ${apps} appearances for ${clubName}${waited > 0 ? `, ${waited === 1 ? "a season" : `${waited} seasons`} after joining` : ""}.`);
  }
  return news;
}

/** The retirement entry, built only from what happened. */
export function retirementNews(r: EraProspect, age: number, nameOf: (clubId: string) => string): string {
  const clubs = [...new Set(r.seasons.map((s) => s.clubId))];
  const apps = r.seasons.reduce((t, s) => t + s.apps, 0);
  const n = r.seasons.length;
  const last = r.seasons.reduce((k, s, i) => (s.apps > 0 ? i + 1 : k), 0);
  if (apps === 0) return `${r.name} retires at ${age} after ${n} ${n === 1 ? "season" : "seasons"} without a league appearance.`;
  if (clubs.length === 1) {
    return n >= 5 && last <= 3
      ? `${r.name} retires at ${age}. All ${apps} league appearances for ${nameOf(clubs[0])} came in the first ${last} ${last === 1 ? "season" : "seasons"}.`
      : `${r.name} retires at ${age} after ${n} ${n === 1 ? "season" : "seasons"} with ${nameOf(clubs[0])} and ${apps} league appearances.`;
  }
  const first = r.seasons.filter((s) => s.clubId === clubs[0]).reduce((t, s) => t + s.apps, 0);
  if (first === 0) return `${r.name} retires at ${age}. No league appearances for ${nameOf(clubs[0])}; ${apps} for ${clubs.slice(1).map(nameOf).join(" and ")}.`;
  return `${r.name} retires at ${age} after ${apps} league appearances for ${clubs.length} clubs: ${clubs.map(nameOf).join(", ")}.`;
}

/** Permanent profile lines, oldest first. */
export const chronicleLines = (r: EraProspect, nameOf: (clubId: string) => string): string[] => chronicleItems(r, nameOf).map((i) => `S${i.season} ${i.text}`);

/** The same lines as parts, so a screen can lay them out. `story` marks moments and pairs, as against the plain facts of a career. */
export function chronicleItems(r: EraProspect, nameOf: (clubId: string) => string): { season: number; text: string; story: boolean }[] {
  const text = (c: ChronicleEntry): string => {
    const club = c.clubId ? nameOf(c.clubId) : "";
    switch (c.key) {
      case "introduced": return `Entered the youth intake of ${club}${r.introducedAge ? `, aged ${r.introducedAge}, overall ${r.introducedOverall}` : ""}`;
      case "no-contract": return "No contract offered";
      case "joined": return `Joined ${club}`;
      case "debut": return `Made league debut for ${club}`;
      case "first-regular-season": return `First regular season at ${club}`;
      case "title": return `${club} won the league, with ${c.value} ${c.value === 1 ? "appearance" : "appearances"} from them`;
      case "retired": return c.value ? `Retired, aged ${c.value}` : "Retired";
      default: return storyText(c.key, { name: r.name, club, other: c.otherName, vs: c.vsId ? nameOf(c.vsId) : undefined, score: c.score, minute: c.minute, n: c.value, role: r.role, age: c.value, detail: c.detail }, r.id, c.season, c.otherId ?? c.vsId ?? "");
    }
  };
  return [...r.chronicle].sort((a, b) => a.season - b.season).map((c) => ({ season: c.season, text: text(c), story: STORY_KEYS.has(c.key) }));
}

/** The other players in a career, with what the chronicle says about each. Opponents carry their club. */
export function alongside(r: EraProspect, nameOf?: (clubId: string) => string): { id: string; name: string; club?: string; what: string[] }[] {
  const out = new Map<string, { id: string; name: string; club?: string; what: string[] }>();
  for (const c of r.chronicle) {
    if (!c.otherId || !c.otherName || !(c.key in SHORT)) continue;
    const e = out.get(c.otherId) ?? { id: c.otherId, name: c.otherName, club: c.vsId && nameOf ? nameOf(c.vsId) : undefined, what: [] };
    e.what.push(`${SHORT[c.key as keyof typeof SHORT]} (S${c.season})`);
    out.set(c.otherId, e);
  }
  return [...out.values()];
}

/** A season's scoring table: the followed player's place in it, as a candidate line. */
export function raceCandidate(r: EraProspect, season: number, clubId: string, table: { id: string; name: string; clubId: string; points: number }[]): Candidate | null {
  const sorted = [...table].filter((x) => x.points > 0).sort((a, b) => b.points - a.points);
  const at = sorted.findIndex((x) => x.id === r.id);
  if (at < 0 || at > 1) return null;
  const me = sorted[at];
  if (at === 0) {
    const next = sorted[1];
    return next ? { entry: { season, key: "top-scorer", clubId, vsId: next.clubId, otherId: next.id, otherName: next.name, value: me.points - next.points }, strength: 3 } : null;
  }
  const top = sorted[0];
  const gap = top.points - me.points;
  return gap <= 12 ? { entry: { season, key: "runner-up-scorer", clubId, vsId: top.clubId, otherId: top.id, otherName: top.name, value: gap }, strength: 1 + (12 - gap) / 12 } : null;
}

/** Closes the season into the chronicle: the ledger's moments and pairs, and what the career record now says about clubs and rivals. */
export function closeEraLedger(r: EraProspect, season: number, clubId: string, race?: Candidate | null) {
  const signed = r.chronicle.some((c) => c.key === "joined" && c.clubId === r.originClubId);
  r.chronicle.push(...closeLedger(r.ledger, r.chronicle, [...vsCandidates(r.vs, season, clubId), ...(race ? [race] : [])], { signed }));
  pruneVs(r.vs, season);
  if (r.vs) r.vs.pending = [];
  delete r.ledger;
}
