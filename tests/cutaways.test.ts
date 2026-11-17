import { existsSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { generateTeams } from "../src/league/teams";
import { simulateMatch } from "../src/engine/match";
import { HAIR } from "../src/league/look";
import { ART_HAIR, BEFORE, CHANCE, HEAD_STYLES, LAB_HAIR, STORY, STORY_HEADS } from "../src/cutaways/data";
import { kindsFor } from "../src/cutaways";

const art = (name: string) => existsSync(new URL(`../src/cutaways/art/${name}.webp`, import.meta.url));

describe("illustrated cutaways", () => {
  it("has artwork for every kind, pose and lab hairstyle", () => {
    expect(art("sprite")).toBe(true);
    for (const [kind, spec] of Object.entries(STORY)) {
      for (const pose of kind === "grounding" || kind === "injury" ? [0, 1, 2] : [0]) {
        const hairs = kind === "injury" ? [0, 5, 6, 7, 8, 9] : [0, 1, 2, 3, 4, ...(["grounding", "kickchase", "waist"].includes(kind) ? [5, 6, 7, 8, 9] : [])];
        for (const hair of hairs) expect(art(`${spec.art(pose)}-${hair}`), `${kind} pose ${pose} hair ${hair}`).toBe(true);
      }
    }
  });

  it("maps every game hairstyle to a lab hairstyle", () => {
    expect(LAB_HAIR).toHaveLength(HAIR.length);
    for (const h of LAB_HAIR) expect(h >= 0 && h <= 9).toBe(true);
    expect(ART_HAIR).toHaveLength(10);
    for (const h of ART_HAIR) expect(h >= 0 && h <= 4).toBe(true);
    expect(HEAD_STYLES).toHaveLength(10);
    for (const kind of Object.keys(STORY)) expect(STORY_HEADS).toHaveProperty(kind);
  });

  it("every kind has odds between 0 and 1, and every event kind it picks exists", () => {
    for (const [kind, chance] of Object.entries(CHANCE)) {
      expect(chance).toBeGreaterThan(0);
      expect(chance).toBeLessThanOrEqual(1);
      expect(kind === "bighit" || kind in STORY).toBe(true);
    }
  });

  it("suggests cutaways for real match events and never for plain play", () => {
    const [home, away] = generateTeams(7, "women");
    const seen = new Set<string>();
    for (let i = 0; i < 6; i++) {
      const log = simulateMatch({ id: `c${i}`, seed: 100 + i, season: 1, matchday: 1, home, away, homeTactic: "balanced", awayTactic: "balanced" });
      for (const ev of log.events) {
        const kinds = kindsFor(ev);
        kinds.forEach((k) => seen.add(k));
        if (["halftime", "fulltime", "sub", "talk"].includes(ev.type)) expect(kinds).toEqual([]);
      }
    }
    expect(seen.size).toBeGreaterThan(2);
    for (const k of seen) expect(CHANCE).toHaveProperty(k);
  });

  it("covers interceptions and kicks, and only a kick's own action plays before the scene", () => {
    const base = { sec: 0, step: 0, minute: 1, x0: 50, x1: 60, text: "", key: true, homeScore: 0, awayScore: 0 };
    const kinds = (type: string, variant?: string) => kindsFor({ ...base, type, variant } as never);
    expect(kinds("intercept")).toEqual(["intercept"]);
    expect(kinds("conversion", "good")).toEqual(["goal"]);
    expect(kinds("penalty-miss", "wide")).toEqual(["goalmiss"]);
    expect(kinds("try", "grubber")).toEqual(["kickchase"]);
    expect(kinds("kick", "chip-lost")).toEqual(["kickchase"]);
    expect(kinds("kick", "live")).toEqual([]);
    expect(kinds("kickoff")).toEqual(["huddle", "pass"]);
    expect([...BEFORE]).toEqual(["kickchase"]);
  });
});
