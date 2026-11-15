import { describe, expect, it } from "vitest";
import { earnsSquadSlot, wageOf } from "../src/league/economy";
import { MAX_EXTRA_SLOTS, SQUAD_SIZE, acceptOffer, autoPlan, autoSelect, checkPlan, completeOffseason, isSeasonOver, newGame, playMatchday, squadCapacity, startNextSeason, teamById, type SeasonState } from "../src/league/season";
import { reviewSeason } from "../src/league/review";
import { RESERVE_COUNT, overall } from "../src/league/teams";

function playSeason(s: SeasonState): SeasonState {
  while (!isSeasonOver(s)) s = playMatchday(s).state;
  return s;
}

describe("extra squad places", () => {
  it("are earned by winning the league or smashing the goal, and by nothing less", () => {
    expect(earnsSquadSlot(1, "met")).toBe(true);
    expect(earnsSquadSlot(1, "smashed")).toBe(true);
    expect(earnsSquadSlot(4, "smashed")).toBe(true);
    expect(earnsSquadSlot(2, "met")).toBe(false);
    expect(earnsSquadSlot(5, "missed")).toBe(false);
  });

  it("start at none, and capacity is capped", () => {
    expect(squadCapacity({})).toBe(SQUAD_SIZE);
    expect(squadCapacity({ extraSlots: 1 })).toBe(SQUAD_SIZE + 1);
    expect(squadCapacity({ extraSlots: 99 })).toBe(SQUAD_SIZE + MAX_EXTRA_SLOTS);
    expect(newGame(1, "ash").extraSlots).toBeUndefined();
  });

  it("are awarded when the season ends, announced in the review, and never beyond the cap", () => {
    let awarded = 0;
    for (let seed = 1; seed <= 12 && awarded < 2; seed++) {
      let s = newGame(seed, "ash");
      for (let season = 1; season <= 8; season++) {
        s = playSeason(s);
        const review = reviewSeason(s)!;
        const before = s.extraSlots ?? 0;
        s = startNextSeason(s);
        if (s.offers) s = { ...s, offers: undefined };
        expect(s.extraSlots ?? 0).toBeLessThanOrEqual(MAX_EXTRA_SLOTS);
        if (review.squadSlot) {
          expect(s.extraSlots).toBe(before + 1);
          expect(s.news.some((n) => /extra squad place/.test(n.text))).toBe(true);
          awarded++;
        } else {
          expect(s.extraSlots ?? 0).toBe(before);
        }
        s = completeOffseason(s, autoPlan(s));
      }
    }
    expect(awarded).toBeGreaterThan(0);
  }, 120_000);

  /** An offseason with one extra place, reached by playing a season and granting it. */
  function withSlot(): SeasonState {
    let s = playSeason(newGame(4, "ash"));
    s = startNextSeason({ ...s, extraSlots: 1 });
    if (s.offers) s = { ...s, offers: undefined };
    return s;
  }

  it("let the squad hold one more player: ten to eleven is fine, twelve is not", () => {
    const s = withSlot();
    const base = autoPlan(s);
    const team = teamById(s, s.managedId);
    const kept = team.players.length - s.intake!.retiring.length;
    const plan = { ...base };
    expect(checkPlan(s, plan).capacity).toBe(SQUAD_SIZE + 1);
    expect(checkPlan(s, plan).ok).toBe(true);
    // A squad of exactly ten (not filling the extra place) is still allowed.
    const spare = { ...plan, sign: plan.sign.slice(0, Math.max(0, SQUAD_SIZE - kept)) };
    expect(checkPlan(s, spare).size).toBe(SQUAD_SIZE);
    expect(checkPlan(s, spare).ok).toBe(true);
    // One too many is refused with the range in the message.
    const extra = s.intake!.prospects.filter((p) => !plan.sign.includes(p.id));
    const tooMany = { ...plan, sign: [...plan.sign, extra[0].id, extra[1].id] };
    const bad = checkPlan(s, tooMany);
    expect(bad.ok).toBe(false);
    expect(bad.problems.join(" ")).toMatch(new RegExp(`${SQUAD_SIZE} to ${SQUAD_SIZE + 1}`));
  }, 60000);

  it("are filled by the default plan with the best prospect for the thinnest position", () => {
    const s = withSlot();
    const plan = autoPlan(s);
    expect(checkPlan(s, plan).size).toBe(SQUAD_SIZE + 1);
  }, 60000);

  it("add a reserve, not a sixth starter or a fourth bench player", () => {
    const s = withSlot();
    const done = completeOffseason(s, autoPlan(s));
    const team = teamById(done, done.managedId);
    expect(team.players).toHaveLength(SQUAD_SIZE + 1);
    expect(team.reserves).toHaveLength(RESERVE_COUNT + 1);
    expect(team.lineup).toHaveLength(5);
    const bench = team.players.filter((p) => !team.lineup.includes(p.id) && !team.reserves!.includes(p.id));
    expect(bench).toHaveLength(3);
    const picked = autoSelect(team);
    expect(picked.reserves).toHaveLength(RESERVE_COUNT + 1);
  }, 60000);

  it("a bigger squad costs more in wages", () => {
    const s = withSlot();
    const full = checkPlan(s, autoPlan(s));
    const wages = (roster: typeof full.roster) => roster.reduce((t, p) => t + wageOf(p), 0);
    const without = full.roster.slice().sort((a, b) => overall(b) - overall(a)).slice(0, SQUAD_SIZE);
    expect(full.size).toBe(SQUAD_SIZE + 1);
    expect(wages(full.roster)).toBeGreaterThan(wages(without));
  }, 60000);

  it("stay with the club when you move: the new club has ten and the old club drops back to ten", () => {
    let s = newGame(11, "ash");
    let moved = false;
    for (let i = 0; i < 30 && !moved; i++) {
      s = startNextSeason(playSeason(s));
      if (s.offers?.length) {
        s = completeOffseasonKeepingOffers(s);
        moved = true;
        break;
      }
      s = completeOffseason({ ...s, extraSlots: 1 }, autoPlan({ ...s, extraSlots: 1 }));
    }
    expect(moved).toBe(true);
  }, 120_000);

  function completeOffseasonKeepingOffers(s: SeasonState): SeasonState {
    const oldId = s.managedId;
    // Give the club you are leaving an extra player first, as an earned slot would have.
    const withExtra: SeasonState = { ...s, extraSlots: 1 };
    const filled = autoPlan(withExtra);
    const afterPlan = completeOffseason({ ...withExtra, offers: undefined }, filled);
    expect(teamById(afterPlan, oldId).players).toHaveLength(SQUAD_SIZE + 1);
    const again = { ...afterPlan, offers: s.offers, intake: undefined };
    const moved = acceptOffer(again as SeasonState, s.offers![0].clubId);
    expect(moved.extraSlots).toBeUndefined();
    expect(teamById(moved, oldId).players).toHaveLength(SQUAD_SIZE);
    expect(teamById(moved, moved.managedId).players).toHaveLength(SQUAD_SIZE);
    for (const t of moved.teams) {
      expect(t.players).toHaveLength(SQUAD_SIZE);
      expect(t.lineup.every((id) => t.players.some((p) => p.id === id))).toBe(true);
      expect((t.reserves ?? []).every((id) => t.players.some((p) => p.id === id))).toBe(true);
    }
    return moved;
  }
});
