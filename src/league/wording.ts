import { hashSeed } from "../engine/rng";

/**
 * The words for story moments. Every line states a fact (who, where, how many) and may add one colour word from a
 * bank, so two careers with the same pattern do not read the same. The choice is deterministic from the career, the
 * season and the other player, so a line never changes when the page is redrawn.
 */

export interface Words {
  name: string;
  club: string;
  other?: string;
  vs?: string;
  score?: string;
  minute?: number;
  n?: number;
  role?: string;
  age?: number;
}

const pick = <T,>(bank: readonly T[], ...seed: (string | number)[]): T => bank[Math.floor((hashSeed(...seed) / 4294967296) * bank.length)];
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const times = (n: number) => (n === 1 ? "once" : n === 2 ? "twice" : `${n} times`);

/** "in the last minute", "with 3 minutes to go", "in minute 24". */
export function whenIn(minute = 0): string {
  if (minute >= 40) return "in the last minute";
  if (minute >= 37) return `with ${40 - minute} ${40 - minute === 1 ? "minute" : "minutes"} to go`;
  return `in minute ${minute}`;
}

type Line = (w: Words, when: string) => string;

const WINNING_TRY: Line[] = [
  (w, t) => `Scored the try that won it for ${w.club} against ${w.vs}, ${t}. ${w.score}`,
  (w, t) => `Crossed ${t} to beat ${w.vs} ${w.score} for ${w.club}`,
  (w, t) => `The deciding try against ${w.vs} came ${t}: ${w.score} to ${w.club}`,
  (w, t) => `${w.club} were level or behind until their try ${t}. Final score against ${w.vs}: ${w.score}`,
  (w, t) => `A try ${t} settled ${w.club} v ${w.vs}, ${w.score}`,
  (w, t) => `Won the match against ${w.vs} with a try ${t}, ${w.score}`,
  (w, t) => `Put ${w.club} ahead for good against ${w.vs} ${t}. ${w.score}`,
  (w, t) => `Touched down ${t} and ${w.club} did not look back against ${w.vs}, ${w.score}`,
];

const WINNING_KICK: Line[] = [
  (w, t) => `Kicked the points that won it for ${w.club} against ${w.vs}, ${t}. ${w.score}`,
  (w, t) => `The kick that decided ${w.club} v ${w.vs} went over ${t}, ${w.score}`,
  (w, t) => `Put ${w.club} ahead for good against ${w.vs} from the tee ${t}. ${w.score}`,
  (w, t) => `A kick ${t} was the difference against ${w.vs}, ${w.score}`,
  (w, t) => `Held their nerve with the boot ${t} to beat ${w.vs} ${w.score}`,
  (w, t) => `The winning points against ${w.vs} came off their boot ${t}, ${w.score}`,
];

const STAND: Line[] = [
  (w, t) => `Stopped ${w.vs} close to the line ${t}, and ${w.club} held on ${w.score}`,
  (w, t) => `The defining tackle against ${w.vs} came ${t}. ${w.club} won ${w.score}`,
  (w, t) => `Denied ${w.vs} near the line ${t}: ${w.club} held on, ${w.score}`,
  (w, t) => `A stop on the line ${t} kept ${w.vs} out, and ${w.club} won ${w.score}`,
  (w, t) => `Made the last big defensive play against ${w.vs}, ${t}. ${w.score} to ${w.club}`,
  (w, t) => `Stood firm ${t} against ${w.vs}, and the ${w.score} result stood`,
  (w, t) => `${w.vs} were turned back ${t}. ${w.club} held their lead, ${w.score}`,
];

/** Colour words for a pair, by how strongly the pattern showed (three tiers). */
const LABELS = {
  supplier: [
    ["an early understanding", "a link-up worth watching", "a useful connection", "something building"],
    ["a real partnership", "a dependable supply line", "a standing arrangement", "a well-worn route to the line"],
    ["a double act", "a partnership at full stretch", "a pair who read each other", "a settled understanding"],
  ],
  finisher: [
    ["an early understanding", "a connection worth watching", "a useful link", "something building"],
    ["a real partnership", "a trusted route to the line", "a standing arrangement", "a pair who found each other"],
    ["a double act", "a partnership at full stretch", "a pair who read each other", "a settled understanding"],
  ],
  alternating: [
    ["a friendly rivalry", "a running contest", "tries traded", "a scoring duel", "a race to the line", "one-upmanship", "tit for tat", "rival and ally"],
    ["a friendly rivalry", "a running contest", "a good-natured duel", "tries traded back and forth", "each pushing the other on", "a contest of their own"],
    ["a friendly rivalry in full swing", "a duel the club noticed", "a contest with no clear leader", "rivals as much as teammates"],
  ],
  together: [
    ["a scoring partnership", "two in tandem", "a pair to watch", "a joint effort"],
    ["a scoring partnership", "double trouble for defences", "a pair who scored as one", "a shared habit"],
    ["a scoring partnership in full flow", "the pair every defence planned for", "two players on the same errand"],
  ],
} as const;

type PairKey = keyof typeof LABELS;

const tier = (n: number, low: number) => (n >= low + 4 ? 2 : n >= low + 2 ? 1 : 0);
const label = (key: PairKey, n: number, low: number, ...seed: (string | number)[]) => pick(LABELS[key][tier(n, low)], key, "label", ...seed);

/** Count at which each pair pattern first counts. */
export const PAIR_MIN: Record<PairKey, number> = { supplier: 3, finisher: 3, alternating: 5, together: 4 };

const SUPPLIER: ((w: Words, l: string) => string)[] = [
  (w, l) => `Set up ${w.n} tries for ${w.other} at ${w.club}: ${l}`,
  (w, l) => `${w.other} scored from their pass ${times(w.n!)} for ${w.club}. ${cap(l)}`,
  (w, l) => `Created ${w.n} tries for ${w.other} in a season at ${w.club}, ${l}`,
  (w, l) => `The ball went from them to ${w.other} for a try ${times(w.n!)} at ${w.club}: ${l}`,
];

const FINISHER: ((w: Words, l: string) => string)[] = [
  (w, l) => `Scored ${w.n} tries from ${w.other}'s passing at ${w.club}: ${l}`,
  (w, l) => `Finished ${w.other}'s work ${times(w.n!)} for ${w.club}. ${cap(l)}`,
  (w, l) => `${w.other} set them up ${times(w.n!)} at ${w.club}, ${l}`,
  (w, l) => `Crossed ${times(w.n!)} after ${w.other} made the ground, for ${w.club}: ${l}`,
];

const ALTERNATING: ((w: Words, l: string) => string)[] = [
  (w, l) => `Took turns with ${w.other} to score for ${w.club}, ${w.n} matches running: ${l}`,
  (w, l) => `${w.other} and they scored in turn for ${w.club} over ${w.n} matches. ${cap(l)}`,
  (w, l) => `A tries-in-turn streak with ${w.other}, ${w.n} matches long, at ${w.club}: ${l}`,
  (w, l) => `For ${w.n} matches one of them or ${w.other} scored for ${w.club}, then the other: ${l}`,
];

const TOGETHER: ((w: Words, l: string) => string)[] = [
  (w, l) => `Scored in the same match as ${w.other} ${times(w.n!)} for ${w.club}: ${l}`,
  (w, l) => `${w.other} and they both crossed ${times(w.n!)} in one match for ${w.club}. ${cap(l)}`,
  (w, l) => `Shared the scoring with ${w.other} ${times(w.n!)} at ${w.club}, ${l}`,
];

const REPLACED: ((w: Words) => string)[] = [
  (w) => `Took the ${w.role} place at ${w.club} after ${w.other} retired at ${w.age}`,
  (w) => `Filled the ${w.role} spot ${w.other} left at ${w.club}, aged ${w.age}`,
  (w) => `Stepped into the shirt ${w.other} wore at ${w.club} (retired, ${w.age})`,
  (w) => `${w.other} retired at ${w.age}; they became ${w.club}'s ${w.role}`,
];

export type WordKey = "winning-try" | "winning-kick" | "stand" | PairKey | "replaced";

/** The line for one story entry. The seed parts keep the choice stable for that entry. */
export function storyText(key: WordKey, w: Words, ...seed: (string | number)[]): string {
  const when = whenIn(w.minute);
  switch (key) {
    case "winning-try": return pick(WINNING_TRY, key, ...seed)(w, when);
    case "winning-kick": return pick(WINNING_KICK, key, ...seed)(w, when);
    case "stand": return pick(STAND, key, ...seed)(w, when);
    case "supplier": return pick(SUPPLIER, key, ...seed)(w, label(key, w.n ?? 0, PAIR_MIN[key], ...seed));
    case "finisher": return pick(FINISHER, key, ...seed)(w, label(key, w.n ?? 0, PAIR_MIN[key], ...seed));
    case "alternating": return pick(ALTERNATING, key, ...seed)(w, label(key, w.n ?? 0, PAIR_MIN[key], ...seed));
    case "together": return pick(TOGETHER, key, ...seed)(w, label(key, w.n ?? 0, PAIR_MIN[key], ...seed));
    case "replaced": return pick(REPLACED, key, ...seed)(w);
  }
}

/** Short phrase for the "Alongside" list, said of the other player. */
export const SHORT: Record<PairKey | "replaced", string> = {
  supplier: "tries set up for them",
  finisher: "tries set up by them",
  alternating: "traded tries",
  together: "scored together",
  replaced: "retired; took their place",
};
