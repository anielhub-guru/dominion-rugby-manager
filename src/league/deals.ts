import { Rng, hashSeed } from "../engine/rng";
import type { MatchLog } from "../engine/types";
import { rivalOf } from "./rivals";
import type { SeasonState } from "./season";
import { SPONSORS } from "./facilities";
import { computeStandings } from "./standings";
import { teamRating } from "./teams";

/**
 * Deals are offers of money for meeting a target. They come in two sizes that work the same way:
 * - Sponsor deals are season-long. They arrive in the offseason, you accept before matchday SPONSOR_LAPSE_MATCHDAY,
 *   and the money (or a penalty if you miss) is settled in the end-of-season finances.
 * - Fan challenges are one match. They appear before a match, and the supporters pay out straight after it.
 * Every target is something the game can already see: results, the table and who played.
 */
export type DealCondition =
  // Season-long (sponsors).
  | { type: "plays"; playerId: string; games: number }
  | { type: "finish"; maxPos: number }
  | { type: "wins"; count: number }
  | { type: "shutouts"; count: number }
  | { type: "maxLosses"; count: number }
  // One match (fans).
  | { type: "beat"; clubId: string; rival?: boolean }
  | { type: "winNext" }
  | { type: "noLose" }
  | { type: "playNext"; playerId: string };

export interface Deal {
  id: string;
  source: "sponsor" | "fans";
  /** The sponsor's name, or "The supporters". */
  from: string;
  cond: DealCondition;
  /** Thousands of naira paid when the target is met. */
  reward: number;
  /** Thousands of naira you pay if a sponsor deal is missed (0 for fans). */
  penalty: number;
  season: number;
  /** For fan challenges: the matchday it is judged on. */
  matchday?: number;
  status: "offered" | "active";
}

/** A sponsor offer must be accepted before this matchday, so the target is still within reach. */
export const SPONSOR_LAPSE_MATCHDAY = 3;
/** Sponsor deals you can have running at once. */
export const MAX_SPONSOR_DEALS = 2;
/** A missed sponsor deal costs this share of its reward. */
export const PENALTY_SHARE = 0.3;
/** Chance the supporters set a challenge before a match. */
export const FAN_CHANCE = 0.35;

const round10 = (v: number) => Math.round(v / 10) * 10;
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
const nameOf = (s: SeasonState, id: string) => s.teams.find((t) => t.id === id)?.name ?? id;
const playerName = (s: SeasonState, id: string) => s.teams.flatMap((t) => t.players).find((p) => p.id === id)?.name ?? "a player";

/** Where your club ranks on squad strength, 1 for the strongest. Targets are set from this. */
export function expectedRank(s: SeasonState): number {
  const mine = teamRating(s.teams.find((t) => t.id === s.managedId)!);
  return 1 + s.teams.filter((t) => t.id !== s.managedId && teamRating(t) > mine).length;
}

/** Your results so far this season, in order. */
export function managedResults(s: SeasonState): { pf: number; pa: number }[] {
  return s.fixtures
    .filter((f) => f.result && (f.homeId === s.managedId || f.awayId === s.managedId))
    .map((f) => {
      const home = f.homeId === s.managedId;
      return { pf: home ? f.result!.homeScore : f.result!.awayScore, pa: home ? f.result!.awayScore : f.result!.homeScore };
    });
}

const FINISH_REWARD: Record<number, number> = { 1: 2500, 2: 1800, 3: 1400, 4: 1100, 5: 900, 6: 700, 7: 600 };

/** What counts so far, for a season-long target: the number reached, and the number needed. */
export function dealProgress(d: Deal, s: SeasonState): { have: number; need: number; text: string } {
  const c = d.cond;
  const results = managedResults(s);
  if (c.type === "plays") {
    const have = s.seasonStats[c.playerId]?.apps ?? 0;
    return { have, need: c.games, text: `${have} of ${c.games} games played` };
  }
  if (c.type === "finish") {
    const table = computeStandings(s.teams.map((t) => t.id), s.fixtures);
    const have = table.findIndex((r) => r.teamId === s.managedId) + 1;
    return { have, need: c.maxPos, text: `${have}${have === 1 ? "st" : have === 2 ? "nd" : have === 3 ? "rd" : "th"} now, needs top ${c.maxPos}` };
  }
  if (c.type === "wins") {
    const have = results.filter((r) => r.pf > r.pa).length;
    return { have, need: c.count, text: `${have} of ${c.count} wins` };
  }
  if (c.type === "shutouts") {
    const have = results.filter((r) => r.pa === 0).length;
    return { have, need: c.count, text: `${have} of ${c.count} shutouts` };
  }
  if (c.type === "maxLosses") {
    const have = results.filter((r) => r.pf < r.pa).length;
    return { have, need: c.count, text: `${have} lost, at most ${c.count} allowed` };
  }
  return { have: 0, need: 1, text: "" };
}

/** The target in words. */
export function describeCondition(c: DealCondition, s: SeasonState): string {
  switch (c.type) {
    case "plays": return `Play ${playerName(s, c.playerId)} in ${c.games} matches this season`;
    case "finish": return c.maxPos === 1 ? "Win the league" : `Finish in the top ${c.maxPos}`;
    case "wins": return `Win ${c.count} matches this season`;
    case "shutouts": return `Keep the opposition scoreless in ${c.count} matches`;
    case "maxLosses": return `Lose no more than ${c.count} matches this season`;
    case "beat": return c.rival ? `Beat your rivals ${nameOf(s, c.clubId)}` : `Beat ${nameOf(s, c.clubId)}`;
    case "winNext": return "Win this match";
    case "noLose": return "Do not lose this match";
    case "playNext": return `Play ${playerName(s, c.playerId)} in this match`;
  }
}

/** Whether a season-long target has been met, judged at the end of the season. */
export function judgeSeasonDeal(d: Deal, s: SeasonState, finish: number): boolean {
  const c = d.cond;
  if (c.type === "finish") return finish <= c.maxPos;
  const p = dealProgress(d, s);
  return c.type === "maxLosses" ? p.have <= c.count : p.have >= p.need;
}

/** Whether a fan challenge was met by the match just played. */
export function judgeFanDeal(d: Deal, s: SeasonState, log: MatchLog): boolean {
  const home = log.homeId === s.managedId;
  const [pf, pa] = home ? [log.homeScore, log.awayScore] : [log.awayScore, log.homeScore];
  const opp = home ? log.awayId : log.homeId;
  const c = d.cond;
  if (c.type === "beat") return opp === c.clubId && pf > pa;
  if (c.type === "winNext") return pf > pa;
  if (c.type === "noLose") return pf >= pa;
  if (c.type === "playNext") return (log.players?.find((l) => l.id === c.playerId)?.apps ?? 0) > 0;
  return false;
}

/** Sponsors who want to back the club this season. Deterministic from the save, so reloading cannot reroll them. */
export function sponsorOffers(s: SeasonState): Deal[] {
  const rng = new Rng(hashSeed(s.seed, s.season, s.managedId, "sponsor-deals"));
  if (!rng.chance(0.85)) return [];
  const team = s.teams.find((t) => t.id === s.managedId)!;
  const rank = expectedRank(s);
  const wantTwo = rng.chance(0.4);
  const kinds = rng.shuffle(["plays", "finish", "wins", "shutouts", "maxLosses"] as const);
  const names = rng.shuffle([...SPONSORS]);
  const deals: Deal[] = [];
  for (const kind of kinds) {
    if (deals.length >= (wantTwo ? 2 : 1)) break;
    let cond: DealCondition;
    let reward: number;
    if (kind === "plays") {
      // A player on the fringe, so the deal is a real choice: they might not be who you would pick.
      const spare = team.players.filter((p) => !team.lineup.includes(p.id) && !p.retiring);
      if (!spare.length) continue;
      cond = { type: "plays", playerId: rng.pick(spare).id, games: 7 };
      reward = 900;
    } else if (kind === "finish") {
      const maxPos = Math.max(1, rank - 2);
      cond = { type: "finish", maxPos };
      reward = FINISH_REWARD[maxPos] ?? 600;
    } else if (kind === "wins") {
      const expected = Math.round(14 * (0.75 - 0.075 * (rank - 1)));
      const count = clamp(expected + 1, 3, 12);
      cond = { type: "wins", count };
      reward = 400 + 150 * count;
    } else if (kind === "shutouts") {
      const count = rank <= 3 ? 3 : 2;
      cond = { type: "shutouts", count };
      reward = 200 + 300 * count;
    } else {
      const expectedLosses = Math.round(14 * (0.25 + 0.075 * (rank - 1)));
      const count = Math.max(1, expectedLosses - 2);
      cond = { type: "maxLosses", count };
      reward = Math.max(500, 500 + 100 * (10 - count));
    }
    deals.push({ id: `s${s.season}.${deals.length + 1}`, source: "sponsor", from: names[deals.length], cond, reward: round10(reward), penalty: round10(reward * PENALTY_SHARE), season: s.season, status: "offered" });
  }
  return deals;
}

/** The supporters' challenge for the match about to be played, if they have set one. It is worked out from the save, so it cannot be rerolled. */
export function fanOffer(s: SeasonState): Deal | null {
  if (s.intake || s.offers?.length || s.matchday > s.totalMatchdays) return null;
  const key = `${s.season}:${s.matchday}`;
  if (s.fanPassed === key) return null;
  if (s.deals?.some((d) => d.source === "fans" && d.matchday === s.matchday && d.season === s.season)) return null;
  const f = s.fixtures.find((x) => x.matchday === s.matchday && (x.homeId === s.managedId || x.awayId === s.managedId));
  if (!f) return null;
  const rng = new Rng(hashSeed(s.seed, s.season, s.matchday, "fans"));
  const oppId = f.homeId === s.managedId ? f.awayId : f.homeId;
  const opp = s.teams.find((t) => t.id === oppId)!;
  const team = s.teams.find((t) => t.id === s.managedId)!;
  const gap = teamRating(opp) - teamRating(team);
  const isRival = rivalOf(s.rivalry, s.managedId) === oppId;
  const base = { source: "fans" as const, from: "The supporters", penalty: 0, season: s.season, matchday: s.matchday, status: "offered" as const, id: `f${s.season}.${s.matchday}` };
  if (isRival) {
    if (!rng.chance(0.9)) return null;
    return { ...base, cond: { type: "beat", clubId: oppId, rival: true }, reward: 500 };
  }
  if (!rng.chance(FAN_CHANCE)) return null;
  const spare = team.players.filter((p) => !team.lineup.includes(p.id) && !p.ban && !(p.injury?.games ?? 0));
  const options: [number, () => Deal][] = [
    [3, () => ({ ...base, cond: { type: "beat", clubId: oppId }, reward: 300 + 100 * clamp(Math.round(gap / 4), 0, 3) })],
    [1, () => ({ ...base, cond: { type: "winNext" }, reward: 250 })],
  ];
  if (gap >= 0) options.push([2, () => ({ ...base, cond: { type: "noLose" }, reward: gap >= 4 ? 250 : 150 })]);
  if (spare.length) options.push([2, () => ({ ...base, cond: { type: "playNext", playerId: rng.pick(spare).id }, reward: 250 })]);
  return rng.weighted(options, (o) => o[0])[1]();
}

