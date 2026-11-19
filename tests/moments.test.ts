import { describe, expect, it } from "vitest";
import { simulateMatch } from "../src/engine/match";
import { hashSeed } from "../src/engine/rng";
import type { MatchEvent, MatchLog } from "../src/engine/types";
import { generateTeams } from "../src/league/teams";
import { MAX_STORY_LINES, STORY_KEYS, STRUCTURAL_KEYS, closeLedger, rememberMates, decidingScore, longestTurns, momentsIn, pruneVs, recordMatches, recordVs, vsCandidates, type Ledger } from "../src/league/moments";
import { alongside, chronicleLines, closeEraLedger, newEraProspect, raceCandidate, recordEraSeason } from "../src/league/era";
import { storyText } from "../src/league/wording";
import { autoPlan, completeOffseason, isSeasonOver, newGame, playMatchday, startNextSeason, teamById, type OffseasonPlan, type SeasonState } from "../src/league/season";
import { overall } from "../src/league/teams";
import { ROLES } from "../src/engine/types";

const teams = generateTeams(7);

const ev = (type: MatchEvent["type"], team: 0 | 1, pid: string, home: number, away: number, minute: number, assist?: string): MatchEvent =>
  ({ sec: minute * 60, step: 0, minute, x0: 0, x1: 0, type, text: "", key: true, team, pid, assist, homeScore: home, awayScore: away });
const log = (events: MatchEvent[], homeScore: number, awayScore: number, extra: Partial<MatchLog> = {}, matchday = 1): MatchLog =>
  ({ id: "m", season: 1, matchday, homeId: "H", awayId: "A", homeName: "Home", awayName: "Away", homeTactic: "balanced", awayTactic: "balanced", homeScore, awayScore, homeTries: 0, awayTries: 0, events, stats: [] as never, ...extra });

describe("engine records", () => {
  it("names the scorer on scoring events and the passer on some tries, always a teammate", () => {
    let tries = 0, assisted = 0;
    for (let n = 0; n < 60; n++) {
      const m = simulateMatch({ id: "a", season: 1, matchday: 1, home: teams[1], away: teams[4], homeTactic: "balanced", awayTactic: "balanced", seed: hashSeed("assist", n) });
      const side = (id: string) => (teams[1].players.some((p) => p.id === id) ? 0 : 1);
      for (const e of m.events) {
        if (e.type === "try" || e.type === "conversion") expect(e.pid).toBeTruthy();
        if (e.type !== "try") continue;
        tries++;
        if (e.assist) {
          assisted++;
          expect(e.assist).not.toBe(e.pid);
          expect(side(e.assist)).toBe(e.team);
        }
      }
    }
    expect(tries).toBeGreaterThan(100);
    expect(assisted / tries).toBeGreaterThan(0.15);
    expect(assisted / tries).toBeLessThan(0.95);
  });
});

describe("deciding moments", () => {
  it("finds the try that put the winners ahead for good, and nothing in a rout", () => {
    const close = log([ev("try", 1, "x", 0, 5, 10), ev("conversion", 1, "x", 0, 7, 10), ev("try", 0, "p", 5, 7, 20), ev("conversion", 0, "p", 7, 7, 20), ev("try", 0, "p", 12, 7, 39), ev("fulltime", 0, "p", 12, 7, 40)], 12, 7);
    const d = decidingScore(close)!;
    expect(d).toMatchObject({ side: 0, kind: "try", id: "p", minute: 39, margin: 5 });
    expect(momentsIn(close, "p", "H").map((m) => m.key)).toEqual(["winning-try"]);
    expect(momentsIn(close, "p", "A")).toEqual([]);
    const rout = log([ev("try", 0, "p", 5, 0, 5), ev("try", 0, "p", 10, 0, 9), ev("try", 0, "p", 15, 0, 20), ev("try", 0, "p", 20, 0, 30)], 20, 0);
    expect(decidingScore(rout)).toBeNull();
    expect(decidingScore(log([], 7, 7))).toBeNull();
  });

  it("credits a kick that decided it, and the last stand of the winning side", () => {
    const m = log([ev("try", 1, "x", 0, 5, 5), ev("penalty-goal", 0, "k", 3, 5, 20), ev("try", 0, "t", 8, 5, 30), ev("drop-goal", 0, "k", 11, 5, 35)], 11, 5, { stands: [{ id: "d", team: 0, minute: 31, lead: 3 }, { id: "e", team: 0, minute: 39, lead: 6 }, { id: "z", team: 1, minute: 40, lead: 2 }] });
    expect(momentsIn(m, "t", "H").map((x) => x.key)).toEqual(["winning-try"]);
    expect(momentsIn(m, "e", "H").map((x) => x.key)).toEqual(["stand"]);
    expect(momentsIn(m, "d", "H")).toEqual([]);
    expect(momentsIn(m, "z", "A")).toEqual([]);
  });
});

describe("pair patterns", () => {
  it("counts turns, joint scoring and supplied tries, and closes to a few lines", () => {
    // Followed player "f" and teammate "m" score in turn for six matches; "m" also sets up three of f's tries.
    let l: Ledger | undefined;
    const scorers = ["f", "m", "f", "m", "f", "m"];
    scorers.forEach((who, i) => {
      const assist = who === "f" && i < 6 ? "m" : undefined;
      l = recordMatches(l, "f", "H", 1, [log([ev("try", 0, who, 5, 0, 10, assist), ev("fulltime", 0, who, 5, 0, 40)], 5, 0, { matchday: i + 1, players: [{ id: "m", name: "Ada Idowu" } as never, { id: "f", name: "Lead" } as never] })]);
    });
    expect(l!.played).toBe(6);
    expect(l!.own).toBe("f-f-f-");
    expect(l!.mates.m.seq).toBe("-m-m-m");
    expect(l!.mates.m.got).toBe(3);
    expect(longestTurns(l!.own, l!.mates.m.seq, 6)).toBe(6);
    const entries = closeLedger(l, []);
    const pairs = entries.filter((e) => e.otherId);
    expect(pairs.length).toBe(1);
    expect(pairs[0]).toMatchObject({ key: "alternating", otherId: "m", otherName: "Ada Idowu", value: 6 });
    expect(entries.filter((e) => e.vsId).length).toBeLessThanOrEqual(1);
  });

  it("says nothing when the pattern is thin", () => {
    let l: Ledger | undefined;
    for (let i = 0; i < 12; i++) l = recordMatches(l, "f", "H", 1, [log([ev("try", 0, i % 5 === 0 ? "f" : "q", 20, 0, 10), ev("fulltime", 0, "f", 20, 0, 40)], 20, 0, { matchday: i + 1 })]);
    expect(closeLedger(l, [])).toEqual([]);
    expect(closeLedger(undefined, [])).toEqual([]);
  });

  it("does not take a run of the same player scoring as turns", () => {
    expect(longestTurns("ff-ff-f", "-------", 7)).toBe(0);
    expect(longestTurns("f-f-f", "-m-m-", 5)).toBe(5); // f m f m f
    expect(longestTurns("ffff", "-mmm", 4)).toBe(0); // under five matches
    expect(longestTurns("fffff-", "-mmmm-", 6)).toBe(5); // both scoring in successive matches counts
  });
});

const line = (id: string, team: 0 | 1, tries: number, cards = 0) => ({ id, name: id.toUpperCase(), team, tries, yellows: cards, reds: 0 }) as never;
const meet = (home: string, away: string, hs: number, as: number, players: unknown[], matchday = 1) => log([], hs, as, { homeId: home, awayId: away, players: players as never, matchday });

describe("against other clubs and players", () => {
  it("notes the first meeting with the origin club only once they have left it and played", () => {
    const origin = { clubId: "O", met: false };
    const away = meet("X", "O", 21, 24, [line("f", 0, 1), line("o1", 1, 2)]);
    const l = recordMatches(undefined, "f", "X", 3, [meet("X", "Y", 5, 0, [line("f", 0, 0)]), away], origin);
    expect(l.meeting).toEqual({ vsId: "O", score: "21-24", tries: 1, matchday: 1 });
    const out = closeLedger(l, [], [], { signed: false });
    expect(out[0]).toMatchObject({ key: "first-meeting", vsId: "O", score: "21-24", value: 1, detail: "passed" });
    expect(recordMatches(undefined, "f", "X", 3, [away], { clubId: "O", met: true }).meeting).toBeUndefined();
    expect(recordMatches(undefined, "f", "O", 3, [meet("O", "X", 5, 0, [line("f", 0, 0)])], origin).meeting).toBeUndefined(); // still at the origin club
    expect(recordMatches(undefined, "f", "X", 3, [meet("X", "O", 5, 0, [line("q", 0, 0)])], origin).meeting).toBeUndefined(); // did not play
    const text = chronicleLines({ ...newEraProspect({ id: "f", name: "Hauwa", role: "Winger", age: 17 } as never, "O", 2), chronicle: out }, (id) => `Club ${id}`).join(" ");
    expect(text).toContain("Club O");
    expect(text).toContain("21-24");
  });

  it("tracks club streaks, and duels, nemeses and clashes with opposing players", () => {
    let vs;
    // Against O: f scores in each of six meetings; o1 scores in all six (a duel); o2 scores when f does not.
    for (let i = 0; i < 6; i++) vs = recordVs(vs, "f", "X", 3, [meet("X", "O", 10, 7, [line("f", 0, 1, 1), line("o1", 1, 1, 1)])]);
    for (let i = 0; i < 5; i++) vs = recordVs(vs, "f", "X", 3, [meet("X", "P", 0, 9, [line("f", 0, 0), line("o2", 1, 1)])]);
    expect(vs!.clubs.O).toMatchObject({ meetings: 6, scored: 6, run: 6, unbeaten: 6, losing: 0 });
    expect(vs!.clubs.P).toMatchObject({ meetings: 5, scored: 0, dry: 5, losing: 5 });
    expect(vs!.foes.o1).toMatchObject({ both: 6, foeOnly: 0, clash: 6 });
    expect(vs!.foes.o2).toMatchObject({ both: 0, foeOnly: 5 });
    const keys = vsCandidates(vs, 3, "X").map((c) => c.entry.key).sort();
    expect(keys).toEqual(["clash", "drought", "duel", "losing", "nemesis", "scoring-run", "unbeaten"]);
    // Once told they are not told again until the streak grows.
    for (const c of vsCandidates(vs, 3, "X")) c.commit!();
    expect(vsCandidates(vs, 4, "X")).toEqual([]);
    vs = recordVs(vs, "f", "X", 4, [meet("X", "O", 10, 7, [line("f", 0, 1)])]);
    expect(vsCandidates(vs, 4, "X")).toEqual([]); // one more meeting is not news
    for (let i = 0; i < 2; i++) vs = recordVs(vs, "f", "X", 4, [meet("X", "O", 10, 7, [line("f", 0, 1)])]);
    expect(vsCandidates(vs, 4, "X").map((c) => c.entry.key).sort()).toEqual(["scoring-run", "unbeaten"]);
  });

  it("limits a season to a few lines and forgets old one-off foes", () => {
    let vs;
    for (let i = 0; i < 6; i++) vs = recordVs(vs, "f", "X", 3, [meet("X", "O", 10, 7, [line("f", 0, 1, 1), line("o1", 1, 1, 1)])]);
    for (let i = 0; i < 5; i++) vs = recordVs(vs, "f", "X", 3, [meet("X", "P", 0, 9, [line("f", 0, 0), line("o2", 1, 1)])]);
    expect(closeLedger(undefined, [], vsCandidates(vs, 3, "X")).length).toBe(3);
    const lone = recordVs(undefined, "f", "X", 1, [meet("X", "O", 5, 0, [line("f", 0, 0), line("z", 1, 1)])]);
    pruneVs(lone, 9);
    expect(lone.foes.z).toBeUndefined();
  });

  it("puts a player in the scoring race only when they are first, or close behind", () => {
    const r = newEraProspect({ id: "f", name: "Hauwa", role: "Winger", age: 17 } as never, "O", 2);
    const t = (f: number) => [{ id: "f", name: "Hauwa", clubId: "X", points: f }, { id: "a", name: "Ada", clubId: "Y", points: 40 }, { id: "b", name: "Bee", clubId: "Z", points: 20 }];
    expect(raceCandidate(r, 3, "X", t(52))!.entry).toMatchObject({ key: "top-scorer", otherName: "Ada", vsId: "Y", value: 12 });
    expect(raceCandidate(r, 3, "X", t(35))!.entry).toMatchObject({ key: "runner-up-scorer", otherName: "Ada", value: 5 });
    expect(raceCandidate(r, 3, "X", t(10))).toBeNull();
    expect(raceCandidate(r, 3, "X", t(0))).toBeNull();
  });
});

describe("old teammates and returns", () => {
  it("notes the first meeting with a former teammate, once, and tells it for the longest-shared one", () => {
    let vs = rememberMates(undefined, "f", [{ id: "f", name: "F" }, { id: "t1", name: "Ada Idowu" }, { id: "t2", name: "Bee" }], "O", 2);
    vs = rememberMates(vs, "f", [{ id: "f", name: "F" }, { id: "t1", name: "Ada Idowu" }], "O", 3);
    expect(vs.past!.t1).toMatchObject({ seasons: 2, last: 3 });
    expect(vs.past!.t2).toMatchObject({ seasons: 1 });
    // Season 4: f is now at X and meets both old mates, now at O, in one match each.
    vs = recordVs(vs, "f", "X", 4, [meet("X", "O", 14, 10, [line("f", 0, 1), line("t1", 1, 1), line("t2", 1, 0)])]);
    expect(vs.pending!.map((p) => p.id).sort()).toEqual(["t1", "t2"]);
    vs = recordVs(vs, "f", "X", 4, [meet("X", "O", 14, 10, [line("f", 0, 1), line("t1", 1, 1)])]);
    expect(vs.pending!.length).toBe(2); // met once only
    const c = vsCandidates(vs, 4, "X").filter((x) => x.entry.key === "reunion");
    expect(c.length).toBe(1);
    expect(c[0].entry).toMatchObject({ otherId: "t1", otherName: "T1", vsId: "O", value: 2, detail: "1-1", score: "14-10" });
    // A mate of the same season is not "former".
    const same = rememberMates(undefined, "f", [{ id: "t1", name: "Ada" }], "X", 4);
    expect(recordVs(same, "f", "X", 4, [meet("X", "O", 1, 0, [line("f", 0, 0), line("t1", 1, 0)])]).pending ?? []).toEqual([]);
    const r = { ...newEraProspect({ id: "f", name: "F", role: "Winger", age: 17 } as never, "O", 2), status: "playing" as const, vs };
    closeEraLedger(r, 4, "X");
    expect(r.chronicle.some((x) => x.key === "reunion")).toBe(true);
    expect(r.vs!.pending).toEqual([]);
    const text = chronicleLines(r, (id) => `Club ${id}`).join(" ");
    expect(text).toContain("T1");
    expect(alongside(r, (id) => `Club ${id}`)[0]).toMatchObject({ name: "T1", club: "Club O" });
  });

  it("records a return to the origin club, whether they were once there or not", () => {
    const fresh = () => ({ ...newEraProspect({ id: "f", name: "F", role: "Winger", age: 17 } as never, "O", 2), status: "playing" as const });
    const was = fresh();
    recordEraSeason(was, 2, "O", 3, 14, "Origin");
    recordEraSeason(was, 3, "X", 3, 14, "Xtown");
    recordEraSeason(was, 4, "X", 3, 14, "Xtown");
    recordEraSeason(was, 5, "O", 3, 14, "Origin");
    const back = was.chronicle.find((c) => c.key === "return")!;
    expect(back).toMatchObject({ season: 5, clubId: "O", value: 2, detail: "left" });
    expect(chronicleLines(was, (id) => `Club ${id}`).join(" ")).toMatch(/Club O/);
    const never = fresh();
    recordEraSeason(never, 3, "X", 3, 14, "Xtown");
    recordEraSeason(never, 4, "O", 3, 14, "Origin");
    expect(never.chronicle.find((c) => c.key === "return")).toMatchObject({ season: 4, detail: "passed", value: 1 });
    // Never leaving does not count.
    const stay = fresh();
    recordEraSeason(stay, 2, "O", 3, 14, "Origin");
    recordEraSeason(stay, 3, "O", 3, 14, "Origin");
    expect(stay.chronicle.some((c) => c.key === "return")).toBe(false);
    expect(STRUCTURAL_KEYS.has("return")).toBe(true);
  });
});

describe("wording", () => {
  const w = { name: "Hauwa Salisu", club: "Kano Ironclads", other: "Ada Idowu", vs: "Abuja Wardens", score: "24-21", minute: 39, n: 5, role: "Winger", age: 33 };
  it("is stable for an entry, varies between entries, and always carries the facts", () => {
    expect(storyText("alternating", w, "id", 3, "x")).toBe(storyText("alternating", w, "id", 3, "x"));
    const seen = new Set<string>();
    for (let i = 0; i < 40; i++) seen.add(storyText("alternating", w, "id", i, "x"));
    expect(seen.size).toBeGreaterThan(8);
    for (const k of ["winning-try", "winning-kick", "stand"] as const) {
      const t = storyText(k, w, "id", 1);
      expect(t).toContain("Abuja Wardens");
      expect(t).toContain("24-21");
    }
    for (const k of ["supplier", "finisher", "alternating", "together"] as const) expect(storyText(k, w, "id", 2)).toContain("Ada Idowu");
    expect(storyText("replaced", w, "id", 1)).toContain("33");
    expect(storyText("winning-try", { ...w, minute: 40 }, "id", 1)).toContain("last minute");
    for (const k of ["scoring-run", "drought", "unbeaten", "losing"] as const) expect(storyText(k, w, "id", 2)).toContain("Abuja Wardens");
    for (const k of ["duel", "nemesis", "clash", "top-scorer", "runner-up-scorer"] as const) {
      const t = storyText(k, w, "id", 2);
      expect(t).toContain("Ada Idowu");
      expect(t).toContain("Abuja Wardens");
    }
    for (const detail of ["passed", "left"]) expect(storyText("return", { ...w, detail, n: 2 }, "id", 3)).toContain("Kano Ironclads");
    for (const detail of ["1-1", "1-0", "0-1", "0-0"]) {
      const t = storyText("reunion", { ...w, detail }, "id", 3);
      expect(t).toContain("Ada Idowu");
      expect(t).toContain("24-21");
    }
    for (const detail of ["passed", "left"]) for (const score of ["24-21", "10-10", "3-9"]) for (const n of [0, 2]) expect(storyText("first-meeting", { ...w, detail, score, n }, "id", 5)).toContain(score);
    const all = [3, 5, 8].flatMap((n) => Array.from({ length: 60 }, (_, i) => ["clash", "duel", "nemesis"].map((k) => storyText(k as never, { ...w, n }, "id", i)).join(" "))).join(" ");
    expect(all).not.toMatch(/bad blood|hate|feud/i);
  });

  it("builds chronicle lines and an alongside list from entries", () => {
    const r = { ...newEraProspect({ id: "f", name: "Hauwa Salisu", role: "Winger", age: 17 } as never, "A", 2), status: "playing" as const };
    r.chronicle.push({ season: 3, key: "alternating", clubId: "A", otherId: "m", otherName: "Ada Idowu", value: 5 }, { season: 4, key: "supplier", clubId: "A", otherId: "m", otherName: "Ada Idowu", value: 3 }, { season: 3, key: "winning-try", clubId: "A", vsId: "B", score: "9-7", minute: 38, value: 2 });
    const lines = chronicleLines(r, (id) => `Club ${id}`);
    expect(lines.map((x) => x.slice(0, 2))).toEqual(["S2", "S3", "S3", "S4"]);
    expect(lines.join("\n")).toContain("Ada Idowu");
    expect(alongside(r)).toEqual([{ id: "m", name: "Ada Idowu", what: expect.arrayContaining([expect.stringContaining("S3"), expect.stringContaining("S4")]) }]);
  });
});

function setBestLineup(s: SeasonState) {
  const t = teamById(s, s.managedId);
  const used = new Set<string>();
  t.lineup = ROLES.map((role) => {
    const p = t.players.filter((x) => !used.has(x.id) && !((x.ban ?? 0) > 0)).sort((a, b) => Number(b.role === role) - Number(a.role === role) || overall(b) - overall(a))[0];
    used.add(p.id);
    return p.id;
  });
}

describe("over a long game", () => {
  it("gives followed players a few story lines, not one every season", () => {
    let s: SeasonState = newGame(11, "ash");
    for (let i = 0; i < 16; i++) {
      while (!isSeasonOver(s)) {
        s = playMatchday(s).state;
        setBestLineup(s);
      }
      s = startNextSeason(s);
      const plan: OffseasonPlan = autoPlan(s);
      const marked = new Set((s.eraProspects ?? []).filter((e) => e.status === "intake").map((e) => e.id));
      for (const id of marked) if (!plan.sign.includes(id)) plan.sign.push(id);
      try { s = completeOffseason(s, plan); } catch { s = completeOffseason(s, autoPlan(s)); }
    }
    let seasons = 0, story = 0;
    for (const e of s.eraProspects ?? []) {
      seasons += e.seasons.length;
      const lines = e.chronicle.filter((c) => STORY_KEYS.has(c.key) && !STRUCTURAL_KEYS.has(c.key)).length;
      story += lines;
      expect(lines).toBeLessThanOrEqual(MAX_STORY_LINES);
    }
    console.log(`story lines ${story} over ${seasons} followed seasons`);
    expect(story).toBeLessThanOrEqual(seasons * 2);
  }, 60000);
});
