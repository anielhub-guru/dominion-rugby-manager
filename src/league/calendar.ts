/**
 * The calendar. A season is a year, and eras are time-bound: a new one begins every ERA_LENGTH seasons
 * whether or not the player has won anything, so nothing waits on an achievement.
 */
export const ERA_LENGTH = 10;
/** The year a new career starts in, until starting eras are chosen. */
export const DEFAULT_START_YEAR = 2020;

/** The calendar year of a season (season 1 is the start year). */
export const seasonYear = (startYear: number, season: number) => startYear + season - 1;

/** Which era a season falls in, counted from the start of the career: 0 for the first ten seasons, 1 for the next, and so on. */
export const eraIndex = (season: number) => Math.floor((season - 1) / ERA_LENGTH);

/** Seasons left before the next era begins, counting the current one (1 means the next season is a new era). */
export const seasonsToNextEra = (season: number) => ERA_LENGTH - ((season - 1) % ERA_LENGTH);
