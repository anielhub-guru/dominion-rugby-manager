import type { Player, Role } from "../engine/types";
import { ROLES } from "../engine/types";
import { playerValue, teenSalePrice } from "./economy";
import type { Intake, OffseasonPlan } from "./season";
import { overall } from "./teams";

export interface Recommendation {
  player: Player;
  source: "youth" | "market";
  role: Role;
  /** Asking price for a listed player, or the sale you give up by signing a prospect. */
  cost: number;
  headline: string;
  detail: string;
  /** "Fair", "cheap" or "dear" against what the scouts reckon the player is worth. Listed players only. */
  price?: "cheap" | "fair" | "dear";
}

export interface Advice {
  recommendations: Recommendation[];
  /** A listing to be wary of, if there is one. */
  warning?: string;
  /** Said when nothing needs fixing. */
  settled?: string;
}

/** ₦1m of cost counts against a candidate like this many rating points. */
const COST_WEIGHT = 1.5;

const fmt = (k: number) => (k >= 1000 ? `₦${(k / 1000).toFixed(1)}m` : `₦${k}k`);

/**
 * Who to look at, given the squad as it would be after the current plan. Works only from what a manager can
 * see: current ratings and the scouting estimate of potential, never the true potential of anyone not yet signed.
 */
export function adviseRecruitment(roster: Player[], intake: Intake, plan: OffseasonPlan, money: number): Advice {
  const best = (role: Role) => roster.filter((p) => p.role === role).sort((a, b) => overall(b) - overall(a))[0];
  const topFive = [...roster].sort((a, b) => overall(b) - overall(a)).slice(0, 5);
  const level = topFive.length ? topFive.reduce((t, p) => t + overall(p), 0) / topFive.length : 60;

  const needs = ROLES.map((role) => {
    const incumbent = best(role);
    const score = !incumbent ? 100 : level - overall(incumbent) + (incumbent.age >= 31 ? 4 : 0);
    return { role, incumbent, score };
  }).filter((n) => n.score > 3).sort((a, b) => b.score - a.score);

  const picked = new Set([...plan.sign, ...plan.buy]);
  const cands = [
    ...intake.prospects.filter((p) => !picked.has(p.id)).map((player) => ({ player, source: "youth" as const, cost: teenSalePrice(player) })),
    ...intake.market.filter((l) => !picked.has(l.player.id)).map((l) => ({ player: l.player, source: "market" as const, cost: l.price })),
  ];
  const pot = (p: Player) => p.scouted ?? p.potential ?? overall(p);
  const score = (c: (typeof cands)[number]) => overall(c.player) + (c.player.age <= 24 ? 0.5 : 0.15) * Math.max(0, pot(c.player) - overall(c.player)) - (c.cost / 1000) * COST_WEIGHT;
  const affordable = (c: (typeof cands)[number]) => c.source === "youth" || c.cost <= money;

  const recommendations: Recommendation[] = [];
  const used = new Set<string>();
  const describe = (c: (typeof cands)[number], role: Role, incumbent: Player | undefined): Recommendation => {
    const p = c.player;
    const ovr = overall(p);
    const gap = incumbent ? ovr - overall(incumbent) : 0;
    const stars = pot(p);
    if (c.source === "youth") {
      return { player: p, source: "youth", role, cost: c.cost, headline: `${p.name}, ${role}, ${p.age}`, detail: `Rated ${ovr} now, scouts see up to ${stars}. ${incumbent ? (gap > 0 ? `Already ahead of ${incumbent.name}.` : `Behind ${incumbent.name} (${overall(incumbent)}) for now.`) : "Fills the gap at once."} Signing costs the ${fmt(c.cost)} sale.` };
    }
    const est = playerValue(p, stars);
    const ratio = c.cost / Math.max(1, est);
    const price = ratio < 0.9 ? "cheap" : ratio > 1.25 ? "dear" : "fair";
    return { player: p, source: "market", role, cost: c.cost, price, headline: `${p.name}, ${role}, ${p.age}`, detail: `Rated ${ovr}${incumbent ? `, ${gap >= 0 ? `${gap} better than` : `${-gap} short of`} ${incumbent.name}` : ""}. Asking ${fmt(c.cost)}: ${price === "cheap" ? "scouts think that is cheap" : price === "dear" ? "scouts think that is steep" : "about what scouts expect"}.` };
  };

  for (const n of needs.slice(0, 3)) {
    const pick = cands.filter((c) => c.player.role === n.role && !used.has(c.player.id) && affordable(c)).sort((a, b) => score(b) - score(a))[0];
    if (!pick) continue;
    used.add(pick.player.id);
    const r = describe(pick, n.role, n.incumbent);
    r.headline = n.incumbent ? `${n.role} is your weak spot: ${r.headline}` : `No ${n.role}: ${r.headline}`;
    recommendations.push(r);
  }
  // With nothing pressing, look for outright upgrades that are not overpriced.
  if (!recommendations.length) {
    const ups = cands
      .filter((c) => c.source === "market" && affordable(c) && overall(c.player) > overall(best(c.player.role) ?? c.player) + 3)
      .sort((a, b) => score(b) - score(a))
      .slice(0, 2);
    for (const c of ups) recommendations.push(describe(c, c.player.role, best(c.player.role)));
  }

  // The listing that looks worst against its scouted value.
  const trap = intake.market
    .filter((l) => !picked.has(l.player.id))
    .map((l) => ({ l, ratio: l.price / Math.max(1, playerValue(l.player, pot(l.player))) }))
    .filter((x) => x.ratio > 1.4 && x.l.price >= 600)
    .sort((a, b) => b.ratio - a.ratio)[0];
  const warning = trap ? `${trap.l.player.name} (${trap.l.player.role}, ${trap.l.player.age}) is listed at ${fmt(trap.l.price)}, well above what scouts think the player is worth.` : undefined;
  return { recommendations, ...(warning ? { warning } : {}), ...(!recommendations.length ? { settled: "No weak spot in the squad. Only buy if someone is a clear step up." } : {}) };
}
