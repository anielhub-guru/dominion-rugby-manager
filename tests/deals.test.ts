import { describe, expect, it } from "vitest";
import { MATCH_PAY } from "../src/league/economy";
import { MAX_SPONSOR_DEALS, SPONSOR_LAPSE_MATCHDAY, describeCondition, dealProgress, expectedRank, fanOffer, sponsorOffers, type Deal } from "../src/league/deals";
import { acceptDeal, acceptFanChallenge, acceptOffer, autoPlan, completeOffseason, declineDeal, isSeasonOver, newGame, passFanChallenge, playMatchday, startNextSeason, teamById, type SeasonState } from "../src/league/season";

const playSeason = (s: SeasonState) => {
  while (!isSeasonOver(s)) s = playMatchday(s).state;
  return s;
};

const sponsorDeal = (over: Partial<Deal>): Deal => ({ id: "t1", source: "sponsor", from: "Test Co", cond: { type: "finish", maxPos: 8 }, reward: 1000, penalty: 300, season: 1, status: "active", ...over });

/** A game with sponsor offers, found by trying seeds (offers are not guaranteed every season). */
const withOffers = (n = 1): SeasonState => {
  for (let seed = 1; seed <= 40; seed++) {
    const s = newGame(seed, "ash");
    if ((s.deals?.length ?? 0) >= n) return s;
  }
  throw new Error("no sponsor offers in 40 seeds");
};

describe("sponsor deals", () => {
  it("arrive with a new game and are the same every time for a save", () => {
    const s = withOffers();
    expect(sponsorOffers(s)).toEqual(s.deals);
    for (const d of s.deals!) {
      expect(d.status).toBe("offered");
      expect(d.reward).toBeGreaterThan(0);
      expect(d.penalty).toBe(Math.round((d.reward * 0.3) / 10) * 10);
      expect(describeCondition(d.cond, s).length).toBeGreaterThan(5);
    }
  });

  it("set targets that fit the squad: a playing deal names a player who is not a starter", () => {
    let seen = 0;
    for (let seed = 1; seed <= 60; seed++) {
      const s = newGame(seed, "ash");
      for (const d of s.deals ?? []) {
        if (d.cond.type === "plays") {
          seen++;
          const team = teamById(s, "ash");
          expect(team.lineup).not.toContain(d.cond.playerId);
          expect(team.players.some((p) => p.id === (d.cond as { playerId: string }).playerId)).toBe(true);
        }
        if (d.cond.type === "finish") expect(d.cond.maxPos).toBeGreaterThanOrEqual(1);
      }
    }
    expect(seen).toBeGreaterThan(0);
    expect(expectedRank(newGame(1, "ash"))).toBeGreaterThanOrEqual(1);
  });

  it("can be accepted up to the limit, declined, and lapse when the window closes", () => {
    const s = withOffers();
    const id = s.deals![0].id;
    const acc = acceptDeal(s, id);
    expect(acc.deals!.find((d) => d.id === id)!.status).toBe("active");
    expect(acc.news[0].link).toBe("deals");
    expect(declineDeal(s, id).deals!.some((d) => d.id === id)).toBe(false);
    const full: SeasonState = { ...s, deals: Array.from({ length: MAX_SPONSOR_DEALS + 1 }, (_, i) => sponsorDeal({ id: `x${i}`, status: i < MAX_SPONSOR_DEALS ? "active" : "offered" })) };
    expect(() => acceptDeal(full, `x${MAX_SPONSOR_DEALS}`)).toThrow(/at most/);
    let t = { ...s, deals: [...s.deals!, ...[]] } as SeasonState;
    for (let i = 0; i < SPONSOR_LAPSE_MATCHDAY; i++) t = playMatchday(t).state;
    expect((t.deals ?? []).some((d) => d.status === "offered")).toBe(false);
  });

  it("pay when met and cost a penalty when missed, settled in the end-of-season finances", () => {
    const base = newGame(7, "ash");
    const end = (deals: Deal[]) => startNextSeason(playSeason({ ...base, deals }));
    const none = end([]).money;
    expect(end([sponsorDeal({})]).money).toBe(none + 1000);
    expect(end([sponsorDeal({ cond: { type: "finish", maxPos: 0 } })]).money).toBe(none - 300);
    const after = end([sponsorDeal({})]);
    expect(after.news.some((n) => n.link === "deals" && n.text.includes("deal met"))).toBe(true);
    expect(after.deals?.every((d) => d.status === "offered")).toBe(true);
  });

  it("counts progress as the season goes", () => {
    let s = newGame(3, "ash");
    s = { ...s, deals: [sponsorDeal({ cond: { type: "wins", count: 5 } })] };
    expect(dealProgress(s.deals![0], s).have).toBe(0);
    for (let i = 0; i < 4; i++) s = playMatchday(s).state;
    const p = dealProgress(s.deals![0], s);
    expect(p.need).toBe(5);
    expect(p.have).toBeGreaterThanOrEqual(0);
    expect(p.have).toBeLessThanOrEqual(4);
  });
});

describe("fan challenges", () => {
  const find = (): SeasonState => {
    for (let seed = 1; seed <= 20; seed++) {
      let s = newGame(seed, "ash");
      for (let i = 0; i < 14; i++) {
        if (fanOffer(s)) return s;
        s = playMatchday(s).state;
      }
    }
    throw new Error("no fan challenge found");
  };

  it("come before some matches, are the same for a save, and can be passed", () => {
    const s = find();
    const o = fanOffer(s)!;
    expect(fanOffer(s)).toEqual(o);
    expect(o.source).toBe("fans");
    expect(o.reward).toBeGreaterThanOrEqual(0);
    expect(o.penalty).toBe(0);
    expect(fanOffer(passFanChallenge(s))).toBeNull();
    const taken = acceptFanChallenge(s);
    expect(taken.deals!.some((d) => d.source === "fans" && d.status === "active")).toBe(true);
    expect(fanOffer(taken)).toBeNull();
  });

  it("a met challenge with a gate perk boosts the next match's winnings", () => {
    let s = { ...newGame(4, "ash"), deals: [] } as SeasonState;
    const deal: Deal = { id: "f", source: "fans", from: "The supporters", cond: { type: "noLose" }, reward: 0, gate: 100, penalty: 0, season: 1, matchday: 1, status: "active" };
    s = { ...s, deals: [deal] };
    const next = playMatchday(s).state;
    const m = next.fixtures.find((x) => x.matchday === 1 && (x.homeId === "ash" || x.awayId === "ash"))!;
    const r = m.result!;
    const [pf, pa] = m.homeId === "ash" ? [r.homeScore, r.awayScore] : [r.awayScore, r.homeScore];
    if (pf >= pa) expect(next.gateBoost).toEqual({ season: 1, matchday: 2, extra: 100 });
    else expect(next.gateBoost).toBeUndefined();
  });

  it("pay right after the match when met, and cost nothing when missed", () => {
    for (const cond of [{ type: "noLose" }, { type: "winNext" }] as const) {
      let s = { ...newGame(4, "ash"), deals: [] } as SeasonState;
      const deal: Deal = { id: "f", source: "fans", from: "The supporters", cond, reward: 400, penalty: 0, season: 1, matchday: 1, status: "active" };
      s = { ...s, deals: [deal] };
      const next = playMatchday(s).state;
      const f = next.fixtures.find((x) => x.matchday === 1 && (x.homeId === "ash" || x.awayId === "ash"))!.result!;
      const home = next.fixtures.find((x) => x.matchday === 1 && (x.homeId === "ash" || x.awayId === "ash"))!.homeId === "ash";
      const [pf, pa] = home ? [f.homeScore, f.awayScore] : [f.awayScore, f.homeScore];
      const met = cond.type === "winNext" ? pf > pa : pf >= pa;
      const matchPay = pf > pa ? MATCH_PAY.win : pf === pa ? MATCH_PAY.draw : MATCH_PAY.loss;
      expect(next.money).toBe(s.money + matchPay + (met ? 400 : 0));
      expect(next.deals ?? []).toHaveLength(0);
      expect(next.news.some((n) => n.link === "deals" && n.text.includes("supporters"))).toBe(true);
    }
  });
});

describe("deals and moving clubs", () => {
  it("taking another job drops your deals and brings the new club's own offers", () => {
    let s = newGame(1, "ash");
    for (let season = 1; season <= 14; season++) {
      s = startNextSeason(playSeason({ ...s, deals: [...(s.deals ?? []), sponsorDeal({ id: "old", status: "active" })] }));
      expect((s.deals ?? []).some((d) => d.id === "old")).toBe(false);
      if (s.offers?.length) {
        const moved = acceptOffer(s, s.offers[0].clubId);
        expect(moved.managedId).not.toBe("ash");
        expect(moved.deals?.every((d) => d.status === "offered")).toBe(true);
        expect(sponsorOffers(moved)).toEqual(moved.deals);
        return;
      }
      s = completeOffseason(s, autoPlan(s));
    }
    throw new Error("no job offer in 14 seasons");
  }, 120_000);
});
