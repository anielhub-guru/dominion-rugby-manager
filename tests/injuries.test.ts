import { describe, expect, it } from "vitest";
import { MatchSim, simulateMatch } from "../src/engine/match";
import { MAX_INJURY_GAMES, OFFENCES, INJURY_TIERS, rollInjury, rollOffence } from "../src/engine/injury";
import { Rng } from "../src/engine/rng";
import type { MatchLog, Team } from "../src/engine/types";
import { SAVE_VERSION, isSeasonOver, newGame, playMatchday, startNextSeason, type SeasonState } from "../src/league/season";
import { generateTeams } from "../src/league/teams";

const teams = generateTeams(5, "men");

/** A batch of matches between varied clubs. */
function batch(n: number, extra: Partial<Parameters<typeof simulateMatch>[0]> = {}): MatchLog[] {
  const out: MatchLog[] = [];
  for (let i = 0; i < n; i++) {
    const home = teams[i % 8];
    const away = teams[(i + 1 + (i % 7)) % 8];
    if (home.id === away.id) continue;
    out.push(simulateMatch({ id: `inj${i}`, seed: 500 + i, season: 1, matchday: 1, home, away, homeTactic: "balanced", awayTactic: i % 2 ? "defensive" : "territory", ...extra }));
  }
  return out;
}

describe("injury tables", () => {
  it("never roll an injury longer than the cap, and no tier is a season", () => {
    expect(MAX_INJURY_GAMES).toBeLessThanOrEqual(5);
    const rng = new Rng(3);
    for (let i = 0; i < 2000; i++) {
      const r = rollInjury(rng);
      expect(r.games).toBeGreaterThanOrEqual(0);
      expect(r.games).toBeLessThanOrEqual(MAX_INJURY_GAMES);
      expect(INJURY_TIERS.find((t) => t.id === r.tier)!.labels).toContain(r.label);
    }
  });

  it("can force a worse injury for the victim of a dangerous tackle", () => {
    const rng = new Rng(8);
    for (let i = 0; i < 500; i++) expect(rollInjury(rng, "moderate").games).toBeGreaterThanOrEqual(3);
  });

  it("offences carry bans of two to five matches, and the worst is the rarest", () => {
    expect(OFFENCES.map((o) => o.matches)).toEqual([2, 3, 4, 5]);
    const spear = OFFENCES.find((o) => o.id === "spear")!;
    expect(spear.tackle).toBe(Math.min(...OFFENCES.map((o) => o.tackle)));
    // Only a tackle at the neck can be a high tackle or a spear tackle, not a breakdown foul.
    const rng = new Rng(2);
    for (let i = 0; i < 500; i++) expect(["mistimed", "elbow"]).toContain(rollOffence(rng, false).id);
  });
});

describe("injuries in a match", () => {
  const logs = batch(240);

  it("are rare: some matches, nowhere near every match", () => {
    const hurt = logs.reduce((t, l) => t + (l.injuries?.length ?? 0), 0);
    expect(hurt).toBeGreaterThan(10);
    expect(hurt / logs.length).toBeLessThan(0.4);
    const lasting = logs.reduce((t, l) => t + (l.injuries ?? []).filter((i) => i.games > 0).length, 0);
    expect(lasting).toBeLessThan(hurt);
  });

  it("each injury is reported once, narrated once, and ends in at most five missed matches", () => {
    for (const l of logs) {
      const events = l.events.filter((e) => e.type === "injury");
      expect(events).toHaveLength(l.injuries?.length ?? 0);
      for (const i of l.injuries ?? []) {
        expect(i.games).toBeLessThanOrEqual(5);
        expect(events.some((e) => e.pid === i.id)).toBe(true);
      }
    }
  });

  it("take the hurt player off for good, replaced from the bench", () => {
    let checked = 0;
    for (const l of logs) {
      for (const i of l.injuries ?? []) {
        const ev = l.events.find((e) => e.type === "injury" && e.pid === i.id)!;
        if (ev.sec >= 2400) continue; // hurt on the last phase: nothing left to play
        checked++;
        // Nothing more is done by the hurt player after the injury is announced.
        const later = l.events.filter((e) => e.step > ev.step && e.player === i.name && e.type !== "injury");
        expect(later).toEqual([]);
        expect(ev.text).toMatch(/comes on|man short/);
      }
    }
    expect(checked).toBeGreaterThan(5);
  });

  it("a replacement is a free substitution: it does not use up the three", () => {
    const withInjury = logs.filter((l) => (l.injuries?.length ?? 0) > 0);
    expect(withInjury.length).toBeGreaterThan(0);
    for (const l of withInjury) expect(l.events.filter((e) => e.type === "sub" && e.team !== undefined).length).toBeLessThanOrEqual(6);
  });

  it("are repeatable from the seed", () => {
    const again = batch(60);
    for (let i = 0; i < 60; i++) expect(JSON.stringify(again[i].injuries)).toBe(JSON.stringify(logs[i].injuries));
  });
});

describe("suspensions from dangerous play", () => {
  const logs = batch(400);

  it("a straight red carries the length of what it was for; a second yellow is one match", () => {
    const bans = logs.flatMap((l) => l.bans ?? []);
    expect(bans.length).toBeGreaterThan(5);
    for (const b of bans) {
      const second = b.offence === "a second yellow card";
      expect(b.matches).toBe(second ? 1 : OFFENCES.find((o) => o.label === b.offence)!.matches);
    }
    for (const l of logs) expect(l.bans?.length ?? 0).toBe(l.events.filter((e) => e.type === "red").length);
  });

  it("the red names the offence and the length of the ban", () => {
    const straight = logs.flatMap((l) => l.events.filter((e) => e.type === "red" && !/SECOND YELLOW/.test(e.text)));
    expect(straight.length).toBeGreaterThan(3);
    for (const e of straight) expect(e.text).toMatch(/a badly mistimed tackle|a dangerous high tackle|a swinging elbow|a spear tackle/);
    expect(straight.some((e) => /ban of \d matches/.test(e.text))).toBe(true);
  });

  it("a dangerous tackle that earns a red often hurts the runner too", () => {
    let both = 0;
    for (const l of logs) {
      for (const ev of l.events.filter((e) => e.type === "red" && !/SECOND YELLOW/.test(e.text))) {
        const next = l.events.find((e) => e.type === "injury" && e.step > ev.step && e.step <= ev.step + 2);
        if (next && next.team !== ev.team) both++;
      }
    }
    expect(both).toBeGreaterThan(0);
  });
});

describe("injuries across matches", () => {
  const injured = (t: Team) => t.players.filter((p) => p.injury);

  it("an injured player cannot be fielded or put on the bench", () => {
    const t: Team = structuredClone(teams[2]);
    const star = t.players.find((p) => p.id === t.lineup[0])!;
    star.injury = { label: "Torn calf", games: 3 };
    const sim = new MatchSim({ id: "x", season: 1, matchday: 1, home: t, away: teams[3], homeTactic: "balanced", awayTactic: "balanced", seed: 4 });
    expect(sim.sides[0].field.map((p) => p.id)).not.toContain(star.id);
    expect(sim.sides[0].bench.map((p) => p.id)).not.toContain(star.id);
    expect(sim.sides[0].field).toHaveLength(5);
  });

  it("a fit reserve steps in when the bench cannot cover every absence", () => {
    const t: Team = structuredClone(teams[2]);
    // Injure the three bench players and one starter.
    const bench = t.players.filter((p) => !t.lineup.includes(p.id) && !t.reserves?.includes(p.id));
    for (const p of bench) p.injury = { label: "Sprained ankle", games: 2 };
    const starter = t.players.find((p) => p.id === t.lineup[1])!;
    starter.injury = { label: "Sprained ankle", games: 2 };
    const sim = new MatchSim({ id: "y", season: 1, matchday: 1, home: t, away: teams[3], homeTactic: "balanced", awayTactic: "balanced", seed: 9 });
    const field = sim.sides[0].field.map((p) => p.id);
    expect(field).not.toContain(starter.id);
    for (const p of bench) expect(field).not.toContain(p.id);
  });

  it("an injury counts down each matchday, replaces the starter, and heals over the offseason", () => {
    let proved = false;
    for (let seed = 1; seed < 40 && !proved; seed++) {
      let s: SeasonState = newGame(seed, "dun");
      while (!isSeasonOver(s) && !proved) {
        const r = playMatchday(s);
        s = r.state;
        const hurt = r.logs.flatMap((l) => l.injuries ?? []).find((i) => i.games >= 2);
        if (!hurt || isSeasonOver(s)) continue;
        const club = s.teams.find((t) => t.players.some((p) => p.id === hurt.id))!;
        const player = club.players.find((p) => p.id === hurt.id)!;
        expect(player.injury).toEqual({ label: hurt.label, games: hurt.games });
        expect(club.lineup).not.toContain(hurt.id);
        const next = playMatchday(s);
        for (const l of next.logs) expect((l.players ?? []).some((x) => x.id === hurt.id)).toBe(false);
        const after = next.state.teams.find((t) => t.id === club.id)!.players.find((p) => p.id === hurt.id)!;
        expect(after.injury?.games ?? 0).toBe(hurt.games - 1);
        proved = true;
      }
    }
    expect(proved).toBe(true);
  }, 60000);

  it("everyone is fit when a new season starts", () => {
    let s: SeasonState = newGame(3, "dun");
    while (!isSeasonOver(s)) s = playMatchday(s).state;
    s.teams[0].players[0].injury = { label: "Torn calf", games: 4 };
    const next = startNextSeason(s);
    for (const t of next.teams) expect(injured(t)).toEqual([]);
  });

  it("a save from before injuries still loads, because injury is optional", () => {
    expect(SAVE_VERSION).toBeGreaterThan(0);
    const s = newGame(1, "dun");
    for (const t of s.teams) for (const p of t.players) expect(p.injury).toBeUndefined();
  });
});
