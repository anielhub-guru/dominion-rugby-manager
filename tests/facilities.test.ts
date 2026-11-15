import { describe, expect, it } from "vitest";
import { DEFAULT_START_YEAR, ERA_LENGTH, eraIndex, seasonYear, seasonsToNextEra } from "../src/league/calendar";
import { MAX_FACILITY_LEVEL, PROJECT_COST, academyBonus, recoveryBonus, reducedInjury, trainingSlots, upgradeCost } from "../src/league/facilities";
import { SAVE_VERSION, autoPlan, checkPlan, completeOffseason, facilitiesOf, isSeasonOver, migrateSave, newGame, playMatchday, startNextSeason, teamById, afterMatch, type SeasonState } from "../src/league/season";

function offseason(seed = 1): SeasonState {
  let s = newGame(seed, "ash");
  while (!isSeasonOver(s)) s = playMatchday(s).state;
  s = startNextSeason(s);
  if (s.offers) s = { ...s, offers: undefined };
  return s;
}

describe("calendar", () => {
  it("counts a season as a year from the start year", () => {
    expect(seasonYear(1958, 1)).toBe(1958);
    expect(seasonYear(1958, 11)).toBe(1968);
    expect(newGame(1, "ash").startYear).toBe(DEFAULT_START_YEAR);
    expect(newGame(1, "ash", "men", 1980).startYear).toBe(1980);
  });

  it("starts a new era every ten seasons, with no condition on results", () => {
    expect(ERA_LENGTH).toBe(10);
    expect([1, 10, 11, 20, 21].map(eraIndex)).toEqual([0, 0, 1, 1, 2]);
    expect([1, 9, 10, 11].map(seasonsToNextEra)).toEqual([10, 2, 1, 10]);
  });

  it("upgrades a version 9 save with the default start year", () => {
    const old = { ...newGame(1, "ash"), version: 9 } as Partial<SeasonState>;
    delete old.startYear;
    const up = migrateSave(old as SeasonState)!;
    expect(up.version).toBe(SAVE_VERSION);
    expect(up.startYear).toBe(DEFAULT_START_YEAR);
  });
});

describe("facility effects", () => {
  it("are flat steps from the starter level, and cost more each level", () => {
    expect(trainingSlots({})).toBe(3);
    expect(trainingSlots({ training: 2 })).toBe(5);
    expect(academyBonus({ academy: 3 })).toBe(6);
    expect(reducedInjury(5, { medical: 2 })).toBe(3);
    expect(reducedInjury(2, { medical: 3 })).toBe(1);
    expect(reducedInjury(1, { medical: 3 })).toBe(1);
    expect(recoveryBonus({ medical: 2 })).toBeCloseTo(0.06);
    expect(upgradeCost({}, "training")).toBe(PROJECT_COST[0]);
    expect(upgradeCost({ training: 1 }, "training")).toBe(PROJECT_COST[1]);
    expect(upgradeCost({ training: MAX_FACILITY_LEVEL }, "training")).toBeNull();
    expect(afterMatch({ stamina: 60, tired: 40 }, 1, 0.1)).toBeLessThan(afterMatch({ stamina: 60, tired: 40 }, 1));
  });
});

describe("building in the offseason", () => {
  it("costs money, adds a level, and is announced", () => {
    const s = offseason();
    const plan = { ...autoPlan(s), build: "training" as const };
    const check = checkPlan(s, plan);
    expect(check.ok).toBe(true);
    expect(check.buildCost).toBe(PROJECT_COST[0]);
    expect(check.moneyAfter).toBe(checkPlan(s, autoPlan(s)).moneyAfter - PROJECT_COST[0]);
    const next = completeOffseason(s, plan);
    expect(facilitiesOf(next).training).toBe(1);
    expect(next.money).toBe(check.moneyAfter);
    expect(next.news.some((n) => n.text.includes("Training ground"))).toBe(true);
    expect(facilitiesOf(newGame(1, "ash"))).toEqual({});
  });

  it("is refused when you cannot afford it or it is already fully upgraded", () => {
    const s = offseason();
    expect(checkPlan({ ...s, money: -5000 }, { ...autoPlan(s), build: "medical" }).ok).toBe(false);
    const maxed = { ...s, facilities: { ash: { academy: MAX_FACILITY_LEVEL } } };
    expect(checkPlan(maxed, { ...autoPlan(maxed), build: "academy" }).problems.join(" ")).toContain("fully upgraded");
  });

  it("belongs to the club, so other clubs are unaffected", () => {
    const s = offseason();
    const next = completeOffseason(s, { ...autoPlan(s), build: "academy" });
    expect(next.facilities?.ash?.academy).toBe(1);
    expect(next.facilities?.bla).toBeUndefined();
  });

  it("training ground puts more players into training each matchday", () => {
    const gains = (training: number) => {
      let s = { ...newGame(3, "ash"), facilities: { ash: { training } } } as SeasonState;
      for (let i = 0; i < 4; i++) s = playMatchday(s).state;
      return Object.values(s.trainGains ?? {}).reduce((t, g) => t + Object.values(g).reduce((a, b) => a + (b ?? 0), 0), 0);
    };
    expect(gains(3)).toBeGreaterThan(gains(0));
  });

  it("youth academy raises the prospects on offer", () => {
    const withAcademy = (lv: number) => {
      let s = { ...newGame(5, "ash"), facilities: { ash: { academy: lv } } } as SeasonState;
      while (!isSeasonOver(s)) s = playMatchday(s).state;
      return startNextSeason(s).intake!.prospects.map((p) => p.potential ?? 0);
    };
    const [base, up] = [withAcademy(0), withAcademy(3)];
    expect(up.length).toBe(base.length);
    expect(up.reduce((a, b) => a + b, 0)).toBeGreaterThan(base.reduce((a, b) => a + b, 0));
    expect(teamById(newGame(5, "ash"), "ash")).toBeTruthy();
  });
});
