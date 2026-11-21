import { describe, expect, it } from "vitest";
import { SHIELD_WINS, acceptShield, requestText, currentRound, declineShield, legacyReport, managedTie, playShieldRound, requestChance, shieldBlocksSeason, shieldPending, type ShieldState } from "../src/league/shield";
import { SAVE_VERSION, autoPlan, completeOffseason, isSeasonOver, migrateSave, newGame, playMatchday, startNextSeason, type SeasonState } from "../src/league/season";

const built = (seed = 1): SeasonState => ({ ...newGame(seed, "ash"), facilities: { ash: { training: 3, medical: 3, academy: 3 } } });
const playSeason = (s: SeasonState) => {
  while (!isSeasonOver(s)) s = playMatchday(s).state;
  return s;
};
const nextSeason = (s: SeasonState) => {
  s = startNextSeason(s);
  return completeOffseason(s, autoPlan(s));
};
/** Plays seasons until Mrs. Daniel makes the request (certain by the fourth eligible postseason). */
function requested(seed = 1): SeasonState {
  let s = playSeason(built(seed));
  for (let i = 0; i < 4 && s.shield?.status !== "requested"; i++) {
    s = playSeason(nextSeason(declineIfAsked(s)));
  }
  return s;
}
const declineIfAsked = (s: SeasonState) => (s.shield?.status === "requested" ? declineShield(s) : s);
const playOut = (s: SeasonState) => {
  while (shieldPending(s)) s = playShieldRound(s).state;
  return s;
};

describe("founders' shield request", () => {
  it("climbs from 25% to a certainty", () => {
    expect([1, 2, 3, 4, 5, 9].map(requestChance)).toEqual([0.25, 0.5, 0.75, 1, 1, 1]);
  });

  it("never comes while a facility is below level three", () => {
    let s = { ...newGame(1, "ash"), facilities: { ash: { training: 3, medical: 3, academy: 2 } } } as SeasonState;
    for (let i = 0; i < 5; i++) s = playSeason(i ? nextSeason(s) : s);
    expect(s.shield).toBeUndefined();
  });

  it("always comes by the fourth eligible postseason, and declining costs nothing", () => {
    const s = requested();
    expect(s.shield!.status).toBe("requested");
    expect(shieldBlocksSeason(s)).toBe(true);
    expect(() => startNextSeason(s)).toThrow();
    const money = s.money;
    const d = declineShield(s);
    expect(d.shield!.status).toBe("dormant");
    expect(d.shield!.message).toBe("Very well. I'll hold them off for another season.");
    expect(d.money).toBe(money);
    expect(shieldBlocksSeason(d)).toBe(false);
    expect(startNextSeason(d).season).toBe(d.season + 1);
  });
});

describe("founders' shield tournament", () => {
  const s0 = acceptShield(requested());

  it("draws ten clubs: you, four Dominion clubs and five Pinnacle clubs, with two preliminaries", () => {
    const t = s0.shield!.tournament!;
    expect(Object.keys(t.clubs)).toHaveLength(10);
    expect(Object.values(t.clubs).filter((c) => c.league === "pinnacle")).toHaveLength(5);
    expect(s0.shield!.pinnacle).toHaveLength(5);
    expect(t.rounds[0].id).toBe("prelim");
    expect(t.rounds[0].ties).toHaveLength(2);
    // The player is seeded past the preliminary round, and the preliminaries are cross-league.
    expect(t.rounds[0].ties.flatMap((x) => [x.a, x.b])).not.toContain("ash");
    for (const tie of t.rounds[0].ties) expect(t.clubs[tie.a].league).not.toBe(t.clubs[tie.b].league);
    expect(managedTie(s0)).toBeUndefined();
  });

  it("runs prelims, quarter-finals, semi-finals and a final, with no draws", () => {
    let s = s0;
    const rounds: string[] = [];
    while (shieldPending(s)) {
      rounds.push(`${currentRound(s.shield!.tournament!)!.id}:${currentRound(s.shield!.tournament!)!.ties.length}`);
      s = playShieldRound(s).state;
    }
    expect(rounds[0]).toBe("prelim:2");
    expect(rounds.slice(1)).toEqual(["quarter:4", "semi:2", "final:1"]);
    const t = s.shield!.tournament!;
    expect(t.winnerId).toBeTruthy();
    for (const r of t.rounds) for (const x of r.ties) expect([x.a, x.b]).toContain(x.result!.winner);
    const q = t.rounds[1].ties;
    expect(new Set(q.flatMap((x) => [x.a, x.b])).size).toBe(8);
    expect(q.some((x) => x.a === "ash" || x.b === "ash")).toBe(true);
    expect(s.shield!.score.dominion + s.shield!.score.pinnacle).toBe(1);
    expect(shieldBlocksSeason(s)).toBe(s.shield!.status === "lost");
  });

  it("is deterministic, and leaves the league table, squads and fixtures alone", () => {
    const a = playOut(s0);
    const b = playOut(s0);
    expect(a.shield!.tournament!.winnerId).toBe(b.shield!.tournament!.winnerId);
    expect(a.fixtures).toEqual(s0.fixtures);
    expect(a.teams).toEqual(s0.teams);
    expect(a.money).toBe(s0.money);
  });

  it("keeps the campaign in the save and its results across seasons until a league reaches five", () => {
    let s = playOut(s0);
    const seen: ShieldState[] = [];
    for (let i = 0; i < 12 && s.shield!.status === "active"; i++) {
      s = playSeason(nextSeason(s));
      seen.push(s.shield!);
      expect(s.shield!.tournament!.season).toBe(s.season);
      s = playOut(s);
      expect(JSON.parse(JSON.stringify(s)).shield.score).toEqual(s.shield!.score);
    }
    const sh = s.shield!;
    expect(["defended", "lost"]).toContain(sh.status);
    expect(Math.max(sh.score.dominion, sh.score.pinnacle)).toBe(SHIELD_WINS);
    expect(sh.campaign).toHaveLength(sh.score.dominion + sh.score.pinnacle);
    expect(sh.pinnacle.map((c) => c.team.name)).toEqual(s0.shield!.pinnacle.map((c) => c.team.name));
    expect(sh.pinnacle.reduce((t, c) => t + c.record.shields, 0)).toBe(sh.score.pinnacle);
    expect(legacyReport(s).seasons).toBeGreaterThan(0);
    if (sh.status === "defended") {
      // Dominion's win ends the threat, not the career.
      expect(shieldBlocksSeason(s)).toBe(false);
      const n = nextSeason(s);
      expect(playSeason(n).shield!.tournament!.season).toBe(s.season);
    } else {
      expect(() => startNextSeason(s)).toThrow();
    }
  }, 120000);
});

describe("save migration", () => {
  it("upgrades a version 10 save with no campaign", () => {
    const old = { ...newGame(1, "ash"), version: 10 } as SeasonState;
    const up = migrateSave(old)!;
    expect(up.version).toBe(SAVE_VERSION);
    expect(up.shield).toBeUndefined();
  });
});

describe("women's league wording", () => {
  it("adds a line backing the women's league to the request, and not to the men's", () => {
    const men = requestText(newGame(1, "ash", "men")).join(" ");
    const women = requestText(newGame(1, "ash", "women")).join(" ");
    expect(women).toContain("our women");
    expect(men).not.toContain("women");
  });
});
