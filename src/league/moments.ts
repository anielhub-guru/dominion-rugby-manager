import type { MatchEvent, MatchLog } from "../engine/types";
import type { ChronicleEntry } from "./era";
import { PAIR_MIN, VS_MIN } from "./wording";

/**
 * Story moments for followed players. Detectors read finished match logs and notice patterns; nothing here touches
 * a match. A season's observations are kept in a small ledger and turned into at most a few chronicle entries when
 * the season closes, so most seasons say little and the lines that do appear mean something.
 */

export type MomentKey = "winning-try" | "winning-kick" | "stand";

/** One thing a followed player did in one match that decided it. */
export interface Moment {
  key: MomentKey;
  matchday: number;
  minute: number;
  vsId: string;
  /** Final score from the followed player's club's side, "24-21". */
  score: string;
  margin: number;
}

export interface Tally {
  name: string;
  /** One character per club match this season: "m" if this teammate scored a try, "-" if not. */
  seq: string;
  /** Tries the followed player set up for this teammate, and tries this teammate set up for them. */
  gave: number;
  got: number;
}

/** What one season has shown so far about a followed player on a roster. */
export interface Ledger {
  season: number;
  clubId: string;
  /** Club matches seen. */
  played: number;
  /** One character per club match: "f" if the followed player scored a try, "-" if not. */
  own: string;
  mates: Record<string, Tally>;
  moments: Moment[];
  /** The first time they played the club that introduced them, if that happened this season. */
  meeting?: { vsId: string; score: string; tries: number; matchday: number };
}

/** How a followed player has fared against one club, over a career. */
export interface ClubTally {
  /** Matches they played against this club. */
  meetings: number;
  /** Matches in which they scored a try. */
  scored: number;
  /** Straight meetings with a try, meetings since the last try, straight meetings without defeat, straight defeats. */
  run: number;
  dry: number;
  unbeaten: number;
  losing: number;
  /** The count last written to the chronicle for each pattern, so a streak is not told twice. */
  said?: Partial<Record<"run" | "dry" | "unbeaten" | "losing", number>>;
}

/** How a followed player has fared against one opposing player, in matches where that player scored or was carded. */
export interface FoeTally {
  name: string;
  clubId: string;
  /** Matches in which both scored, only the opponent scored, and both were carded. */
  both: number;
  foeOnly: number;
  clash: number;
  /** Last season seen, so old foes can be forgotten. */
  last: number;
  said?: Partial<Record<"duel" | "nemesis" | "clash", number>>;
}

/** A player they shared a roster with. */
export interface PastMate {
  name: string;
  /** The club the mate was last seen at with them. */
  clubId: string;
  /** Seasons shared. */
  seasons: number;
  last: number;
  /** Set once they have faced this player as an opponent. */
  met?: boolean;
}

/** First meetings with a former teammate this season, waiting for the season to close. */
export interface Reunion {
  id: string;
  name: string;
  /** The club the old teammate played for in that match. */
  clubId: string;
  score: string;
  tries: number;
  theirTries: number;
  shared: number;
}

export interface VsRecord {
  clubs: Record<string, ClubTally>;
  foes: Record<string, FoeTally>;
  /** Everyone they have shared a roster with. Missing on older saves. */
  past?: Record<string, PastMate>;
  pending?: Reunion[];
}

/** Notes who is on the followed player's roster, at the end of a season. */
export function rememberMates(vs: VsRecord | undefined, playerId: string, mates: { id: string; name: string }[], clubId: string, season: number): VsRecord {
  const rec: VsRecord = vs ?? { clubs: {}, foes: {} };
  const past = (rec.past ??= {});
  for (const m of mates) {
    if (m.id === playerId) continue;
    const was = past[m.id];
    past[m.id] = { name: m.name, clubId, seasons: (was?.seasons ?? 0) + (was?.last === season ? 0 : 1), last: season, ...(was?.met ? { met: true } : {}) };
  }
  return rec;
}

/** Largest final margin for a match to count as decided by one moment: a try and a conversion, plus a point of slack. */
export const DECIDED_MARGIN = 7;
/** Moments kept in a ledger while the season runs. */
const KEEP_MOMENTS = 3;
/** Story lines a whole career can hold, so a long career stays readable. */
export const MAX_STORY_LINES = 14;

const SCORING = new Set(["try", "conversion", "penalty-goal", "drop-goal"]);

/**
 * The score that settled a match: the first one after which the winner was never level or behind again. Only matches
 * decided by `DECIDED_MARGIN` or less have one. A try decides it, or the kick that follows when the try alone left the
 * scorer's side short. A penalty or drop goal decides it too.
 */
export function decidingScore(log: MatchLog): { side: 0 | 1; margin: number; event: MatchEvent; kind: "try" | "kick"; id: string; minute: number } | null {
  const margin = Math.abs(log.homeScore - log.awayScore);
  if (margin === 0 || margin > DECIDED_MARGIN) return null;
  const side: 0 | 1 = log.homeScore > log.awayScore ? 0 : 1;
  const lead = (e: MatchEvent) => (side === 0 ? e.homeScore - e.awayScore : e.awayScore - e.homeScore);
  let last = -1;
  log.events.forEach((e, i) => {
    if (lead(e) <= 0) last = i;
  });
  const ev = log.events[last + 1];
  if (!ev || !SCORING.has(ev.type) || ev.team !== side || !ev.pid) return null;
  if (ev.type === "try") return { side, margin, event: ev, kind: "try", id: ev.pid, minute: ev.minute };
  // A conversion that tipped it: the try before it was by the same side and left them short.
  return { side, margin, event: ev, kind: "kick", id: ev.pid, minute: ev.minute };
}

/** The moments in one match that belong to a given player, if any. */
export function momentsIn(log: MatchLog, playerId: string, clubId: string): Moment[] {
  const out: Moment[] = [];
  const side: 0 | 1 = log.homeId === clubId ? 0 : 1;
  const vsId = side === 0 ? log.awayId : log.homeId;
  const mine = side === 0 ? log.homeScore : log.awayScore;
  const theirs = side === 0 ? log.awayScore : log.homeScore;
  const margin = mine - theirs;
  if (margin <= 0 || margin > DECIDED_MARGIN) return out;
  const base = { matchday: log.matchday, vsId, score: `${mine}-${theirs}`, margin };
  const deciding = decidingScore(log);
  if (deciding && deciding.side === side && deciding.id === playerId) out.push({ ...base, key: deciding.kind === "try" ? "winning-try" : "winning-kick", minute: deciding.minute });
  // The last stand by the winning side, if it was theirs.
  const stand = [...(log.stands ?? [])].filter((s) => s.team === side).pop();
  if (stand && stand.id === playerId) out.push({ ...base, key: "stand", minute: stand.minute });
  return out;
}

/** How memorable a moment is: tighter and later is more. */
export const salience = (m: Moment) => 8 - m.margin + (m.minute >= 38 ? 3 : m.minute >= 33 ? 1 : 0) + (m.key === "stand" ? 0 : 1);

/** Adds one matchday's logs to a followed player's ledger. Does nothing for matches their club did not play. */
export function recordMatches(ledger: Ledger | undefined, playerId: string, clubId: string, season: number, logs: MatchLog[], origin?: { clubId: string; met: boolean }): Ledger {
  let l = ledger;
  if (!l || l.season !== season || l.clubId !== clubId) l = { season, clubId, played: 0, own: "", mates: {}, moments: [] };
  for (const log of logs) {
    if (log.homeId !== clubId && log.awayId !== clubId) continue;
    const side: 0 | 1 = log.homeId === clubId ? 0 : 1;
    const tries = log.events.filter((e) => e.type === "try" && e.team === side && e.pid);
    const scorers = new Set(tries.map((e) => e.pid!));
    const names = new Map((log.players ?? []).map((p) => [p.id, p.name]));
    const ensure = (id: string): Tally => {
      const t = (l!.mates[id] ??= { name: names.get(id) ?? id, seq: "", gave: 0, got: 0 });
      t.seq = t.seq.padEnd(l!.played, "-");
      return t;
    };
    // Pad every known teammate for this match, then mark those who scored.
    for (const id of Object.keys(l.mates)) ensure(id);
    for (const id of scorers) if (id !== playerId) ensure(id);
    // Whoever set up one of the followed player's tries is a teammate to keep track of, scorer or not.
    for (const e of tries) if (e.pid === playerId && e.assist) ensure(e.assist);
    for (const [id, t] of Object.entries(l.mates)) t.seq += scorers.has(id) ? "m" : "-";
    l.own += scorers.has(playerId) ? "f" : "-";
    for (const e of tries) {
      if (!e.assist) continue;
      if (e.assist === playerId && e.pid !== playerId) ensure(e.pid!).gave++;
      else if (e.pid === playerId && e.assist !== playerId) ensure(e.assist).got++;
    }
    l.played++;
    // The first match against the club that introduced them, once they have left it.
    const vs = side === 0 ? log.awayId : log.homeId;
    const line = (log.players ?? []).find((p) => p.id === playerId);
    if (origin && !origin.met && !l.meeting && line && vs === origin.clubId && clubId !== origin.clubId) {
      l.meeting = { vsId: vs, score: `${side === 0 ? log.homeScore : log.awayScore}-${side === 0 ? log.awayScore : log.homeScore}`, tries: line.tries, matchday: log.matchday };
    }
    for (const m of momentsIn(log, playerId, clubId)) l.moments = [...l.moments, m].sort((a, b) => salience(b) - salience(a)).slice(0, KEEP_MOMENTS);
  }
  return l;
}

/** The longest run of matches in which one of the two scored, taking turns or both scoring, at least two each. */
export function longestTurns(own: string, mate: string, played: number): number {
  let best = 0;
  let run = 0;
  let prev = "";
  let f = 0;
  let m = 0;
  const flush = () => {
    if (run >= PAIR_MIN.alternating && f >= 2 && m >= 2) best = Math.max(best, run);
    run = f = m = 0;
    prev = "";
  };
  for (let i = 0; i < played; i++) {
    const a = own[i] === "f";
    const b = mate[i] === "m";
    if (!a && !b) {
      flush();
      continue;
    }
    const c = a && b ? "b" : a ? "f" : "m";
    // Two in a row by the same one ends the turns; the later match starts a new run.
    if (c !== "b" && c === prev) flush();
    run++;
    if (a) f++;
    if (b) m++;
    prev = c;
  }
  flush();
  return best;
}

/** Adds matches to the career-long record against other clubs and their players. Only matches the player played count. */
export function recordVs(vs: VsRecord | undefined, playerId: string, clubId: string, season: number, logs: MatchLog[]): VsRecord {
  const rec: VsRecord = vs ?? { clubs: {}, foes: {} };
  for (const log of logs) {
    if (log.homeId !== clubId && log.awayId !== clubId) continue;
    const line = (log.players ?? []).find((p) => p.id === playerId);
    if (!line) continue;
    const side: 0 | 1 = log.homeId === clubId ? 0 : 1;
    const vsId = side === 0 ? log.awayId : log.homeId;
    const mine = side === 0 ? log.homeScore : log.awayScore;
    const theirs = side === 0 ? log.awayScore : log.homeScore;
    const c = (rec.clubs[vsId] ??= { meetings: 0, scored: 0, run: 0, dry: 0, unbeaten: 0, losing: 0 });
    c.meetings++;
    if (line.tries > 0) {
      c.scored++;
      c.run++;
      c.dry = 0;
    } else {
      c.run = 0;
      c.dry++;
    }
    c.unbeaten = mine >= theirs ? c.unbeaten + 1 : 0;
    c.losing = mine < theirs ? c.losing + 1 : 0;
    const carded = line.yellows + line.reds > 0;
    for (const o of log.players ?? []) {
      if (o.team === side) continue;
      // The first time they face someone they once shared a roster with.
      const old = rec.past?.[o.id];
      if (old && !old.met && old.last < season) {
        old.met = true;
        (rec.pending ??= []).push({ id: o.id, name: o.name, clubId: vsId, score: `${mine}-${theirs}`, tries: line.tries, theirTries: o.tries, shared: old.seasons });
      }
      const scored = o.tries > 0;
      const oCarded = o.yellows + o.reds > 0;
      if (!scored && !(carded && oCarded)) continue;
      const f = (rec.foes[o.id] ??= { name: o.name, clubId: vsId, both: 0, foeOnly: 0, clash: 0, last: season });
      f.clubId = vsId;
      f.last = season;
      if (scored) {
        if (line.tries > 0) f.both++;
        else f.foeOnly++;
      }
      if (carded && oCarded) f.clash++;
    }
  }
  return rec;
}

/** Forgets opposing players not seen for a few seasons and met only once or twice. */
export function pruneVs(vs: VsRecord | undefined, season: number) {
  if (!vs) return;
  for (const [id, f] of Object.entries(vs.foes)) if (f.last < season - 4 && f.both + f.foeOnly + f.clash < 3) delete vs.foes[id];
}

export interface Candidate {
  entry: ChronicleEntry;
  strength: number;
  /** Run once the candidate is written, to remember what has been said. */
  commit?: () => void;
}

/** The count at which a pattern is next worth saying: its minimum the first time, then a few more than last said. */
const nextAt = (said: number | undefined, min: number, step: number) => (said ? said + step : min);

/** Patterns against clubs and their players that have grown past what the chronicle last said. */
export function vsCandidates(vs: VsRecord | undefined, season: number, clubId: string): Candidate[] {
  const out: Candidate[] = [];
  if (!vs) return out;
  for (const [id, c] of Object.entries(vs.clubs)) {
    const said = (c.said ??= {});
    const counts = { run: c.run, dry: c.dry, unbeaten: c.unbeaten, losing: c.losing } as const;
    const keys = { run: "scoring-run", dry: "drought", unbeaten: "unbeaten", losing: "losing" } as const;
    // A drought only counts for someone who scores elsewhere; a Sweeper not scoring against a club is not news.
    const others = Object.entries(vs.clubs).filter(([k]) => k !== id).reduce((t, [, o]) => ({ m: t.m + o.meetings, s: t.s + o.scored }), { m: 0, s: 0 });
    const scorer = others.m >= 6 && others.s / others.m >= 0.35;
    for (const k of ["run", "dry", "unbeaten", "losing"] as const) {
      const n = counts[k];
      if (n < VS_MIN[k] || (k === "dry" && !scorer)) {
        delete said[k];
        continue;
      }
      if (n < nextAt(said[k], VS_MIN[k], 3)) continue;
      out.push({ entry: { season, key: keys[k], clubId, vsId: id, value: n }, strength: n / VS_MIN[k], commit: () => void (said[k] = n) });
    }
  }
  // The old teammate they shared most seasons with, if one was met for the first time this season.
  const reunion = [...(vs.pending ?? [])].sort((a, b) => b.shared - a.shared)[0];
  if (reunion) out.push({ entry: { season, key: "reunion", clubId, vsId: reunion.clubId, otherId: reunion.id, otherName: reunion.name, score: reunion.score, value: reunion.shared, detail: `${reunion.tries}-${reunion.theirTries}` }, strength: 2 });
  for (const [id, f] of Object.entries(vs.foes)) {
    const said = (f.said ??= {});
    const counts = { duel: f.both, nemesis: f.foeOnly, clash: f.clash } as const;
    for (const k of ["duel", "nemesis", "clash"] as const) {
      const n = counts[k];
      if (n < nextAt(said[k], VS_MIN[k], k === "clash" ? 2 : 3) || (k === "nemesis" && f.foeOnly <= 2 * f.both)) continue;
      out.push({ entry: { season, key: k, clubId, vsId: f.clubId, otherId: id, otherName: f.name, value: n }, strength: n / VS_MIN[k], commit: () => void (said[k] = n) });
    }
  }
  return out;
}

/** Most lines a season adds beyond the single deciding moment: pairs, rivalries and club patterns compete for them. */
export const MAX_SEASON_EXTRAS = 3;

/**
 * What the season shows, as chronicle entries: the best single moment, then the strongest of the teammate patterns,
 * rivalries and club patterns (`extras`), each pair only once. The first meeting with the origin club always counts.
 * Most seasons return little.
 */
export function closeLedger(l: Ledger | undefined, existing: ChronicleEntry[], extras: Candidate[] = [], origin?: { signed: boolean }): ChronicleEntry[] {
  const out: ChronicleEntry[] = [];
  if (l?.meeting) out.push({ season: l.season, key: "first-meeting", clubId: l.clubId, vsId: l.meeting.vsId, score: l.meeting.score, value: l.meeting.tries, detail: origin?.signed ? "left" : "passed" });
  const room = MAX_STORY_LINES - existing.filter((c) => STORY_KEYS.has(c.key) && !STRUCTURAL_KEYS.has(c.key)).length;
  if (room <= 0 || (!l && !extras.length)) return out;
  const picked: ChronicleEntry[] = [];
  const best = l?.moments[0];
  if (l && best) picked.push({ season: l.season, key: best.key, clubId: l.clubId, vsId: best.vsId, score: best.score, minute: best.minute, value: best.margin });
  const pool: Candidate[] = [...extras];
  for (const [id, t] of Object.entries(l?.mates ?? {})) {
    const seq = t.seq.padEnd(l!.played, "-");
    const base = { season: l!.season, clubId: l!.clubId, otherId: id, otherName: t.name };
    const together = [...Array(l!.played).keys()].filter((i) => l!.own[i] === "f" && seq[i] === "m").length;
    const turns = longestTurns(l!.own, seq, l!.played);
    const options = ([
      { entry: { ...base, key: "supplier", value: t.gave }, strength: t.gave / PAIR_MIN.supplier },
      { entry: { ...base, key: "finisher", value: t.got }, strength: t.got / PAIR_MIN.finisher },
      { entry: { ...base, key: "alternating", value: turns }, strength: turns / PAIR_MIN.alternating },
      { entry: { ...base, key: "together", value: together }, strength: together / PAIR_MIN.together },
    ] as Candidate[]).filter((o) => o.strength >= 1);
    options.sort((a, b) => b.strength - a.strength);
    if (options[0]) pool.push(options[0]);
  }
  pool.sort((a, b) => b.strength - a.strength);
  const chosen = pool.slice(0, MAX_SEASON_EXTRAS);
  for (const c of chosen) c.commit?.();
  picked.push(...chosen.map((c) => c.entry));
  out.push(...picked.slice(0, room));
  return out;
}

/** Lines that mark a fixed point in a career. They always count and never use up a season's places. */
export const STRUCTURAL_KEYS = new Set<string>(["replaced", "first-meeting", "return"]);

export const STORY_KEYS = new Set<string>(["reunion", "return", "winning-try", "winning-kick", "stand", "supplier", "finisher", "alternating", "together", "replaced", "first-meeting", "scoring-run", "drought", "unbeaten", "losing", "duel", "nemesis", "clash", "top-scorer", "runner-up-scorer"]);
