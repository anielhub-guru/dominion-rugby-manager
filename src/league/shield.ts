/**
 * The Founders' Shield endgame (see docs/founders-shield-endgame-design.md).
 *
 * Once every facility at the club you manage is at level three, Mrs. Rakido Kasham Daniel may ask you to defend
 * Dominion League against Pinnacle League in an annual ten-club knockout. Each tournament win scores a point for
 * the winner's league and the first league to five decides who owns Dominion League. All state lives in
 * `SeasonState.shield`, the matches reuse the normal match engine, and nothing here touches the league table.
 *
 * This module only imports types from season.ts at build time plus `aiTactic`, which is used when a match is run,
 * never while the modules load, so the cycle between the two files is harmless.
 */
import { Rng, hashSeed } from "../engine/rng";
import { MatchSim, SHAPE_BY_STYLE } from "../engine/match";
import type { MatchLog, Player, Team } from "../engine/types";
import { FACILITY_IDS, MAX_FACILITY_LEVEL, levelOf } from "./facilities";
import { standingsAt } from "./standings";
import { buildTeam, evolvePlayers, makeProspects, teamRating, type TeamDef } from "./teams";
import { aiTactic, type NewsItem, type SeasonState } from "./season";

export const MRS_DANIEL = "Mrs. Rakido Kasham Daniel";
/** Tournaments a league must win to decide ownership. */
export const SHIELD_WINS = 5;
/** Chance of the request on the first, second, third and later eligible postseasons. Hidden from the player. */
export const REQUEST_CHANCES = [0.25, 0.5, 0.75, 1];
export const requestChance = (eligibleSeasons: number) => REQUEST_CHANCES[Math.max(0, Math.min(REQUEST_CHANCES.length, eligibleSeasons) - 1)] ?? REQUEST_CHANCES[0];

export const DECLINE_LINE = "Very well. I'll hold them off for another season.";
export const RESCUE_LINE = "They kept us alive. Next season, I want the Shield in your hands.";

export type ShieldStatus = "dormant" | "requested" | "active" | "defended" | "lost";
export type RoundId = "prelim" | "quarter" | "semi" | "final";
export type League = "dominion" | "pinnacle";
export const ROUND_NAMES: Record<RoundId, string> = { prelim: "Preliminary round", quarter: "Quarter-finals", semi: "Semi-finals", final: "Founders' Shield Final" };

export interface ShieldTie {
  id: string;
  /** The higher seed, who takes the home side. */
  a: string;
  b: string;
  result?: { aScore: number; bScore: number; aTries: number; bTries: number; winner: string; /** How a level match was settled. */ decider?: "tries" | "golden" };
}
export interface ShieldRound {
  id: RoundId;
  ties: ShieldTie[];
}
export interface ShieldClub {
  name: string;
  short: string;
  league: League;
}
export interface Tournament {
  season: number;
  /** The club you managed in this tournament. */
  managedId: string;
  /** Names and leagues of all ten entrants, so the bracket still reads after clubs change. */
  clubs: Record<string, ShieldClub>;
  rounds: ShieldRound[];
  winnerId?: string;
  /** The round your club went out in. Missing while you are still in, or after you win. */
  outAt?: RoundId;
}

export interface PinnacleClub {
  team: Team;
  color: string;
  strength: number;
  record: { tournaments: number; played: number; won: number; finals: number; shields: number; beatYou: number; lostToYou: number };
}

export interface ShieldResult {
  season: number;
  winnerId: string;
  winnerName: string;
  league: League;
  runnerUpName: string;
  /** Final score from the winner's side, e.g. "24-17". */
  score: string;
  clubName: string;
  reached: RoundId | "won";
  message: string;
}

export interface ShieldState {
  status: ShieldStatus;
  /** Postseasons in which every facility was complete and the request could have come. Drives the hidden chance. */
  eligible: number;
  score: { dominion: number; pinnacle: number };
  pinnacle: PinnacleClub[];
  tournament?: Tournament;
  campaign: ShieldResult[];
  personal: { tournaments: number; shields: number; finals: number; played: number; won: number; defeated: Record<string, number> };
  /** Mrs. Daniel's latest words, shown on the Shield screen. */
  message?: string;
  /** Season in which the campaign was decided. */
  endedSeason?: number;
  /** The victory scene has been dismissed. */
  victorySeen?: boolean;
}

export const defaultShield = (): ShieldState => ({ status: "dormant", eligible: 0, score: { dominion: 0, pinnacle: 0 }, pinnacle: [], campaign: [], personal: { tournaments: 0, shields: 0, finals: 0, played: 0, won: 0, defeated: {} } });

export const shieldOf = (s: Pick<SeasonState, "shield">): ShieldState => s.shield ?? defaultShield();

const PINNACLE_DEFS: TeamDef[] = [
  { id: "pin-1", name: "Accra Meridians", short: "ACC", strength: 66, style: "attacking", color: "#6fd0ff" },
  { id: "pin-2", name: "Dakar Tidebreakers", short: "DAK", strength: 68, style: "territory", color: "#ff9f6e" },
  { id: "pin-3", name: "Abidjan Sentinels", short: "ABD", strength: 65, style: "defensive", color: "#c8e86a" },
  { id: "pin-4", name: "Kumasi Crowns", short: "KUM", strength: 70, style: "balanced", color: "#ffd24a" },
  { id: "pin-5", name: "Freetown Citadel", short: "FRE", strength: 67, style: "defensive", color: "#d58cff" },
];

export const isPinnacle = (id: string) => id.startsWith("pin-");

/** Every facility at the club you manage is at the top level. */
export const facilitiesComplete = (s: Pick<SeasonState, "facilities" | "managedId">) => FACILITY_IDS.every((id) => levelOf(s.facilities?.[s.managedId], id) >= MAX_FACILITY_LEVEL);

// ------------------------------------------------------------------ lookups

function clubTeam(state: SeasonState, id: string): Team {
  const t = state.teams.find((x) => x.id === id) ?? state.shield?.pinnacle.find((c) => c.team.id === id)?.team;
  if (!t) throw new Error(`Unknown Founders' Shield club ${id}`);
  return t;
}

/** The squad as it plays in the Shield: a week's rest, so nobody arrives tired, injured or banned. */
function rested(team: Team): Team {
  const t = structuredClone(team);
  for (const p of t.players) {
    delete p.tired;
    delete p.injury;
    delete p.ban;
  }
  return t;
}

export const currentRound = (t: Tournament): ShieldRound | undefined => t.rounds.find((r) => r.ties.some((x) => !x.result));

/** A tournament for this season that has not finished. It has to be played out before the next season starts. */
export const shieldPending = (s: SeasonState): boolean => s.shield?.status === "active" && !!s.shield.tournament && s.shield.tournament.season === s.season && !s.shield.tournament.winnerId;

/** Mrs. Daniel is waiting for an answer, or the tournament is unfinished, or the career is over. */
export const shieldBlocksSeason = (s: SeasonState): boolean => s.shield?.status === "requested" || shieldPending(s) || s.shield?.status === "lost";

/** Your next tie, if you are still in the tournament. */
export function managedTie(s: SeasonState): ShieldTie | undefined {
  const t = s.shield?.tournament;
  if (!t || !shieldPending(s)) return undefined;
  return currentRound(t)?.ties.find((x) => !x.result && (x.a === s.managedId || x.b === s.managedId));
}

export const leagueOf = (t: Tournament, id: string): League => t.clubs[id]?.league ?? (isPinnacle(id) ? "pinnacle" : "dominion");

// ------------------------------------------------------------------ the request

/**
 * Called when the last matchday has been played. Starts the year's tournament if the campaign is running, or
 * rolls for Mrs. Daniel's request if the facilities are complete. Changes `state`; returns the news.
 */
export function shieldPostseason(state: SeasonState): NewsItem[] {
  const news = (text: string, link?: NewsItem["link"]): NewsItem => ({ season: state.season, matchday: state.totalMatchdays, text, ...(link ? { link } : {}) });
  const sh = state.shield;
  if (sh?.status === "active") return startTournament(state);
  if ((sh?.status ?? "dormant") !== "dormant" || !facilitiesComplete(state)) return [];
  const live = (state.shield ??= defaultShield());
  live.eligible++;
  if (!new Rng(hashSeed(state.seed, state.season, "shield-request")).chance(requestChance(live.eligible))) return [];
  live.status = "requested";
  return [news(`${MRS_DANIEL} has asked to see you before the new season.`)];
}

const ord = (n: number) => `${n}${n >= 11 && n <= 13 ? "th" : (["th", "st", "nd", "rd"][n % 10] ?? "th")}`;

/** Mrs. Daniel's request, opening with what the club has actually done: its climb, its titles, or just its years. */
export function requestText(s: SeasonState): string[] {
  const club = s.teams.find((t) => t.id === s.managedId)?.name ?? "your club";
  const here = s.history.filter((r) => !r.clubId || r.clubId === s.managedId);
  const first = here[0]?.managedPosition;
  const latest = here[here.length - 1]?.managedPosition;
  const titles = here.filter((r) => r.championId === s.managedId).length;
  const opening =
    first !== undefined && latest !== undefined && first - latest >= 2
      ? `I've watched you take ${club} from ${ord(first)} to ${ord(latest)}.`
      : titles > 0
        ? `${titles} league title${titles === 1 ? "" : "s"} at ${club}, and every facility built.`
        : `${here.length || "Several"} seasons at ${club}, and every facility built.`;
  const women = s.gender === "women";
  return [opening, ...(women ? ["I believe in our women, and in the strength of this league."] : []), "Pinnacle League has the right to challenge for Dominion League. The Founders' Shield will decide it: first to five wins.", "Will you stand for Dominion?"];
}

function requireOver(state: SeasonState) {
  if (state.matchday <= state.totalMatchdays) throw new Error("The Founders' Shield is played after the season ends");
}

/** Accepts the request. The campaign begins and this postseason's Shield is drawn straight away. */
export function acceptShield(prev: SeasonState): SeasonState {
  if (prev.shield?.status !== "requested") throw new Error("There is no request to accept");
  requireOver(prev);
  const state = structuredClone(prev);
  const sh = state.shield!;
  sh.status = "active";
  sh.pinnacle = PINNACLE_DEFS.map((def) => ({ team: buildTeam(def, hashSeed(state.seed, "pinnacle"), state.gender), color: def.color, strength: def.strength, record: { tournaments: 0, played: 0, won: 0, finals: 0, shields: 0, beatYou: 0, lostToYou: 0 } }));
  sh.message = "Dominion 0, Pinnacle 0.";
  state.news = [{ season: state.season, matchday: 0, text: `The Founders' Shield campaign begins. First to five Shields owns Dominion League.` }, ...startTournament(state), ...state.news].slice(0, 14);
  return state;
}

/** Declines for now. No penalty: the request returns in a later postseason at the current chance. */
export function declineShield(prev: SeasonState): SeasonState {
  if (prev.shield?.status !== "requested") throw new Error("There is no request to decline");
  const state = structuredClone(prev);
  state.shield!.status = "dormant";
  state.shield!.message = DECLINE_LINE;
  state.news = [{ season: state.season, matchday: 0, text: `${MRS_DANIEL}: "${DECLINE_LINE}"` }, ...state.news].slice(0, 14);
  return state;
}

// ------------------------------------------------------------------ the draw

/** Best pairing of eight clubs listed in seed order: most cross-league ties, then the widest seed gaps. */
function pairQuarter(order: string[], league: (id: string) => League): [string, string][] {
  let best: { cross: number; gap: number; pairs: [number, number][] } = { cross: -1, gap: -1, pairs: [] };
  const rec = (rest: number[], pairs: [number, number][]) => {
    if (!rest.length) {
      const cross = pairs.filter(([i, j]) => league(order[i]) !== league(order[j])).length;
      const gap = pairs.reduce((t, [i, j]) => t + (j - i), 0);
      if (cross > best.cross || (cross === best.cross && gap > best.gap)) best = { cross, gap, pairs };
      return;
    }
    const [i, ...others] = rest;
    for (const j of others) rec(others.filter((x) => x !== j), [...pairs, [i, j]]);
  };
  rec(order.map((_, i) => i), []);
  // Best seed's tie first, then arranged so the semi-finals meet as 1/8 with 4/5 and 2/7 with 3/6.
  const ties = [...best.pairs].sort((x, y) => x[0] - y[0]);
  return [0, 3, 1, 2].map((k) => ties[k]).map(([i, j]) => [order[i], order[j]]);
}

/** Draws the year's tournament from the final league table and the Pinnacle seeds. */
function startTournament(state: SeasonState): NewsItem[] {
  const sh = state.shield!;
  const table = standingsAt(state.teams.map((t) => t.id), state.fixtures, state.totalMatchdays);
  const others = table.map((r) => r.teamId).filter((id) => id !== state.managedId).slice(0, 4);
  const pins = [...sh.pinnacle].sort((a, b) => teamRating(b.team) - teamRating(a.team) || a.team.id.localeCompare(b.team.id)).map((c) => c.team.id);
  const clubs: Record<string, ShieldClub> = {};
  for (const id of [state.managedId, ...others]) clubs[id] = { name: clubTeam(state, id).name, short: clubTeam(state, id).short, league: "dominion" };
  for (const c of sh.pinnacle) clubs[c.team.id] = { name: c.team.name, short: c.team.short, league: "pinnacle" };
  const tag = (n: number) => `shield-${state.season}-prelim-${n}`;
  sh.tournament = {
    season: state.season,
    managedId: state.managedId,
    clubs,
    rounds: [{ id: "prelim", ties: [{ id: tag(1), a: others[2], b: pins[3] }, { id: tag(2), a: others[3], b: pins[4] }] }],
  };
  sh.message = undefined;
  const seeded = [others[0], others[1]].map((id) => clubs[id].name).join(" and ");
  return [{ season: state.season, matchday: state.totalMatchdays, text: `The Founders' Shield is drawn: ${clubs[state.managedId].name} are seeded into the quarter-finals with ${seeded} for Dominion. Dominion ${sh.score.dominion}, Pinnacle ${sh.score.pinnacle}.` }];
}

/** Seed order for the quarter-finals: you, then alternating Pinnacle and Dominion seeds, then the preliminary winners. */
function seedOrder(state: SeasonState, t: Tournament): string[] {
  const sh = state.shield!;
  const prelim = t.rounds[0].ties;
  const inPrelim = new Set(prelim.flatMap((x) => [x.a, x.b]));
  const dom = Object.keys(t.clubs).filter((id) => leagueOf(t, id) === "dominion" && id !== t.managedId && !inPrelim.has(id));
  const rating = (id: string) => (id === t.managedId ? 99 : teamRating(clubTeam(state, id)));
  const pins = sh.pinnacle.map((c) => c.team.id).filter((id) => !inPrelim.has(id)).sort((a, b) => rating(b) - rating(a) || a.localeCompare(b));
  const winners = prelim.map((x) => x.result!.winner);
  return [t.managedId, pins[0], dom[0], pins[1], dom[1], pins[2], ...winners];
}

// ------------------------------------------------------------------ matches

/** A ready-to-run simulation for a tie, plus which side you are on (undefined when you are not playing). */
export function shieldSim(state: SeasonState, tie: ShieldTie, live = false): { sim: MatchSim; home: Team; away: Team; managedSide?: 0 | 1 } {
  const home = rested(clubTeam(state, tie.a));
  const away = rested(clubTeam(state, tie.b));
  const mineHome = home.id === state.managedId;
  const mineAway = away.id === state.managedId;
  const sim = new MatchSim({
    id: tie.id,
    season: state.season,
    matchday: 0,
    home,
    away,
    homeTactic: mineHome ? state.tactic : aiTactic(home),
    awayTactic: mineAway ? state.tactic : aiTactic(away),
    homeShape: mineHome ? state.shape : SHAPE_BY_STYLE[aiTactic(home)],
    awayShape: mineAway ? state.shape : SHAPE_BY_STYLE[aiTactic(away)],
    homeAiSubs: !mineHome,
    awayAiSubs: !mineAway,
    homeAuto: !(live && mineHome),
    awayAuto: !(live && mineAway),
    seed: hashSeed(state.seed, state.season, tie.id),
  });
  return { sim, home, away, ...(mineHome ? { managedSide: 0 as const } : mineAway ? { managedSide: 1 as const } : {}) };
}

/** Records a tie's result. A knockout cannot end level: tries decide it, then a golden-point kick weighted by team rating. */
function settle(state: SeasonState, tie: ShieldTie, log: MatchLog): void {
  let winner: string;
  let decider: "tries" | "golden" | undefined;
  if (log.homeScore !== log.awayScore) winner = log.homeScore > log.awayScore ? tie.a : tie.b;
  else if (log.homeTries !== log.awayTries) {
    winner = log.homeTries > log.awayTries ? tie.a : tie.b;
    decider = "tries";
  } else {
    const gap = teamRating(clubTeam(state, tie.a)) - teamRating(clubTeam(state, tie.b));
    winner = new Rng(hashSeed(state.seed, state.season, tie.id, "golden")).chance(Math.max(0.3, Math.min(0.7, 0.5 + gap * 0.012))) ? tie.a : tie.b;
    decider = "golden";
  }
  tie.result = { aScore: log.homeScore, bScore: log.awayScore, aTries: log.homeTries, bTries: log.awayTries, winner, ...(decider ? { decider } : {}) };
}

/** How a finished tie reads: "Kano Ironclads 21-14 Accra Meridians", with a note when it was level after 80 minutes. */
export function tieLine(t: Tournament, tie: ShieldTie): string {
  const r = tie.result;
  if (!r) return `${t.clubs[tie.a].name} v ${t.clubs[tie.b].name}`;
  const note = r.decider === "tries" ? ` (level on points; ${t.clubs[r.winner].short} scored more tries)` : r.decider === "golden" ? ` (level; ${t.clubs[r.winner].short} won the golden-point kick)` : "";
  return `${t.clubs[tie.a].name} ${r.aScore}-${r.bScore} ${t.clubs[tie.b].name}${note}`;
}

/**
 * Plays the current round: your tie from the live log if you watched it, every other tie simulated. Returns the
 * new state and your match log (the only one kept). Advances the bracket, and finishes the tournament after the final.
 */
export function playShieldRound(prev: SeasonState, managedLog?: MatchLog): { state: SeasonState; logs: MatchLog[] } {
  if (!shieldPending(prev)) throw new Error("There is no Founders' Shield round to play");
  const state = structuredClone(prev);
  const sh = state.shield!;
  const t = sh.tournament!;
  const round = currentRound(t)!;
  const logs: MatchLog[] = [];
  const news: string[] = [];
  for (const tie of round.ties) {
    const log = managedLog && managedLog.id === tie.id ? managedLog : shieldSim(state, tie).sim.runToEnd().toLog();
    settle(state, tie, log);
    if (tie.a === t.managedId || tie.b === t.managedId) {
      logs.push(log);
      const won = tie.result!.winner === t.managedId;
      const foe = t.clubs[tie.a === t.managedId ? tie.b : tie.a];
      news.push(`${ROUND_NAMES[round.id]}: ${tieLine(t, tie)}. ${won ? `You beat ${foe.name}.` : `${foe.name} knock you out.`}`);
      if (!won) t.outAt = round.id;
    }
  }
  if (round.id === "final") finishTournament(state, news);
  else advance(state, t, round);
  state.news = [...news.map((text) => ({ season: state.season, matchday: 0, text })), ...state.news].slice(0, 14);
  return { state, logs };
}

/** Draws the next round from the winners of the one just played. */
function advance(state: SeasonState, t: Tournament, round: ShieldRound) {
  const w = round.ties.map((x) => x.result!.winner);
  const next = (id: RoundId, pairs: [string, string][]): ShieldRound => ({ id, ties: pairs.map(([a, b], i) => ({ id: `shield-${state.season}-${id}-${i + 1}`, a, b })) });
  if (round.id === "prelim") t.rounds.push(next("quarter", pairQuarter(seedOrder(state, t), (id) => leagueOf(t, id))));
  else if (round.id === "quarter") t.rounds.push(next("semi", [[w[0], w[1]], [w[2], w[3]]]));
  else t.rounds.push(next("final", [[w[0], w[1]]]));
}

// ------------------------------------------------------------------ the result

function finishTournament(state: SeasonState, news: string[]) {
  const sh = state.shield!;
  const t = sh.tournament!;
  const final = t.rounds[t.rounds.length - 1].ties[0];
  const fr = final.result!;
  const winnerId = fr.winner;
  t.winnerId = winnerId;
  const league = leagueOf(t, winnerId);
  sh.score[league]++;
  const runnerUp = winnerId === final.a ? final.b : final.a;
  const mine = winnerId === t.managedId;
  const decided = sh.score[league] >= SHIELD_WINS;
  const scoreLine = `Dominion ${sh.score.dominion}, Pinnacle ${sh.score.pinnacle}`;

  // Records: yours, then the Pinnacle clubs'.
  const pers = sh.personal;
  pers.tournaments++;
  if (mine) pers.shields++;
  if (final.a === t.managedId || final.b === t.managedId) pers.finals++;
  for (const r of t.rounds) for (const tie of r.ties) {
    const res = tie.result!;
    const youIn = tie.a === t.managedId || tie.b === t.managedId;
    if (youIn) {
      pers.played++;
      const foe = tie.a === t.managedId ? tie.b : tie.a;
      if (res.winner === t.managedId) {
        pers.won++;
        pers.defeated[t.clubs[foe].name] = (pers.defeated[t.clubs[foe].name] ?? 0) + 1;
      }
    }
    for (const id of [tie.a, tie.b]) {
      const club = sh.pinnacle.find((c) => c.team.id === id);
      if (!club) continue;
      club.record.played++;
      if (res.winner === id) club.record.won++;
      if (youIn) {
        if (res.winner === id) club.record.beatYou++;
        else club.record.lostToYou++;
      }
    }
  }
  for (const c of sh.pinnacle) {
    if (Object.keys(t.clubs).includes(c.team.id)) c.record.tournaments++;
    if (c.team.id === final.a || c.team.id === final.b) c.record.finals++;
    if (c.team.id === winnerId) c.record.shields++;
  }

  const reached: RoundId | "won" = mine ? "won" : (t.outAt ?? "final");
  const winnerName = t.clubs[winnerId].name;
  const women = state.gender === "women";
  let message: string;
  if (decided) {
    message = league === "dominion" ? `Five Shields. Dominion League is ours${women ? ", and it belongs to every girl who plays in it" : ""}.` : `Five Shields. Dominion League is Pinnacle's.${women ? " Our women gave everything." : ""}`;
  } else if (mine) {
    message = `The Shield is yours. ${scoreLine}.${women ? " Every girl watching saw what is possible." : ""}`;
  } else if (league === "dominion") {
    message = RESCUE_LINE;
  } else {
    message = `Pinnacle take this one. ${scoreLine}.${women ? " Our girls can still turn this around!" : ""}`;
  }
  sh.campaign.push({ season: state.season, winnerId, winnerName, league, runnerUpName: t.clubs[runnerUp].name, score: winnerId === final.a ? `${fr.aScore}-${fr.bScore}` : `${fr.bScore}-${fr.aScore}`, clubName: t.clubs[t.managedId].name, reached, message });
  sh.message = message;
  news.push(`${winnerName} win the Founders' Shield, ${fr.aScore}-${fr.bScore} in the final. ${scoreLine}.`);
  news.push(`${MRS_DANIEL}: "${message}"`);
  if (decided) {
    sh.status = league === "dominion" ? "defended" : "lost";
    sh.endedSeason = state.season;
    return;
  }
  evolvePinnacle(state);
}

/** Pinnacle squads age between tournaments: young players grow, veterans fade, retirees are replaced. */
function evolvePinnacle(state: SeasonState) {
  const sh = state.shield!;
  const teams = sh.pinnacle.map((c) => c.team);
  const retirees = evolvePlayers(teams, hashSeed(state.seed, state.season, "pinnacle"), () => 0.6);
  let n = 0;
  for (const c of sh.pinnacle) {
    for (const r of retirees.get(c.team.id) ?? []) {
      const next = makeProspects(c.team, `${state.season}.${n++}`, r.role, state.seed, 3, 0, c.strength).sort((a, b) => (b.potential ?? 0) - (a.potential ?? 0))[0];
      const i = c.team.players.findIndex((p) => p.id === r.id);
      c.team.players[i] = next;
      c.team.lineup = c.team.lineup.map((id) => (id === r.id ? next.id : id));
      if (c.team.reserves) c.team.reserves = c.team.reserves.map((id) => (id === r.id ? next.id : id));
    }
  }
}

// ------------------------------------------------------------------ the ending

export function dismissVictory(prev: SeasonState): SeasonState {
  const state = structuredClone(prev);
  if (state.shield) state.shield.victorySeen = true;
  return state;
}

/** The scene to show on top of everything: the loss ends the career, the win is shown once. */
export const shieldEnding = (s: SeasonState): "lost" | "defended" | null => (s.shield?.status === "lost" ? "lost" : s.shield?.status === "defended" && !s.shield.victorySeen ? "defended" : null);

export interface LegacyReport {
  seasons: number;
  titles: number;
  bestFinish: number | null;
  clubs: string[];
  shields: number;
  money: number;
  facilities: Record<string, number>;
  notable: { name: string; role: string; apps: number; points: number; tries: number }[];
}

/** Career summary for the final scene: seasons, trophies, finances and the players who defined the club. */
export function legacyReport(s: SeasonState): LegacyReport {
  const mine = s.history;
  const finishes = mine.map((r) => r.managedPosition).filter((n) => n > 0);
  const titles = mine.filter((r) => r.championId === (r.clubId ?? s.managedId)).length;
  const clubs = [...new Set([...mine.map((r) => r.clubId).filter((x): x is string => !!x), s.managedId])].map((id) => s.teams.find((t) => t.id === id)?.name ?? id);
  const club = s.teams.find((t) => t.id === s.managedId)!;
  const total = (p: Player) => {
    const c = s.careerStats[p.id];
    const n = s.seasonStats[p.id];
    return { apps: (c?.apps ?? 0) + (n?.apps ?? 0), points: (c?.points ?? 0) + (n?.points ?? 0), tries: (c?.tries ?? 0) + (n?.tries ?? 0) };
  };
  const notable = club.players.map((p) => ({ name: p.name, role: p.role, ...total(p) })).sort((a, b) => b.points - a.points || b.apps - a.apps).slice(0, 5);
  const levels = s.facilities?.[s.managedId] ?? {};
  return {
    seasons: mine.length + (s.matchday > s.totalMatchdays && !mine.some((r) => r.season === s.season) ? 1 : 0),
    titles,
    bestFinish: finishes.length ? Math.min(...finishes) : null,
    clubs,
    shields: s.shield?.personal.shields ?? 0,
    money: s.money,
    facilities: Object.fromEntries(FACILITY_IDS.map((id) => [id, levelOf(levels, id)])),
    notable,
  };
}

/** Your club's best Shield showing, for the personal record: "Champions", "Lost the final", "Out in the quarter-finals". */
export const reachedText = (r: ShieldResult["reached"]) => (r === "won" ? "Won the Shield" : r === "final" ? "Lost the final" : `Out in the ${ROUND_NAMES[r].toLowerCase()}`);
