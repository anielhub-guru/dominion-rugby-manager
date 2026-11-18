import { hashSeed, Rng } from "../engine/rng";
import type { Player, Role, Team } from "../engine/types";
import { makeProspects } from "./teams";

/**
 * Era prospects: now and then the intake marks one youngster and the game follows whatever career the simulation
 * gives them. There is no protection: they may never get a contract, never play, or retire quietly. Everything the
 * game says about them is a fact (clubs, seasons, appearances), never a motive. See docs/era-prospect-design.md.
 */

export type EraStatus = "intake" | "unattached" | "playing" | "retired" | "closed";

export type ChronicleKey = "introduced" | "no-contract" | "joined" | "debut" | "first-regular-season" | "retired";

export interface ChronicleEntry {
  season: number;
  key: ChronicleKey;
  clubId?: string;
  value?: number;
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
  seasons: { season: number; clubId: string; apps: number; points?: number }[];
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

/** The season just played, recorded for a player on a roster. Returns news lines and adds chronicle facts. */
export function recordEraSeason(r: EraProspect, season: number, clubId: string, apps: number, matches: number, clubName: string, points = 0): string[] {
  const earlier = r.seasons.filter((x) => x.season < season);
  r.seasons.push({ season, clubId, apps, points });
  const before = earlier.reduce((t, x) => t + x.apps, 0);
  const prev = earlier[earlier.length - 1];
  if (prev && prev.clubId !== clubId) r.chronicle.push({ season, key: "joined", clubId });
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
export function chronicleLines(r: EraProspect, nameOf: (clubId: string) => string): string[] {
  const text = (c: ChronicleEntry): string => {
    const club = c.clubId ? nameOf(c.clubId) : "";
    switch (c.key) {
      case "introduced": return `Entered the youth intake of ${club}`;
      case "no-contract": return "No contract offered";
      case "joined": return `Joined ${club}`;
      case "debut": return `Made league debut for ${club}`;
      case "first-regular-season": return `First regular season at ${club}`;
      case "retired": return c.value ? `Retired, aged ${c.value}` : "Retired";
    }
  };
  return r.chronicle.map((c) => `S${c.season} ${text(c)}`);
}
