/**
 * Club facilities. Every club starts at level 0 (the starter version) and each upgrade is a flat +1 level, so
 * the rules are the same whatever the era. Upgrades are bought in the offseason, one project per offseason,
 * and paid for out of the budget, so building competes with signing players.
 */
export type FacilityId = "training" | "medical" | "academy";

export const FACILITY_IDS: FacilityId[] = ["training", "medical", "academy"];
export const MAX_FACILITY_LEVEL = 3;
/** Projects the manager may start in one offseason. */
export const MAX_PROJECTS = 1;

export type FacilityLevels = Partial<Record<FacilityId, number>>;

export interface FacilityInfo {
  name: string;
  /** What each level adds, in words (shown before and after building). */
  effect: string;
}

export const FACILITIES: Record<FacilityId, FacilityInfo> = {
  training: { name: "Training ground", effect: "One more player improves in training each matchday." },
  medical: { name: "Medical centre", effect: "Injured players return one match sooner (never under one), and tired players recover faster." },
  academy: { name: "Youth academy", effect: "Youth prospects arrive with +2 potential, and rate higher to match." },
};

/** Thousands of naira for each upgrade: the first level is the cheapest. */
export const PROJECT_COST = [1000, 2000, 3000];

export const levelOf = (levels: FacilityLevels | undefined, id: FacilityId) => Math.min(MAX_FACILITY_LEVEL, levels?.[id] ?? 0);

/** What the next level costs, or null when the facility is fully upgraded. */
export const upgradeCost = (levels: FacilityLevels | undefined, id: FacilityId): number | null => {
  const lv = levelOf(levels, id);
  return lv >= MAX_FACILITY_LEVEL ? null : PROJECT_COST[lv];
};

/** Players who get a training chance each matchday: three, plus one per level of the training ground. */
export const trainingSlots = (levels?: FacilityLevels) => 3 + levelOf(levels, "training");

/** Matches shaved off an injury lasting more than one match. */
export const injuryRelief = (levels?: FacilityLevels) => levelOf(levels, "medical");
/** The injury length after the medical centre has helped: it never drops below one match. */
export const reducedInjury = (games: number, levels?: FacilityLevels) => (games <= 1 ? games : Math.max(1, games - injuryRelief(levels)));
/** Extra share of tiredness recovered between matches. */
export const recoveryBonus = (levels?: FacilityLevels) => levelOf(levels, "medical") * 0.03;

/** Potential added to every youth prospect at the club. */
export const academyBonus = (levels?: FacilityLevels) => levelOf(levels, "academy") * 2;
