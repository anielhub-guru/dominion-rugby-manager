import { describe, expect, it } from "vitest";
import { ESSENTIAL, cuesFor, tensionAt, type CueName } from "../src/audio/cues";
import { StadiumAudio } from "../src/audio/engine";
import { generateTeams } from "../src/league/teams";
import { simulateMatch } from "../src/engine/match";
import type { EventType } from "../src/engine/types";

const names = (type: EventType, phase: "start" | "result", team?: 0 | 1, favour?: 0 | 1, variant?: string) => cuesFor({ type, team, variant }, phase, favour).map((c) => c.name);

describe("stadium sound cues", () => {
  it("cheers our try and groans at theirs", () => {
    expect(names("try", "result", 0, 0)).toContain("roar");
    expect(names("try", "result", 1, 0)).toContain("groan");
    expect(names("try", "result", 1, 0)).not.toContain("roar");
  });

  it("is neutral about who scored when no side is managed", () => {
    expect(names("try", "result", 1)).toContain("roar");
    expect(names("try", "result", 0)).toContain("roar");
  });

  it("rings the post, then cheers or groans", () => {
    expect(names("conversion-miss", "result", 0, 0, "post")).toEqual(["post", "gasp", "groan"]);
    expect(names("conversion", "result", 0, 0, "post-in")).toContain("post");
    expect(names("penalty-miss", "result", 1, 0, "wide")).toEqual(["cheer"]);
  });

  it("blows the whistle for the match milestones and cards", () => {
    for (const t of ["kickoff", "halftime", "fulltime", "yellow", "red", "penalty", "knock-on", "golden"] as const) {
      expect(names(t, "result", 0).some((n) => n.startsWith("whistle")), t).toBe(true);
    }
  });

  it("gives every kick at goal a boot on the ball", () => {
    for (const t of ["conversion", "conversion-miss", "penalty-goal", "penalty-miss", "drop-goal", "drop-miss"] as const) expect(names(t, "start", 0)).toContain("kick");
  });

  it("has an essential cue at full time and for a try, for fast-forward", () => {
    for (const t of ["fulltime", "try"] as const) expect(names(t, "result", 0, 0).some((n) => ESSENTIAL.has(n as CueName))).toBe(true);
  });

  it("only produces cues with sane timing and level, across a whole simulated match", () => {
    const teams = generateTeams(1, "men");
    const log = simulateMatch({ id: "t", season: 1, matchday: 1, home: teams[0], away: teams[1], homeTactic: "balanced", awayTactic: "attacking", seed: 7 });
    let any = 0;
    for (const ev of log.events) {
      for (const phase of ["start", "result"] as const) {
        for (const c of cuesFor(ev, phase, 0)) {
          any++;
          expect(c.at).toBeGreaterThanOrEqual(0);
          expect(c.at).toBeLessThan(4);
          expect(c.level).toBeGreaterThan(0);
          expect(c.level).toBeLessThanOrEqual(1.5);
        }
      }
    }
    expect(any).toBeGreaterThan(10);
  });

  it("measures tension from the ball position", () => {
    expect(tensionAt(0.5)).toBe(0);
    expect(tensionAt(0.7)).toBe(0);
    expect(tensionAt(0.97)).toBeGreaterThanOrEqual(0.89);
    expect(tensionAt(0.03)).toBeCloseTo(tensionAt(0.97));
  });

  it("stays silent and does not throw where there is no Web Audio", () => {
    const a = new StadiumAudio({ derby: true });
    a.start();
    a.setTension(1);
    a.setPaused(true);
    a.play(cuesFor({ type: "try", team: 0, variant: undefined }, "result"));
    a.finish();
    a.dispose();
  });
});
