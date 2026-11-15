import type { Player, PlayerLine } from "../engine/types";
import { impact } from "./awards";
import { RECORD_META, type ClubRecord, type RecordKey } from "./history";
import { earnsSquadSlot, goalBonus, goalResult, prizeFor, wageOf, type GoalResult } from "./economy";
import { computeStandings } from "./standings";
import { evolvePlayers, objectiveTarget, overall, playShare } from "./teams";
import { hashSeed } from "../engine/rng";
import { MAX_EXTRA_SLOTS, lastFinishHere, teamById, type SeasonState } from "./season";

export interface ReviewMatch {
  opponent: string;
  home: boolean;
  scored: number;
  conceded: number;
  matchday: number;
}

export interface ReviewPlayer {
  player: Player;
  label: string;
}

export interface ReviewDeveloped {
  player: Player;
  /** Rating points (across all attributes) gained in training this season. */
  trained: number;
  /** Overall rating the offseason will add for a young player, from the share of matches they played. */
  growth: number;
  apps: number;
}

/** League-wide facts for the season, with where your club ranks. */
export interface ReviewLeague {
  champion: { name: string; points: number; margin: number };
  topScorer?: { name: string; club: string; points: number };
  bestAttack: { club: string; points: number };
  bestDefence: { club: string; points: number };
  mostTries: { club: string; tries: number };
  yourAttackRank: number;
  yourDefenceRank: number;
  yourPointsFor: number;
  yourPointsAgainst: number;
}

/** A look back at the season just finished, for the end-of-season overview. Nothing here changes the save. */
export interface SeasonReview {
  finish: number;
  clubs: number;
  champion: string;
  championIsYou: boolean;
  /** Your finish the season before at this club, if any. */
  previousFinish?: number;
  record: { won: number; drawn: number; lost: number; pointsFor: number; pointsAgainst: number; triesFor: number; bonus: number; points: number };
  goal: { text: string; result: GoalResult; bonus: number };
  /** The board funds an extra squad place for this finish (winning the league, or smashing the goal), if there is room for one. */
  squadSlot: boolean;
  money: { prize: number; wages: number; bonus: number; net: number; balanceAfter: number };
  bestWin?: ReviewMatch;
  worstLoss?: ReviewMatch;
  /** Player of the season first, then the stat leaders. */
  players: ReviewPlayer[];
  /** Your best improved players, from training and from the match experience the offseason will reward. */
  developed: ReviewDeveloped[];
  /** League top scorer, when from your club. */
  topScorerIsYours: boolean;
  records: string[];
  league: ReviewLeague;
}

/** Player of the season (best average impact per appearance), then the stat leaders. A category nobody scored in is skipped. */
function leaders(s: SeasonState, squad: Player[]): ReviewPlayer[] {
  const tot = (p: Player) => s.seasonStats[p.id];
  const played = squad.filter((p) => (tot(p)?.apps ?? 0) > 0);
  const best = (score: (p: Player) => number) => [...played].sort((a, b) => score(b) - score(a) || a.name.localeCompare(b.name))[0];
  const out: ReviewPlayer[] = [];
  const potsy = best((p) => impact(tot(p) as PlayerLine) / tot(p).apps);
  if (potsy) out.push({ player: potsy, label: `Player of the season: ${tot(potsy).apps} apps, ${tot(potsy).points} pts, ${tot(potsy).tackles} tackles` });
  const leader = (score: (p: Player) => number, label: (p: Player) => string) => {
    const p = best(score);
    if (p && score(p) > 0) out.push({ player: p, label: label(p) });
  };
  leader((p) => tot(p).points, (p) => `Top scorer: ${tot(p).points} points, ${tot(p).tries} ${tot(p).tries === 1 ? "try" : "tries"}`);
  leader((p) => tot(p).tackles, (p) => `Most tackles: ${tot(p).tackles}`);
  leader((p) => tot(p).metres, (p) => `Most metres: ${tot(p).metres}m`);
  leader((p) => tot(p).lineBreaks, (p) => `Most line breaks: ${tot(p).lineBreaks}`);
  leader((p) => tot(p).turnovers, (p) => `Most turnovers won: ${tot(p).turnovers}`);
  return out;
}

/**
 * Who has grown most. Training is already in their ratings; offseason growth is previewed by running the
 * same deterministic development step that starting the next season will run, on a copy of your squad.
 */
function developed(s: SeasonState): ReviewDeveloped[] {
  const team = teamById(s, s.managedId);
  const after = structuredClone(team);
  const retiring = evolvePlayers([after], hashSeed(s.seed, s.season + 1), (id) => playShare(s.seasonStats[id]?.apps ?? 0, s.totalMatchdays));
  const gone = new Set((retiring.get(team.id) ?? []).map((p) => p.id));
  const out: (ReviewDeveloped & { score: number })[] = [];
  for (const p of team.players) {
    if (gone.has(p.id)) continue;
    const trained = Object.values(s.trainGains?.[p.id] ?? {}).reduce((n, v) => n + (v ?? 0), 0);
    const growth = Math.max(0, overall(after.players.find((x) => x.id === p.id)!) - overall(p));
    const score = trained / 6 + growth;
    if (score > 0) out.push({ player: p, trained, growth, apps: s.seasonStats[p.id]?.apps ?? 0, score });
  }
  return out.sort((a, b) => b.score - a.score || b.apps - a.apps || a.player.name.localeCompare(b.player.name)).slice(0, 3);
}

/** Null until the season is over. The money is what starting the next season will pay, worked out here the same way. */
export function reviewSeason(s: SeasonState): SeasonReview | null {
  if (s.matchday <= s.totalMatchdays) return null;
  const ids = s.teams.map((t) => t.id);
  const table = computeStandings(ids, s.fixtures);
  const finish = table.findIndex((r) => r.teamId === s.managedId) + 1;
  const row = table[finish - 1];
  const me = teamById(s, s.managedId);
  const previousFinish = lastFinishHere(s);
  const g = objectiveTarget(s.managedId, previousFinish);
  const clearOfSecond = finish === 1 && table[1] ? table[0].points - table[1].points : 0;
  const result: GoalResult = g.text ? goalResult(finish, g.maxPos, clearOfSecond) : "missed";
  const prize = prizeFor(finish);
  const wages = me.players.reduce((t, p) => t + wageOf(p), 0);
  const bonus = goalBonus(result);

  const mine = s.fixtures.filter((f) => f.result && (f.homeId === s.managedId || f.awayId === s.managedId));
  const asMatch = (f: (typeof mine)[number]): ReviewMatch => {
    const home = f.homeId === s.managedId;
    const r = f.result!;
    return { opponent: teamById(s, home ? f.awayId : f.homeId).name, home, scored: home ? r.homeScore : r.awayScore, conceded: home ? r.awayScore : r.homeScore, matchday: f.matchday };
  };
  const matches = mine.map(asMatch);
  const byMargin = [...matches].sort((a, b) => b.scored - b.conceded - (a.scored - a.conceded));
  const bestWin = byMargin[0] && byMargin[0].scored > byMargin[0].conceded ? byMargin[0] : undefined;
  const last = byMargin.at(-1);
  const worstLoss = last && last.scored < last.conceded ? last : undefined;

  let leagueTop = 0;
  let topIsYours = false;
  let topScorer: ReviewLeague["topScorer"];
  for (const club of s.teams) for (const p of club.players) {
    const pts = s.seasonStats[p.id]?.points ?? 0;
    if (pts > leagueTop) (leagueTop = pts), (topIsYours = club.id === s.managedId), (topScorer = { name: p.name, club: club.name, points: pts });
  }
  const club = (id: string) => teamById(s, id).name;
  const by = (f: (r: (typeof table)[number]) => number) => [...table].sort((a, b) => f(b) - f(a));
  const attack = by((r) => r.pointsFor);
  const defence = by((r) => -r.pointsAgainst);
  const tries = by((r) => r.triesFor);
  const league: ReviewLeague = {
    champion: { name: club(table[0].teamId), points: table[0].points, margin: table[1] ? table[0].points - table[1].points : 0 },
    ...(topScorer ? { topScorer } : {}),
    bestAttack: { club: club(attack[0].teamId), points: attack[0].pointsFor },
    bestDefence: { club: club(defence[0].teamId), points: defence[0].pointsAgainst },
    mostTries: { club: club(tries[0].teamId), tries: tries[0].triesFor },
    yourAttackRank: attack.findIndex((r) => r.teamId === s.managedId) + 1,
    yourDefenceRank: defence.findIndex((r) => r.teamId === s.managedId) + 1,
    yourPointsFor: row.pointsFor,
    yourPointsAgainst: row.pointsAgainst,
  };

  const recordText = (Object.entries(s.records[s.managedId] ?? {}) as [RecordKey, ClubRecord][])
    .filter(([, r]) => r.season === s.season)
    .map(([k, r]) => `${RECORD_META[k].label}: ${r.value}${r.holder ? ` (${r.holder})` : ""}${r.vs ? ` v ${r.vs}` : ""}`);

  return {
    finish,
    clubs: table.length,
    champion: teamById(s, table[0].teamId).name,
    championIsYou: table[0].teamId === s.managedId,
    previousFinish,
    record: { won: row.won, drawn: row.drawn, lost: row.lost, pointsFor: row.pointsFor, pointsAgainst: row.pointsAgainst, triesFor: row.triesFor, bonus: row.bonus, points: row.points },
    goal: { text: g.text, result, bonus },
    squadSlot: earnsSquadSlot(finish, result) && (s.extraSlots ?? 0) < MAX_EXTRA_SLOTS,
    money: { prize, wages, bonus, net: prize - wages + bonus, balanceAfter: s.money + prize - wages + bonus },
    bestWin,
    worstLoss,
    players: leaders(s, me.players),
    developed: developed(s),
    topScorerIsYours: topIsYours && leagueTop > 0,
    records: recordText,
    league,
  };
}
