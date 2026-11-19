/**
 * Tuning tables for the illustrated cutaways. Everything you would change when updating the
 * artwork or the feel of a cutaway is in this file; the artwork itself is in ./art and is
 * regenerated from the silhouette lab with `npm run cutaways:extract`.
 */

export type Transition = "diagonal" | "split" | "hard" | "dots";
export type Kind = "bighit" | "grounding" | "celebration" | "lastditch" | "jackal" | "card" | "waist" | "double" | "ankle" | "intercept" | "goalmiss" | "goal" | "kickchase" | "huddle" | "pass" | "injury";
/** Kinds drawn from the artwork in ./art. */
export type StoryKind = Exclude<Kind, "bighit">;

/** Seconds, on the lab's scene clock: contact is when the cutaway pose begins, end is when it settles. */
export const TIMING = {
  start: 1.02,
  contact: 1.34,
  end: 1.94,
  /** The cut happens this long after contact. */
  cutDelay: 0.13,
  /** Entry reveal, and the exit that carries the illustration away (real seconds at 1x). */
  reveal: 0.17,
  exit: 0.24,
  /** The first part of the cutaway plays in slow motion: this much scene time, at this rate. */
  slowLength: 0.18,
  slowRate: 0.3,
  /** Real seconds the finished illustration stays on screen before the exit (the lab ends straight away). */
  hold: 0.9,
};

/** Transition names, in the order they are offered. */
export const TRANSITIONS: readonly [Transition, string][] = [
  ["diagonal", "Forward diagonal"],
  ["split", "Split slash"],
  ["hard", "Hard cut"],
  ["dots", "Off (field only)"],
];

/** Chance that a matching moment gets a cutaway. The roll is seeded from the event, so a replay repeats it. */
export const CHANCE: Record<Kind, number> = {
  card: 0.5,
  grounding: 0.3,
  celebration: 0.3,
  jackal: 0.4,
  bighit: 0.12,
  waist: 0.12,
  double: 0.12,
  lastditch: 0.25,
  ankle: 0.2,
  intercept: 0.4,
  goalmiss: 0.25,
  goal: 0.15,
  kickchase: 0.4,
  huddle: 0.7,
  pass: 0.5,
  injury: 1,
};

/**
 * Cutaways that show the action itself, so they play before the arena scene. Every other kind shows a
 * result or a reaction, and plays after it. A kick drawn after the ball has already landed makes no sense.
 */
export const BEFORE: ReadonlySet<Kind> = new Set<Kind>(["kickchase"]);

export type Frequency = "rare" | "normal" | "often" | "lots";

/**
 * How often cutaways come, chosen in the game. `chance` scales every CHANCE below (capped at 1), `max` is the
 * most in one match, and `cooldown` is the fewest match seconds between two. Often is the default; Normal is the original feel:
 * a treat, two or three a game.
 */
export const FREQUENCIES: readonly { id: Frequency; label: string; chance: number; max: number; cooldown: number }[] = [
  { id: "rare", label: "Rare", chance: 0.5, max: 2, cooldown: 600 },
  { id: "normal", label: "Normal", chance: 1, max: 3, cooldown: 420 },
  { id: "often", label: "Often", chance: 2, max: 6, cooldown: 240 },
  { id: "lots", label: "Lots", chance: 4, max: 12, cooldown: 90 },
];

/** How many artwork versions (poses) a kind has; one is picked at random each time. */
export const VERSIONS: Partial<Record<StoryKind, number>> = {
  ankle: 2,
  card: 2,
  celebration: 2,
  double: 2,
  goal: 2,
  goalmiss: 2,
  grounding: 3,
  huddle: 2,
  injury: 3,
  intercept: 2,
  jackal: 3,
  kickchase: 3,
  lastditch: 2,
  pass: 2,
  waist: 3,
};

/**
 * Game hairstyle (Look.portrait, see league/look.ts HAIR) to the lab's hairstyle number:
 * 0 original braided ponytail, 1 braided bun, 2 natural puff, 3 sports hijab, 4 bob cut,
 * 5 curly afro, 6 tapered natural crop, 7 twin Dutch braids, 8 tied-back locs,
 * 9 curly high ponytail.
 */
export const LAB_HAIR = [0, 2, 3, 4, 0, 1, 5, 6, 7, 8, 9] as const;

/** Existing full-pose raster used beneath each hairstyle-specific vector silhouette. */
export const ART_HAIR = [0, 1, 2, 3, 4, 1, 0, 0, 1, 1] as const;

/** Crown registration: x, y, scale, facing and athlete slot, all relative to the uncropped pose. */
export type HeadMark = readonly [number, number, number, 1 | -1, number];
export const STORY_HEADS: Record<StoryKind, readonly (readonly HeadMark[])[]> = {
  grounding: [
    [[.750, .018, .090, 1, 0]],
    [[.834, .018, .053, 1, 0], [.353, .208, .055, 1, 1]],
    [[.771, .012, .058, 1, 0], [.323, .258, .058, 1, 1]],
  ],
  celebration: [[[.192, .110, .151, 1, 0], [.815, .127, .151, -1, 1]], [[.450, .105, .140, 1, 0], [.735, .245, .130, -1, 1]]],
  lastditch: [[[.836, .007, .108, 1, 0], [.543, .358, .104, 1, 1]], [[.790, .018, .100, 1, 0], [.420, .390, .100, 1, 1]]],
  jackal: [
    [[.142, .525, .114, -1, 0], [.622, .020, .115, -1, 1]],
    [[.86, .48, .10, -1, 0], [.17, .10, .12, 1, 1]],
    [[.16, .33, .12, 1, 0], [.58, .02, .11, 1, 1]],
  ],
  intercept: [[[.475, .015, .140, 1, 0]], [[.430, .080, .140, 1, 0]]],
  goalmiss: [[[.714, .018, .315, 1, 0]], [[.250, .080, .170, 1, 0]]],
  card: [[[.156, .170, .165, 1, -1], [.808, .162, .170, -1, 0]], [[.190, .190, .120, 1, -1], [.790, .180, .120, -1, 0]]],
  pass: [[[.382, .014, .130, 1, 0]], [[.350, .020, .140, 1, 0]]],
  kickchase: [[[.344, .014, .140, 1, 0]], [[.54, .05, .12, 1, 0]], [[.30, .06, .11, 1, 0]]],
  goal: [[[.350, .060, .220, 1, 0]], [[.300, .060, .180, 1, 0]]],
  waist: [
    [[.655, .012, .125, 1, 0], [.501, .238, .125, 1, 1]],
    [[.79, .08, .12, 1, 0], [.46, .30, .11, 1, 1]],
    [[.75, .05, .11, 1, 0], [.43, .26, .11, 1, 1]],
  ],
  double: [[[.520, .015, .115, 1, 0], [.310, .395, .115, 1, 1], [.735, .086, .120, -1, 1]], [[.550, .140, .110, 1, 0], [.310, .260, .110, 1, 1], [.720, .050, .110, -1, 1]]],
  ankle: [[[.823, .010, .109, 1, 0], [.278, .505, .105, 1, 1]], [[.830, .020, .090, 1, 0], [.240, .350, .090, 1, 1]]],
  huddle: [[[.565, .010, .230, 1, 0]], [[.500, .030, .180, 1, 0]]],
  injury: [
    [[.620, .310, .110, 1, 0]],
    [[.860, .330, .080, 1, 0]],
    [[.660, .020, .120, 1, 0]],
  ],
};

/** Side-profile hair overlays used by every full-pose cutaway. */
export const HEAD_STYLES: readonly (readonly [outer: string, detail: string])[] = [
  ["M-11 9 Q-23 8 -29 17 Q-38 24 -49 24 Q-44 29 -36 28 Q-24 27 -16 20 L-10 15Z", "M-15 12 Q-25 13 -31 20 Q-40 25 -45 25 M-15 15 Q-23 17 -27 22 Q-35 26 -40 27"],
  ["M-8 10 Q-15 7 -18 12 C-29 9 -36 13 -36 20 C-37 28 -28 31 -22 28 Q-15 25 -14 19 L-8 16Z", "M-13 12 Q-21 16 -19 22 M-23 13 C-36 13 -37 25 -27 27 M-26 16 C-33 16 -34 22 -28 24 Q-22 25 -22 20 Q-22 17 -26 18"],
  ["M-8 9 Q-11 5 -16 5 Q-17 0 -22 1 Q-26 -4 -30 -1 Q-36 -4 -39 1 Q-44 1 -45 6 Q-49 9 -47 14 Q-49 19 -43 22 Q-42 27 -37 26 Q-34 30 -29 26 Q-24 29 -20 24 Q-16 24 -14 18 L-9 15Z", "M-40 8 q3 -4 7 -2 m-7 11 q3 4 8 2 m-2 -10 q3 -4 7 -1 m0 11 q4 3 7 -1 m-6 -7 q4 -2 6 2 M-17 8 L-15 17"],
  ["M10 4 Q2 -3 -8 1 Q-17 3 -18 15 L-20 25 L-25 37 Q-14 42 0 37 L8 29 Q2 26 0 20 Q-5 15 0 9Z", "M-15 19 Q-12 29 -3 32 M-18 29 Q-10 34 -3 34"],
  ["M11 4 C5 -3 -7 -4 -15 2 C-21 7 -22 14 -22 22 L-23 30 Q-17 35 -9 35 L0 34 Q-4 29 -5 22 Q-7 15 -2 10 Q5 10 11 4Z", "M-4 1 C-15 7 -17 16 -16 30 M-9 2 Q-20 12 -20 28 M-6 13 Q-11 22 -9 31"],
  ["M4 12 Q1 3 -7 -2 Q-13 -10 -24 -8 Q-34 -15 -44 -8 Q-56 -9 -61 2 Q-70 7 -67 19 Q-73 29 -66 39 Q-65 50 -54 54 Q-47 63 -36 59 Q-26 65 -18 57 Q-9 54 -10 43 Q-4 36 -6 28 Q1 22 4 12Z", "M-52 2 q5 -6 10 -1 m-17 13 q5 -6 10 -1 m-12 17 q6 5 11 0 m3 -20 q5 -6 10 -1 m-3 18 q6 5 11 0 m-18 15 q6 5 11 0"],
  ["M3 8 Q-3 -2 -13 -2 Q-24 -1 -28 8 Q-29 14 -23 18 Q-14 21 -7 17 Q-3 13 3 8Z", "M-23 7 Q-15 1 -6 6 M-24 12 Q-15 7 -7 11 M-18 16 Q-12 11 -6 14"],
  ["M2 8 Q-4 -2 -14 -1 Q-25 1 -28 10 Q-28 17 -21 19 L-10 17 Q-6 13 2 8Z M-20 15 Q-34 20 -40 34 Q-45 45 -37 53 Q-30 50 -31 40 Q-25 53 -17 47 Q-12 40 -21 29 Q-15 39 -8 35 Q-5 27 -17 20Z", "M-22 5 Q-15 10 -12 17 M-27 9 Q-19 14 -17 20 M-34 31 Q-28 39 -36 48 M-25 27 Q-18 37 -24 45 M-17 24 Q-9 31 -14 37"],
  ["M2 8 Q-4 -2 -14 -1 Q-25 1 -28 10 Q-28 17 -20 20 L-10 17 Q-6 13 2 8Z M-21 14 Q-36 10 -48 18 Q-60 23 -66 34 Q-61 42 -52 36 Q-46 47 -37 39 Q-30 50 -22 41 Q-16 33 -24 24 Q-14 22 -21 14Z", "M-23 5 Q-17 10 -13 17 M-28 10 Q-21 15 -19 20 M-53 24 Q-46 30 -57 36 M-43 20 Q-35 29 -45 37 M-32 18 Q-24 27 -34 39"],
  ["M2 8 Q-4 -2 -14 -1 Q-18 -5 -24 -4 Q-30 -13 -38 -10 Q-47 -11 -51 -2 Q-57 5 -51 13 Q-52 21 -43 24 Q-35 29 -28 22 Q-20 24 -17 17 L-10 17 Q-6 13 2 8Z", "M-20 1 Q-25 6 -19 11 M-43 -6 q5 -5 10 -1 m-14 11 q5 -5 10 -1 m-2 12 q5 4 10 0"],
];

export interface Frame {
  width: number;
  height: number;
  rise: number;
  slide: number;
}
/** [x, y, width, height] as fractions of the pose image. */
export type Region = readonly [number, number, number, number];

export interface StorySpec {
  /** Artwork file prefix for a pose, e.g. grounding0 gives art/grounding0-<hair>.webp. */
  art: (pose: number) => string;
  frame: Frame;
  /** Where the second person is when the two players have different hairstyles. */
  regions: (pose: number) => readonly Region[];
  ground: number;
  /** The body settles from a tilt, for the diving pose. */
  tilt: number;
  /** Draws goalposts behind the player. */
  posts?: boolean;
  /** The figure bobs on the spot, for the huddle. */
  bob?: boolean;
}

/** Where the second athlete's head and shoulders sit in each jackal version. */
const JACKAL_REGIONS: readonly Region[] = [[0.50, 0, 0.25, 0.30], [0.05, 0, 0.26, 0.32], [0.47, 0, 0.24, 0.28]];

const BIG: Frame = { width: 450, height: 280, rise: 5, slide: 30 };

export const STORY: Record<StoryKind, StorySpec> = {
  // pose 0 is an open dive, 1 dives through an ankle tackle, 2 breaks a waist tackle
  grounding: {
    art: (pose) => `grounding${pose}`,
    frame: { width: 410, height: 184, rise: 28, slide: 42 },
    regions: (pose) => (pose === 1 ? [[0.24, 0.13, 0.2, 0.56]] : pose === 2 ? [[0.22, 0.15, 0.21, 0.6]] : []),
    ground: 361,
    tilt: 0.055,
  },
  celebration: { art: (pose) => pose ? `celebration${pose}` : "celebration", frame: { width: 360, height: 276, rise: 6, slide: 6 }, regions: () => [[0.59, 0.07, 0.41, 0.3]], ground: 390, tilt: 0 },
  lastditch: { art: (pose) => pose ? `lastditch${pose}` : "lastditch", frame: { width: 385, height: 260, rise: 13, slide: 32 }, regions: () => [[0.28, 0.27, 0.4, 0.29]], ground: 390, tilt: 0 },
  jackal: { art: (pose) => (pose ? `jackal${pose}` : "jackal"), frame: { width: 410, height: 238, rise: 6, slide: 12 }, regions: (pose): readonly Region[] => [JACKAL_REGIONS[pose] ?? JACKAL_REGIONS[0]], ground: 390, tilt: 0 },
  card: { art: (pose) => pose ? `card${pose}` : "card", frame: { width: 360, height: 275, rise: 0, slide: 0 }, regions: () => [[0, 0.09, 0.39, 0.24]], ground: 390, tilt: 0 },
  waist: { art: (pose) => (pose ? `waist${pose}` : "waist"), frame: BIG, regions: () => [[0.3, 0.2, 0.34, 0.3]], ground: 390, tilt: 0 },
  double: {
    art: (pose) => pose ? `double${pose}` : "double",
    frame: BIG,
    regions: () => [
      [0.16, 0.36, 0.31, 0.29],
      [0.63, 0, 0.3, 0.39],
    ],
    ground: 390,
    tilt: 0,
  },
  ankle: { art: (pose) => pose ? `ankle${pose}` : "ankle", frame: { ...BIG, rise: 20 }, regions: () => [[0.12, 0.44, 0.33, 0.32]], ground: 390, tilt: 0 },
  // These four show one player, so there is no second head to swap in.
  intercept: { art: (pose) => pose ? `intercept${pose}` : "intercept", frame: { width: 310, height: 276, rise: 8, slide: 32 }, regions: () => [], ground: 390, tilt: 0 },
  goalmiss: { art: (pose) => pose ? `goalmiss${pose}` : "goalmiss", frame: { width: 250, height: 270, rise: 0, slide: 0 }, regions: () => [], ground: 390, tilt: 0, posts: true },
  goal: { art: (pose) => pose ? `goal${pose}` : "goal", frame: { width: 290, height: 280, rise: 5, slide: 6 }, regions: () => [], ground: 390, tilt: 0, posts: true },
  kickchase: { art: (pose) => (pose ? `kickchase${pose}` : "kickchase"), frame: { width: 385, height: 268, rise: 0, slide: 20 }, regions: () => [], ground: 390, tilt: 0 },
  // The two kick-off cutaways: the captain calls the team in, and a winger shows for a pass.
  huddle: { art: (pose) => pose ? `huddle${pose}` : "huddle", frame: BIG, regions: () => [], ground: 390, tilt: 0, bob: true },
  pass: { art: (pose) => pose ? `pass${pose}` : "pass", frame: { width: 360, height: 272, rise: 0, slide: 18 }, regions: () => [], ground: 390, tilt: 0 },
  injury: { art: (pose) => `injury${pose}`, frame: { width: 410, height: 280, rise: 4, slide: 20 }, regions: () => [], ground: 390, tilt: 0 },
};

/** The original "big hit" is drawn from one sprite, with hair drawn on top. Paths are in the sprite's 152 x 260 space. */
export const SCALP = "M111 8 C97 -3 82 0 77 12 C71 21 75 31 80 36 L89 34 Q91 27 98 23 L106 24 Q101 17 111 8 Z";
export const BRAID_LINES = "M108 9 Q88 -1 79 17 M106 13 Q87 4 78 23 M104 17 Q86 11 79 28 M104 21 Q90 16 82 33";
/** Index 0 keeps the sprite's own hair. */
export const HAIR_PARTS: readonly ({ outer: string; detail: string; hijab?: boolean } | null)[] = [
  null,
  {
    outer: "M80 22 C77 15 68 14 63 19 C56 24 59 34 66 37 Q74 41 81 33 Z",
    detail: "M62 26 Q67 18 76 24 M62 30 Q68 23 77 28 M66 35 Q72 29 78 32",
  },
  {
    outer: "M83 24 Q79 18 73 17 Q70 13 65 16 Q58 14 55 19 Q48 19 47 25 Q42 31 48 36 Q49 43 56 43 Q61 48 67 44 Q74 46 79 40 Q85 38 86 32 Z",
    detail: "M53 25 Q57 21 62 23 M51 33 Q55 37 60 34 M63 41 Q68 38 72 40",
  },
  {
    outer: "M110 7 C98 -5 82 -1 75 11 Q68 25 75 35 L71 53 L82 62 L100 61 L104 43 Q95 34 98 23 L106 24 Q102 14 110 7 Z",
    detail: "M79 34 Q87 46 98 48 M77 52 Q88 57 98 54",
    hijab: true,
  },
  {
    outer: "M110 8 Q95 -4 81 4 Q69 11 70 29 L72 49 Q83 55 98 47 L97 36 Q91 30 98 23 L106 24 Q101 17 110 8 Z",
    detail: "M78 15 Q73 29 79 44 M84 10 Q78 22 84 45",
    hijab: true,
  },
  {
    outer: "M111 9 Q105 -2 95 1 Q89 -7 80 -1 Q72 -6 66 2 Q56 0 54 10 Q45 14 49 24 Q44 33 54 38 Q59 47 69 42 Q77 49 84 41 Q94 44 98 34 Q106 30 103 22 L107 20 Z",
    detail: "M61 10 q5 -5 10 0 m-15 11 q5 -5 10 0 m2 13 q5 -5 10 0 m7 -22 q5 -5 10 0 m-8 14 q5 -5 10 0",
  },
  {
    outer: "M110 9 Q99 0 85 2 Q72 3 67 14 Q64 23 72 31 L82 34 Q88 28 98 23 L106 24 Q102 16 110 9 Z",
    detail: "M72 12 q4 -5 8 0 m-10 7 q4 -5 8 0 m2 -12 q4 -4 8 0 m0 8 q4 -4 8 0",
  },
  {
    outer: "M110 8 Q96 -3 82 2 Q70 7 70 23 L76 34 L83 36 Q88 28 98 23 L106 24 Q101 16 110 8 Z M75 28 Q66 39 67 53 Q72 64 78 52 Q82 42 82 33 Z",
    detail: "M76 9 Q72 18 75 28 M82 5 Q78 16 80 29 M89 4 Q84 15 86 27 M72 42 Q76 47 70 55 M76 37 Q81 44 75 52",
  },
  {
    outer: "M110 8 Q96 -3 82 2 Q70 8 70 24 L77 34 L84 35 Q89 28 98 23 L106 24 Q101 16 110 8 Z M76 31 Q63 36 61 49 Q63 63 72 56 Q77 66 83 55 Q88 63 93 52 Q99 55 99 45 Q96 36 84 32 Z",
    detail: "M75 8 Q72 18 76 29 M82 5 Q79 17 82 29 M89 4 Q85 16 87 27 M67 45 q4 -5 8 0 m-7 10 q4 -5 8 0 m5 -15 q4 -5 8 0 m-7 11 q4 -5 8 0",
  },
  {
    outer: "M110 8 Q97 -3 82 2 Q70 8 70 23 L77 34 L84 35 Q89 27 98 23 L106 24 Q101 16 110 8 Z M78 5 Q66 -4 59 5 Q50 8 53 18 Q47 26 55 32 Q56 41 66 39 Q73 45 80 37 Q88 36 88 27 Q94 20 87 14 Q87 7 78 5 Z",
    detail: "M75 8 Q72 17 76 29 M82 5 Q79 16 82 28 M58 12 q4 -5 8 0 m-10 10 q4 -5 8 0 m3 11 q4 -5 8 0 m1 -17 q4 -5 8 0",
  },
];
/** The area of the sprite (152 x 260 space) cleared before a new hairstyle is drawn. */
export const HEAD_CLEAR = "M38 -4 H114 L111 8 Q101 17 106 24 L98 23 Q91 27 89 34 L80 38 L72 56 H38 Z";
