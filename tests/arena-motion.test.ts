import { describe, expect, it } from "vitest";
import { simulateMatch } from "../src/engine/match";
import { hashSeed } from "../src/engine/rng";
import { generateTeams } from "../src/league/teams";
import { ArenaView } from "../src/viewer/arena";
import { buildScene } from "../src/viewer/scenes";

const teams = generateTeams(3);

/** Steps a highlight scene without a canvas and reports odd carrier movement. */
function watch(e: Parameters<typeof buildScene>[0]) {
  const sc = buildScene(e)!;
  const v: any = Object.create(ArenaView.prototype);
  v.cam = 0;
  v.rate = () => 1;
  v.load(sc);
  const cid = (sc.beats.find((b) => b.ball.k === "held")!.ball as { by: string }).by;
  let turnedBack = false;
  let offField = false;
  for (let t = 0; t < 15000 && v.sim.t < v.total; t += 16) {
    v.step(16);
    const a = v.sim.agents[cid];
    // The carrier sprinting back the way he came, ball in hand, is the "turns round to get tackled" glitch.
    if (v.sim.holder === cid && a.down <= 0 && a.hx < -0.2 && Math.hypot(a.vx, a.vy) > 1.5) turnedBack = true;
    for (const ag of Object.values(v.sim.agents) as { x: number }[]) if (ag.x > 103 || ag.x < -3) offField = true;
  }
  return { turnedBack, offField };
}

describe("highlight animation movement", () => {
  it("a runner who has beaten the defence never turns back into the tackle, and nobody leaves the field", () => {
    let scenes = 0;
    for (let n = 0; n < 60; n++) {
      const m = simulateMatch({ id: "s", season: 1, matchday: 1, home: teams[n % 8], away: teams[(n + 3) % 8], homeTactic: "balanced", awayTactic: n % 2 ? "attacking" : "territory", seed: hashSeed("sc", n) });
      for (const e of m.events) {
        if (!e.highlight || !["break", "try", "turnover"].includes(e.type)) continue;
        const r = watch(e);
        scenes++;
        expect(r.turnedBack, `${e.type}/${e.variant} in match ${n}: carrier turned back`).toBe(false);
        expect(r.offField, `${e.type}/${e.variant} in match ${n}: left the field`).toBe(false);
      }
    }
    expect(scenes).toBeGreaterThan(50);
  }, 30000);

  it("an out-of-bounds ball stays put until the fetching player gets to it, then is thrown back in", () => {
    let seen = 0;
    for (let n = 0; n < 120 && seen < 6; n++) {
      const m = simulateMatch({ id: "s", season: 1, matchday: 1, home: teams[n % 8], away: teams[(n + 3) % 8], homeTactic: "balanced", awayTactic: n % 2 ? "attacking" : "territory", seed: hashSeed("lo", n) });
      for (const e of m.events) {
        if (!e.highlight || !((e.type === "break" && e.variant === "touch") || (e.type === "kick" && e.variant === "touch"))) continue;
        const sc = buildScene(e)!;
        const v: any = Object.create(ArenaView.prototype);
        v.cam = 0;
        v.rate = () => 1;
        v.load(sc);
        const thrower = (sc.beats.find((b, i) => b.ball.k === "held" && (sc.beats[i - 1]?.ball as { style?: string } | undefined)?.style === "loose")!.ball as { by: string }).by;
        let jumped = false;
        let arrived = false;
        for (let t = 0; t < 20000 && v.sim.t < v.total; t += 16) {
          v.step(16);
          const a = v.sim.agents[thrower];
          const b = v.sim.ball;
          const out = b.y < 0 || b.y > 40;
          if (v.sim.arrivedAt >= 0) arrived = true;
          // While the ball lies out of bounds and the fetcher is still more than 3m away, the ball must not move towards him.
          if (out && v.sim.beat >= 1 && v.sim.arrivedAt < 0 && v.sim.restMs > 0) {
            const d = Math.hypot(a.x - b.x, a.y - b.y);
            if (d > 3) jumped = jumped || Math.hypot(b.x - v.sim.ballFrom.x, b.y - v.sim.ballFrom.y) > 0.5;
          }
        }
        expect(jumped, `${e.type}/${e.variant}: ball moved before the fetcher arrived`).toBe(false);
        expect(arrived, `${e.type}/${e.variant}: fetcher never reached the ball`).toBe(true);
        seen++;
      }
    }
    expect(seen).toBeGreaterThan(0);
  });
});
