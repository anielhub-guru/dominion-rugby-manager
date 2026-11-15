import type { Rng } from "./rng";

/**
 * Injuries and dangerous-play offences. Both are rare, and neither can end a season: the longest
 * injury is five matches and the longest ban is five, in a fourteen-match season with a squad of ten.
 * Every roll here uses its own random stream (see MatchSim), so the match itself plays out exactly
 * as it would without them until something actually happens.
 */

export interface InjuryTier {
  id: "knock" | "minor" | "moderate" | "serious";
  /** Matches missed after this one. A knock only ends the match the player was hurt in. */
  games: readonly [number, number];
  /** Relative odds, from a tackle. */
  weight: number;
  labels: readonly string[];
}

export const INJURY_TIERS: readonly InjuryTier[] = [
  { id: "knock", games: [0, 0], weight: 50, labels: ["Dead leg", "Bruised rib", "Stinger in the shoulder"] },
  { id: "minor", games: [1, 2], weight: 30, labels: ["Sprained ankle", "Tight hamstring", "Bruised shoulder"] },
  { id: "moderate", games: [3, 4], weight: 15, labels: ["Hamstring strain", "Torn calf", "Knee ligament sprain"] },
  { id: "serious", games: [4, 5], weight: 5, labels: ["Dislocated shoulder", "Fractured wrist", "Medial ligament tear"] },
];

/** The most matches any injury can keep a player out. */
export const MAX_INJURY_GAMES = Math.max(...INJURY_TIERS.map((t) => t.games[1]));

/** Chance that a tackle hurts someone, before force and tiredness. */
export const INJURY_RATE = 0.0016;

export interface RolledInjury {
  tier: InjuryTier["id"];
  label: string;
  games: number;
}

/** Picks an injury. `atLeast` skips the knock and minor tiers, for the victim of a dangerous tackle. */
export function rollInjury(rng: Rng, atLeast: InjuryTier["id"] = "knock"): RolledInjury {
  const from = INJURY_TIERS.findIndex((t) => t.id === atLeast);
  const pool = INJURY_TIERS.slice(Math.max(0, from));
  const tier = rng.weighted(pool, (t) => t.weight);
  return { tier: tier.id, label: rng.pick(tier.labels), games: rng.int(tier.games[0], tier.games[1]) };
}

export interface Offence {
  id: "mistimed" | "high" | "elbow" | "spear";
  /** How it is described in the commentary: "sent off for ...". */
  label: string;
  /** Matches the player is then banned for. */
  matches: number;
  /** Relative odds when the foul came on a line break (a tackle at the neck), and in other play (at the breakdown). */
  tackle: number;
  breakdown: number;
}

export const OFFENCES: readonly Offence[] = [
  { id: "mistimed", label: "a badly mistimed tackle", matches: 2, tackle: 40, breakdown: 65 },
  { id: "high", label: "a dangerous high tackle", matches: 3, tackle: 30, breakdown: 0 },
  { id: "elbow", label: "a swinging elbow", matches: 4, tackle: 22, breakdown: 35 },
  { id: "spear", label: "a spear tackle", matches: 5, tackle: 8, breakdown: 0 },
];

/** A second yellow card in one match is a red, and a one-match ban. */
export const SECOND_YELLOW: { label: string; matches: number } = { label: "a second yellow card", matches: 1 };

export function rollOffence(rng: Rng, tackle: boolean): Offence {
  return rng.weighted(OFFENCES, (o) => (tackle ? o.tackle : o.breakdown));
}

/** "1 match", "3 matches". */
export const matchesText = (n: number) => `${n} match${n === 1 ? "" : "es"}`;
