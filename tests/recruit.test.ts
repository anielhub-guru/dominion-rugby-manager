import { describe, expect, it } from "vitest";
import { autoPlan, newGame, playMatchday, isSeasonOver, startNextSeason, teamById, checkPlan } from "../src/league/season";
import { adviseRecruitment } from "../src/league/recruit";
import { TEAM_DEFS } from "../src/league/teams";

function offseason() {
  let s = newGame(11, TEAM_DEFS[0].id);
  while (!isSeasonOver(s)) s = playMatchday(s).state;
  return startNextSeason(s);
}

describe("recruitment advice", () => {
  it("only recommends people on offer, never twice, and never someone already in the plan", () => {
    const s = offseason();
    const plan = { sell: [], sign: [], buy: [] };
    const advice = adviseRecruitment(checkPlan(s, plan).roster, s.intake!, plan, s.money);
    const ids = advice.recommendations.map((r) => r.player.id);
    const onOffer = new Set([...s.intake!.prospects.map((p) => p.id), ...s.intake!.market.map((l) => l.player.id)]);
    expect(new Set(ids).size).toBe(ids.length);
    ids.forEach((id) => expect(onOffer.has(id)).toBe(true));
    const next = { ...plan, sign: ids.slice(0, 1) };
    const again = adviseRecruitment(checkPlan(s, next).roster, s.intake!, next, s.money);
    expect(again.recommendations.map((r) => r.player.id)).not.toContain(ids[0]);
  });
  it("never leaks a prospect's true potential", () => {
    const s = offseason();
    const plan = autoPlan(s);
    const advice = adviseRecruitment(checkPlan(s, plan).roster, s.intake!, plan, s.money);
    for (const r of advice.recommendations) if (r.source === "market") expect(r.player.potential).toBeUndefined();
    expect(teamById(s, s.managedId)).toBeTruthy();
  });
});
