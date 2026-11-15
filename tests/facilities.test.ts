import { describe, expect, it } from "vitest";
import { DEFAULT_START_YEAR, ERA_LENGTH, eraIndex, seasonYear, seasonsToNextEra } from "../src/league/calendar";
import { MAX_FACILITY_LEVEL, PROJECT_COST, PROJECT_MATCHDAYS, PROPOSAL_LAPSE_MATCHDAY, academyBonus, recoveryBonus, reducedInjury, trainingSlots, upgradeCost } from "../src/league/facilities";
import { SAVE_VERSION, acceptProposal, autoPlan, completeOffseason, declineProposal, proposalShare, startProject, facilitiesOf, isSeasonOver, migrateSave, newGame, playMatchday, startNextSeason, afterMatch, type SeasonState } from "../src/league/season";

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

const playSeason = (s: SeasonState) => {
  while (!isSeasonOver(s)) s = playMatchday(s).state;
  return s;
};

describe("construction", () => {
  it("is paid up front, takes matchdays, and then adds a level with a news link", () => {
    const s = offseason();
    const before = s.money;
    let b = startProject(s, "training");
    expect(b.money).toBe(before - PROJECT_COST[0]);
    expect(b.project).toMatchObject({ facility: "training", level: 1, remaining: PROJECT_MATCHDAYS[0] });
    expect(facilitiesOf(b).training ?? 0).toBe(0);
    expect(b.news[0].link).toBe("projects");
    const done = completeOffseason(b, autoPlan(b));
    let t = done;
    for (let i = 0; i < PROJECT_MATCHDAYS[0] - 1; i++) t = playMatchday(t).state;
    expect(facilitiesOf(t).training ?? 0).toBe(0);
    expect(t.project?.remaining).toBe(1);
    t = playMatchday(t).state;
    expect(facilitiesOf(t).training).toBe(1);
    expect(t.project).toBeUndefined();
    expect(t.news.some((n) => n.link === "projects" && n.text.includes("Project complete"))).toBe(true);
  });

  it("allows one project at a time, and refuses what you cannot afford or is fully upgraded", () => {
    const s = offseason();
    const b = startProject(s, "medical");
    expect(() => startProject(b, "academy")).toThrow(/already under construction/);
    expect(() => startProject({ ...s, money: 10 }, "medical")).toThrow(/cannot afford/);
    expect(() => startProject({ ...s, facilities: { ash: { academy: MAX_FACILITY_LEVEL } } }, "academy")).toThrow(/fully upgraded/);
  });

  it("does not tick in the offseason, and belongs to the club", () => {
    const s = offseason();
    const b = startProject(s, "academy");
    expect(b.project?.remaining).toBe(PROJECT_MATCHDAYS[0]);
    expect(() => playMatchday(b)).toThrow();
    expect(b.facilities?.bla).toBeUndefined();
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
    const prospects = (lv: number) => {
      const s = playSeason({ ...newGame(5, "ash"), facilities: { ash: { academy: lv } } } as SeasonState);
      return startNextSeason(s).intake!.prospects.filter((p) => !p.genius).map((p) => p.potential ?? 0);
    };
    const [base, up] = [prospects(0), prospects(3)];
    expect(up.reduce((a, b) => a + b, 0)).toBeGreaterThan(base.reduce((a, b) => a + b, 0));
  });
});

describe("genius discovery", () => {
  const found = (lv: number) => {
    let n = 0;
    for (let seed = 1; seed <= 12; seed++) {
      const s = startNextSeason(playSeason({ ...newGame(seed, "ash"), facilities: lv ? { ash: { academy: lv } } : undefined } as SeasonState));
      const g = s.intake!.prospects.filter((p) => p.genius);
      if (g.length) {
        n++;
        expect(g).toHaveLength(1);
        expect(g[0].potential).toBeGreaterThanOrEqual(88);
        expect(s.intake!.prospects).toHaveLength(s.intake!.prospects.length);
        expect(s.news.some((x) => x.text.includes("found a genius"))).toBe(true);
      }
    }
    return n;
  };
  it("only happens with an academy, and sometimes with one", () => {
    expect(found(0)).toBe(0);
    const n = found(3);
    expect(n).toBeGreaterThan(0);
    expect(n).toBeLessThan(12);
  }, 30000);
});

describe("the board's proposals", () => {
  const withProposal = () => {
    for (let seed = 1; seed <= 30; seed++) {
      const s = startNextSeason(playSeason(newGame(seed, "ash")));
      if (s.proposal) return { ...s, offers: undefined } as SeasonState;
    }
    throw new Error("no proposal in 30 seeds");
  };

  it("picks the least developed facility and advances half the cost", () => {
    const s = withProposal();
    expect(proposalShare(s)).toBe(PROJECT_COST[0] / 2);
    expect(s.news.some((n) => n.link === "projects" && n.text.includes("The board proposes"))).toBe(true);
  });

  it("starts the project at half price and takes the advance back at season end", () => {
    const s = withProposal();
    const b = acceptProposal(s);
    expect(b.money).toBe(s.money - PROJECT_COST[0] / 2);
    expect(b.boardLoan).toBe(PROJECT_COST[0] / 2);
    expect(b.proposal).toBeUndefined();
    expect(b.project?.facility).toBe(s.proposal!.facility);
    const plain = { ...s, proposal: undefined } as SeasonState;
    const next = (x: SeasonState) => startNextSeason(playSeason(completeOffseason(x, autoPlan(x))));
    const after = next(b);
    expect(after.boardLoan).toBeUndefined();
    expect(after.news.some((n) => n.text.includes("takes back"))).toBe(true);
    expect(next(plain).news.some((n) => n.text.includes("takes back"))).toBe(false);
  });

  it("can be declined, and lapses after matchday six", () => {
    const s = withProposal();
    expect(declineProposal(s).proposal).toBeUndefined();
    let t = completeOffseason(s, autoPlan(s));
    for (let i = 0; i < PROPOSAL_LAPSE_MATCHDAY - 1; i++) t = playMatchday(t).state;
    expect(t.proposal).toBeDefined();
    t = playMatchday(t).state;
    expect(t.proposal).toBeUndefined();
  });
});
