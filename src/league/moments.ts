import type { MatchEvent, MatchLog } from "../engine/types";
import type { ChronicleEntry } from "./era";
import { PAIR_MIN } from "./wording";

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
}

/** Largest final margin for a match to count as decided by one moment: a try and a conversion, plus a point of slack. */
export const DECIDED_MARGIN = 7;
/** Moments kept in a ledger while the season runs. */
const KEEP_MOMENTS = 3;
/** Most pair lines and single-moment lines a season can add to the chronicle. */
export const MAX_PAIR_LINES = 2;
export const MAX_MOMENT_LINES = 1;
/** Story lines a whole career can hold, so a long career stays readable. */
export const MAX_STORY_LINES = 10;

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
export function recordMatches(ledger: Ledger | undefined, playerId: string, clubId: string, season: number, logs: MatchLog[]): Ledger {
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

interface Candidate {
  entry: ChronicleEntry;
  strength: number;
}

/**
 * What the season shows, as chronicle entries: the best single moment and the strongest pair patterns, each pair
 * only once. Most seasons return nothing.
 */
export function closeLedger(l: Ledger | undefined, existing: ChronicleEntry[]): ChronicleEntry[] {
  if (!l) return [];
  const room = MAX_STORY_LINES - existing.filter((c) => STORY_KEYS.has(c.key)).length;
  if (room <= 0) return [];
  const out: ChronicleEntry[] = [];
  const best = l.moments[0];
  if (best) out.push({ season: l.season, key: best.key, clubId: l.clubId, vsId: best.vsId, score: best.score, minute: best.minute, value: best.margin });
  const pairs: Candidate[] = [];
  for (const [id, t] of Object.entries(l.mates)) {
    const seq = t.seq.padEnd(l.played, "-");
    const base = { season: l.season, clubId: l.clubId, otherId: id, otherName: t.name };
    const together = [...Array(l.played).keys()].filter((i) => l.own[i] === "f" && seq[i] === "m").length;
    const turns = longestTurns(l.own, seq, l.played);
    const options = ([
      { entry: { ...base, key: "supplier", value: t.gave }, strength: t.gave / PAIR_MIN.supplier },
      { entry: { ...base, key: "finisher", value: t.got }, strength: t.got / PAIR_MIN.finisher },
      { entry: { ...base, key: "alternating", value: turns }, strength: turns / PAIR_MIN.alternating },
      { entry: { ...base, key: "together", value: together }, strength: together / PAIR_MIN.together },
    ] as Candidate[]).filter((o) => o.strength >= 1);
    options.sort((a, b) => b.strength - a.strength);
    if (options[0]) pairs.push(options[0]);
  }
  pairs.sort((a, b) => b.strength - a.strength);
  out.push(...pairs.slice(0, MAX_PAIR_LINES).map((p) => p.entry));
  return out.slice(0, room);
}

export const STORY_KEYS = new Set<string>(["winning-try", "winning-kick", "stand", "supplier", "finisher", "alternating", "together", "replaced"]);
