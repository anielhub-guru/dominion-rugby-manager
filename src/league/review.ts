import type { Player, PlayerLine } from "../engine/types";
import { impact } from "./awards";
import { RECORD_META, type ClubRecord, type RecordKey } from "./history";
import { goalBonus, goalResult, prizeFor, wageOf, type GoalResult } from "./economy";
import { computeStandings } from "./standings";
import { objectiveTarget } from "./teams";
import { lastFinishHere, teamById, type SeasonState } from "./season";

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
  money: { prize: number; wages: number; bonus: number; net: number; balanceAfter: number };
  bestWin?: ReviewMatch;
  worstLoss?: ReviewMatch;
  /** Player of the season first, then the stat leaders. */
  players: ReviewPlayer[];
  /** League top scorer, when from your club. */
  topScorerIsYours: boolean;
  records: string[];
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
  for (const club of s.teams) for (const p of club.players) {
    const pts = s.seasonStats[p.id]?.points ?? 0;
    if (pts > leagueTop) (leagueTop = pts), (topIsYours = club.id === s.managedId);
  }

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
    money: { prize, wages, bonus, net: prize - wages + bonus, balanceAfter: s.money + prize - wages + bonus },
    bestWin,
    worstLoss,
    players: leaders(s, me.players),
    topScorerIsYours: topIsYours && leagueTop > 0,
    records: recordText,
  };
}
