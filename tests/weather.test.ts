import { describe, expect, it } from "vitest";
import { generateTeams } from "../src/league/teams";
import { simulateMatch } from "../src/engine/match";
import { WEATHERS, weatherFor, weatherReport, type WeatherId } from "../src/engine/weather";

const [home, away] = generateTeams(7, "men");
const play = (id: string, seed = 11) => simulateMatch({ id, seed, season: 1, matchday: 1, home, away, homeTactic: "balanced", awayTactic: "balanced" });

/** Match ids that give each kind of weather. */
const idFor = (want: WeatherId) => {
  for (let i = 0; i < 5000; i++) if (weatherFor(`w${i}`).id === want) return `w${i}`;
  throw new Error(`no ${want} id`);
};

describe("weather", () => {
  it("is the same for the same match and covers every kind, mostly dry", () => {
    expect(weatherFor("abc")).toEqual(weatherFor("abc"));
    const counts: Record<string, number> = {};
    for (let i = 0; i < 4000; i++) {
      const w = weatherFor(`m${i}`);
      counts[w.id] = (counts[w.id] ?? 0) + 1;
      expect(Math.abs(w.wind)).toBeLessThanOrEqual(1);
    }
    for (const id of Object.keys(WEATHERS)) expect(counts[id], id).toBeGreaterThan(0);
    expect(counts.clear).toBeGreaterThan(counts.rain);
    expect(Object.values(WEATHERS).reduce((n, w) => n + w.odds, 0)).toBeCloseTo(1, 5);
  });

  it("never changes what happens in a match", () => {
    const dry = play(idFor("clear"));
    for (const id of ["drizzle", "rain", "storm"] as const) {
      const wet = play(idFor(id));
      expect(wet.weather?.id).toBe(id);
      expect(wet.homeScore).toBe(dry.homeScore);
      expect(wet.awayScore).toBe(dry.awayScore);
      expect(wet.events.map((e) => [e.type, e.minute, e.player])).toEqual(dry.events.map((e) => [e.type, e.minute, e.player]));
    }
  });

  it("only adds to the commentary when it is wet, and mentions the rain at kick-off", () => {
    const dry = play(idFor("clear"));
    const wet = play(idFor("rain"));
    expect(dry.events[0].text.length).toBeLessThan(wet.events[0].text.length);
    expect(wet.events[0].text.startsWith(dry.events[0].text)).toBe(true);
    const extra = wet.events.filter((e, i) => e.text !== dry.events[i].text);
    expect(extra.length).toBeGreaterThan(1);
    for (const e of extra) expect(e.text.startsWith(dry.events[wet.events.indexOf(e)].text)).toBe(true);
  });

  it("writes a one-line report with the sky, temperature and wind", () => {
    const w = weatherFor(idFor("hot"));
    expect(w.temp).toBeGreaterThanOrEqual(35);
    expect(weatherReport(w)).toContain(`${w.temp}°C`);
    expect(weatherReport(w)).toContain("Hot");
    expect(weatherReport({ id: "clear", wind: 0 })).toBe("⛅ Clear · Calm");
  });
});
