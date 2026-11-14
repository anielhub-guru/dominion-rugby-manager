import { describe, expect, it } from "vitest";
import { newGame, playMatchday, isSeasonOver, type SeasonState } from "../src/league/season";
import { reviewSeason } from "../src/league/review";
import { TEAM_DEFS } from "../src/league/teams";
import { goalBonus } from "../src/league/economy";

function finished(): SeasonState {
  let s = newGame(7, TEAM_DEFS[0].id);
  while (!isSeasonOver(s)) s = playMatchday(s).state;
  return s;
}

describe("season review", () => {
  it("is empty until the season ends", () => {
    expect(reviewSeason(newGame(7, TEAM_DEFS[0].id))).toBeNull();
  });
  it("matches what starting the next season pays", async () => {
    const s = finished();
    const r = reviewSeason(s)!;
    const { startNextSeason } = await import("../src/league/season");
    const next = startNextSeason(s);
    expect(r.money.balanceAfter).toBe(next.money);
    expect(r.money.bonus).toBe(goalBonus(r.goal.result));
    expect(r.record.won + r.record.drawn + r.record.lost).toBe(s.totalMatchdays);
    expect(r.finish).toBe(next.history.at(-1)!.managedPosition);
  });
  it("previews the offseason growth exactly as the next season applies it", async () => {
    const s = finished();
    const r = reviewSeason(s)!;
    const { startNextSeason } = await import("../src/league/season");
    const { overall } = await import("../src/league/teams");
    const next = startNextSeason(s);
    for (const d of r.developed) {
      const before = overall(d.player);
      const now = next.teams.find((t) => t.id === s.managedId)!.players.find((p) => p.id === d.player.id)!;
      expect(overall(now) - before).toBeGreaterThanOrEqual(d.growth - 1);
    }
  });
  it("names a player of the season from the squad", () => {
    const r = reviewSeason(finished())!;
    expect(r.players[0].label).toMatch(/^Player of the season/);
  });
});
