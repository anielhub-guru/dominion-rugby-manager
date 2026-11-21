import { describe, expect, it } from "vitest";
import { GOLDEN_PHASES, PHASES, simulateMatch } from "../src/engine/match";
import { hashSeed } from "../src/engine/rng";
import { generateTeams } from "../src/league/teams";

const teams = generateTeams(21);
const run = (n: number, goldenPoint: boolean) =>
  simulateMatch({ id: "g", season: 1, matchday: 0, home: teams[0], away: teams[1], homeTactic: "defensive", awayTactic: "defensive", seed: hashSeed("golden", n), goldenPoint });

describe("golden point", () => {
  it("is sudden death: a level knockout is played on until a player scores, with real events", () => {
    let seen = 0;
    for (let n = 0; n < 3000 && seen < 2; n++) {
      const plain = run(n, false);
      if (plain.homeScore !== plain.awayScore || plain.homeTries !== plain.awayTries) continue;
      const m = run(n, true);
      seen++;
      const i = m.events.findIndex((e) => e.type === "golden");
      expect(i).toBeGreaterThan(0);
      expect(m.goldenPoint).toBe(true);
      if (m.homeScore === m.awayScore) continue; // rare: nobody scored in the whole period, the tie falls back to a kick
      const after = m.events.slice(i + 1);
      expect(after.some((e) => ["try", "penalty-goal", "drop-goal"].includes(e.type))).toBe(true);
      expect(m.events.at(-1)!.type).toBe("fulltime");
      expect(m.events.at(-1)!.sec!).toBeLessThanOrEqual((PHASES + GOLDEN_PHASES) * (2400 / PHASES));
    }
    expect(seen).toBeGreaterThan(0);
  }, 120000);

  it("changes nothing for matches that are not knockouts or are not level", () => {
    for (let n = 0; n < 40; n++) {
      const a = run(n, false);
      const b = run(n, true);
      if (a.homeScore !== a.awayScore || a.homeTries !== a.awayTries) expect(b.events.length).toBe(a.events.length);
      expect(a.events.some((e) => e.type === "golden")).toBe(false);
    }
  });
});
