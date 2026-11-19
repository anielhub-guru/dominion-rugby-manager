import { describe, expect, it } from "vitest";
import { simulateMatch } from "../src/engine/match";
import { hashSeed } from "../src/engine/rng";
import type { MatchEvent, MatchLog } from "../src/engine/types";
import { generateTeams } from "../src/league/teams";
import { closeLedger, decidingScore, longestTurns, momentsIn, recordMatches, type Ledger } from "../src/league/moments";
import { alongside, chronicleLines, newEraProspect } from "../src/league/era";
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
      story += e.chronicle.filter((c) => ["winning-try", "winning-kick", "stand", "supplier", "finisher", "alternating", "together"].includes(c.key)).length;
      expect(e.chronicle.filter((c) => c.otherId || c.vsId).length).toBeLessThanOrEqual(12);
    }
    console.log(`story lines ${story} over ${seasons} followed seasons`);
    expect(story).toBeLessThanOrEqual(seasons * 1.5);
  }, 60000);
});
