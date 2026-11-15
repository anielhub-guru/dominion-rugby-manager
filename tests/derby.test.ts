import { describe, expect, it } from "vitest";
import { DERBY, DerbyTalk } from "../src/engine/derby";
import { simulateMatch } from "../src/engine/match";
import type { MatchLog } from "../src/engine/types";
import { autoPlan, buildSim, completeOffseason, isSeasonOver, newGame, playMatchday, startNextSeason, type SeasonState } from "../src/league/season";
import { generateTeams, teamRating } from "../src/league/teams";
import { rivalOf } from "../src/league/rivals";

const teams = generateTeams(5, "men");
const ranked = [...teams].sort((a, b) => teamRating(b) - teamRating(a));
const strong = ranked[0];
const weak = ranked[ranked.length - 1];

function run(n: number, derby: boolean): MatchLog[] {
  const out: MatchLog[] = [];
  for (let i = 0; i < n; i++) {
    const [home, away] = i % 2 ? [strong, weak] : [weak, strong];
    out.push(simulateMatch({ id: `d${i}`, seed: 900 + i, season: 1, matchday: 1, home, away, homeTactic: "balanced", awayTactic: "balanced", ...(derby ? { derby: true } : {}) }));
  }
  return out;
}
const marginFor = (l: MatchLog) => (l.homeId === strong.id ? l.homeScore - l.awayScore : l.awayScore - l.homeScore);
const cards = (ls: MatchLog[]) => ls.reduce((t, l) => t + l.stats[0].yellows! + l.stats[1].yellows! + l.stats[0].reds! + l.stats[1].reds!, 0);

describe("derbies", () => {
  const normal = run(400, false);
  const derby = run(400, true);

  it("are marked on the match log, and only when asked for", () => {
    expect(derby.every((l) => l.derby === true)).toBe(true);
    expect(normal.every((l) => l.derby === undefined)).toBe(true);
  });

  it("shrink the gap between a strong side and a weak one, so form counts for less", () => {
    const avg = (ls: MatchLog[]) => ls.reduce((t, l) => t + marginFor(l), 0) / ls.length;
    expect(avg(normal)).toBeGreaterThan(0); // the strong side is favoured either way
    expect(avg(derby)).toBeGreaterThan(0);
    expect(avg(derby)).toBeLessThan(avg(normal));
    expect(DERBY.gap).toBeLessThan(1);
  });

  it("make cards more likely", () => {
    expect(DERBY.card).toBeGreaterThan(1);
    expect(cards(derby)).toBeGreaterThan(cards(normal));
  });

  it("lift the underdog: the weaker side wins more often", () => {
    const upsets = (ls: MatchLog[]) => ls.filter((l) => marginFor(l) < 0).length;
    expect(upsets(derby)).toBeGreaterThan(upsets(normal));
  });

  it("add derby remarks to the commentary, and none when it is not a derby", () => {
    const derbyLines = new Set(["The crowd are on their feet", "Tempers are running high", "no love lost", "A proper derby"]);
    const said = (ls: MatchLog[]) => ls.flatMap((l) => l.events).filter((e) => [...derbyLines].some((p) => e.text.includes(p)) || /derby/i.test(e.text)).length;
    expect(said(derby)).toBeGreaterThan(10);
    expect(said(normal)).toBe(0);
    expect(new DerbyTalk(false, 1).remark("try")).toBe("");
  });
});

describe("derbies in a season", () => {
  it("are the managed club's matches against its rival, and nobody else's", () => {
    // Two seasons of meetings, so one club has become the rival.
    let s: SeasonState = newGame(11, "ash");
    while (!isSeasonOver(s)) s = playMatchday(s).state;
    s = startNextSeason(s);
    if (s.offers) s = { ...s, offers: undefined };
    s = completeOffseason(s, autoPlan(s));
    while (!isSeasonOver(s)) s = playMatchday(s).state;
    s = { ...s, matchday: 1 };
    const rival = rivalOf(s.rivalry, "ash");
    expect(rival).toBeDefined();
    for (const f of s.fixtures.filter((x) => x.matchday === 1)) {
      const sim = buildSim(s, f);
      const isDerby = (f.homeId === "ash" && f.awayId === rival) || (f.awayId === "ash" && f.homeId === rival);
      expect(sim.derby).toBe(isDerby);
    }
    const fx = { id: "z", matchday: 1, homeId: "ash", awayId: rival! };
    expect(buildSim(s, fx).derby).toBe(true);
    expect(buildSim(s, { id: "z2", matchday: 1, homeId: "ash", awayId: teams.find((t) => t.id !== "ash" && t.id !== rival)!.id }).derby).toBe(false);
  }, 60000);
});
