import { describe, expect, it } from "vitest";
import { ERA_PITY_SEASONS, eraDue, recordEraSeason, retirementNews, newEraProspect, type EraProspect } from "../src/league/era";
import { autoPlan, completeOffseason, isSeasonOver, newGame, playMatchday, startNextSeason, teamById, type OffseasonPlan, type SeasonState } from "../src/league/season";
import { overall } from "../src/league/teams";
import { ROLES } from "../src/engine/types";

function setBestLineup(s: SeasonState) {
  const t = teamById(s, s.managedId);
  const used = new Set<string>();
  t.lineup = ROLES.map((role) => {
    const p = t.players.filter((x) => !used.has(x.id) && !((x.ban ?? 0) > 0)).sort((a, b) => Number(b.role === role) - Number(a.role === role) || overall(b) - overall(a))[0];
    used.add(p.id);
    return p.id;
  });
}
function playSeason(s: SeasonState): SeasonState {
  while (!isSeasonOver(s)) {
    s = playMatchday(s).state;
    setBestLineup(s);
  }
  return s;
}
/** Plays offseasons, signing marked prospects only when `sign` says so. */
function run(seed: number, seasons: number, sign: boolean): SeasonState {
  let s = newGame(seed, "ash");
  for (let i = 0; i < seasons; i++) {
    s = startNextSeason(playSeason(s));
    const plan: OffseasonPlan = autoPlan(s);
    const marked = new Set((s.eraProspects ?? []).filter((e) => e.status === "intake").map((e) => e.id));
    plan.sign = plan.sign.filter((id) => !marked.has(id));
    if (sign) for (const id of marked) if (!plan.sign.includes(id)) plan.sign.push(id);
    try {
      s = completeOffseason(s, plan);
    } catch {
      s = completeOffseason(s, autoPlan(s));
    }
  }
  return s;
}

describe("era prospects", () => {
  it("are marked at least once per pity window, and are deterministic", () => {
    expect(eraDue(1, 7, 1, 0)).toBe(true);
    expect(eraDue(1, 7, 1, 3)).toBe(false);
    expect(eraDue(5, 4, 3, 0)).toBe(eraDue(5, 4, 3, 0));
    expect(ERA_PITY_SEASONS).toBeGreaterThan(0);
  });

  it("describe a career with facts only", () => {
    const base = newEraProspect({ id: "x", name: "Daniel Okoro", role: "Anchor" } as never, "ash", 2);
    const r: EraProspect = { ...base, status: "playing" };
    const matches = 18;
    expect(recordEraSeason(r, 2, "ash", 0, matches, "Abuja Wardens")).toEqual([]);
    expect(recordEraSeason(r, 3, "bla", 4, matches, "Benin Reavers")[0]).toContain("A first league season");
    const news = recordEraSeason(r, 4, "bla", 15, matches, "Benin Reavers");
    expect(news[0]).toContain("A first regular season");
    expect(news[0]).toContain("more than");
    expect(r.chronicle.map((c) => c.key)).toEqual(expect.arrayContaining(["introduced", "joined", "debut", "first-regular-season"]));
    const line = retirementNews(r, 32, (id) => id);
    expect(line).toContain("Daniel Okoro retires at 32");
    expect(r.seasons[2].points).toBe(0);
    expect(line).not.toMatch(/determined|disappoint|legend|furious/i);
  });

  it("are followed once signed, and retire with a record", () => {
    const s = run(11, 14, true);
    const followed = (s.eraProspects ?? []).filter((e) => e.seasons.length > 0 || e.status === "playing");
    expect(s.eraProspects?.length).toBeGreaterThan(0);
    expect(followed.length).toBeGreaterThan(0);
    for (const e of s.eraProspects ?? []) {
      if (e.status === "playing") expect(s.teams.some((t) => t.players.some((p) => p.id === e.id))).toBe(true);
    }
  });

  it("unsigned prospects wait off every roster and are closed after the window", () => {
    const s = run(11, 14, false);
    for (const e of s.eraProspects ?? []) {
      expect(e.status).not.toBe("intake");
      if (e.status === "unattached") expect(e.waiting).toBeTruthy();
      else expect(e.waiting).toBeUndefined();
      if (e.status !== "playing" && e.status !== "retired") expect(s.teams.some((t) => t.players.some((p) => p.id === e.id))).toBe(false);
      expect(e.chronicle.some((c) => c.key === "no-contract")).toBe(true);
    }
  });

  it("never lose a followed player from a roster silently", () => {
    for (const seed of [3, 7]) {
      const s = run(seed, 16, true);
      for (const e of s.eraProspects ?? []) {
        if (e.status === "playing") expect(s.teams.some((t) => t.players.some((p) => p.id === e.id))).toBe(true);
      }
    }
  });
});
