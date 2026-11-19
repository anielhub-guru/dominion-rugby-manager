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
  /** First meeting: "passed" if the origin club never signed them, "left" if they were once on its books. */
  detail?: string;
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
  duel: [
    ["a budding rivalry", "a personal duel", "tries for tries", "a contest within the contest"],
    ["a real rivalry", "a running battle", "a duel the league noticed", "old foes"],
    ["a fully fledged rivalry", "a rivalry with history", "a rivalry told in tries"],
  ],
  nemesis: [
    ["a thorn in their side", "someone who keeps finding the answer", "an awkward opponent", "a nemesis in the making"],
    ["a nemesis", "a mismatch of fortunes", "an opponent who has their number", "a recurring problem"],
    ["a fully fledged nemesis", "someone who owns the fixture", "a problem with no answer yet"],
  ],
  clash: [
    ["some spark", "a spirited fixture", "an edge to the contest", "plenty of fire"],
    ["a fiercely fought duel", "neither giving an inch", "a fixture with fire", "a keenly contested rivalry"],
    ["a duel the league looks out for", "a rivalry with real fire", "two players who give no quarter"],
  ],
  run: [
    ["a happy hunting ground", "a habit forming", "a fixture they like", "a good record to carry in"],
    ["a happy hunting ground", "a run to protect", "a side that cannot keep them out", "a favourite opponent"],
    ["a fixture they own", "a hunting ground in full", "a run the other side dreads"],
  ],
  dry: [
    ["a bogey side", "a stubborn opponent", "unfinished business", "a wall to get past"],
    ["a bogey side", "a wall they cannot get past", "unfinished business", "a fixture with a stubborn streak"],
    ["a bogey side in full", "a fixture that will not give", "a drought the whole club has noticed"],
  ],
  unbeaten: [
    ["a good record to carry in", "a run to protect", "a happy fixture", "a settled order"],
    ["a run to protect", "a fixture they own", "a streak with some weight"],
    ["a streak with real weight", "an unbroken run", "a record worth defending"],
  ],
  losing: [
    ["one to put right", "a bogey fixture", "a hoodoo", "a run to end"],
    ["a hoodoo", "a bogey fixture", "a run that needs ending", "one to put right"],
    ["a hoodoo in full", "a run that has become a story", "a fixture the club dreads"],
  ],
  race: [
    ["a close race", "a race to the wire", "so close", "the margin of a single kick"],
    ["a close race", "a race to the wire", "so close", "a few points the wrong way"],
    ["a close race", "a race to the wire", "so close", "a few points the wrong way"],
  ],
} as const;

type LabelKey = keyof typeof LABELS;
type PairKey = "supplier" | "finisher" | "alternating" | "together";

const tier = (n: number, low: number) => (n >= low + 4 ? 2 : n >= low + 2 ? 1 : 0);
const label = (key: LabelKey, n: number, low: number, ...seed: (string | number)[]) => pick(LABELS[key][tier(n, low)], key, "label", ...seed);

/** Count at which each pair pattern first counts. */
export const PAIR_MIN: Record<PairKey, number> = { supplier: 3, finisher: 3, alternating: 5, together: 4 };
/** Count at which each pattern against another club, or one of its players, first counts. */
export const VS_MIN = { run: 3, dry: 5, unbeaten: 5, losing: 5, duel: 3, nemesis: 5, clash: 2 } as const;

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

const FIRST_INTRO: Record<string, ((w: Words) => string)[]> = {
  passed: [
    (w) => `Faced ${w.vs}, who did not sign them, for the first time`,
    (w) => `Met ${w.vs}, the club that let them go, for the first time`,
    (w) => `First meeting with ${w.vs}, where they began in the intake but never signed`,
    (w) => `Lined up against ${w.vs}, who passed on them, for the first time`,
  ],
  left: [
    (w) => `Faced ${w.vs}, the club they left, for the first time`,
    (w) => `Returned to face ${w.vs}, their old club, for the first time`,
    (w) => `First match against former club ${w.vs}`,
    (w) => `Met ${w.vs}, where it began, for the first time as an opponent`,
  ],
};

const FIRST_OUTCOME: Record<string, ((w: Words) => string)[]> = {
  "win-scored": [(w) => `, scored, and won ${w.score}`, (w) => `: a try and a ${w.score} win`, (w) => `. They scored and ${w.club} won ${w.score}`],
  "win-blank": [(w) => `, and ${w.club} won ${w.score} without a try from them`, (w) => `. ${w.club} won ${w.score}; they did not score`, (w) => `: a ${w.score} win, no try of their own`],
  "loss-scored": [(w) => `, scored, but lost ${w.score}`, (w) => `: a try in a ${w.score} defeat`, (w) => `. They scored; ${w.club} lost ${w.score}`],
  "loss-blank": [(w) => `, and lost ${w.score}`, (w) => `: a ${w.score} defeat, no try`, (w) => `. ${w.club} lost ${w.score} and they did not score`],
  "draw-scored": [(w) => `, scored, and drew ${w.score}`, (w) => `: a try in a ${w.score} draw`],
  "draw-blank": [(w) => `, and drew ${w.score}`, (w) => `: a ${w.score} draw, no try`],
};

const resultOf = (score = "0-0", tries = 0) => {
  const [a, b] = score.split("-").map(Number);
  return `${a > b ? "win" : a < b ? "loss" : "draw"}-${tries > 0 ? "scored" : "blank"}`;
};

type VsLine = (w: Words, l: string) => string;
const RUN: VsLine[] = [
  (w, l) => `Scored against ${w.vs} in ${w.n} straight meetings: ${l}`,
  (w, l) => `Found the line against ${w.vs} ${w.n} meetings running, ${l}`,
  (w, l) => `${w.vs} could not keep them out for ${w.n} meetings in a row. ${cap(l)}`,
];
const DRY: VsLine[] = [
  (w, l) => `No try against ${w.vs} in ${w.n} meetings: ${l}`,
  (w, l) => `${w.vs} have kept them try-less for ${w.n} meetings, ${l}`,
  (w, l) => `Still looking for a try against ${w.vs}, ${w.n} meetings on. ${cap(l)}`,
];
const UNBEATEN: VsLine[] = [
  (w, l) => `Unbeaten in ${w.n} meetings with ${w.vs}: ${l}`,
  (w, l) => `${w.n} meetings with ${w.vs} and no defeat, ${l}`,
  (w, l) => `${w.vs} have not beaten their side in ${w.n} meetings. ${cap(l)}`,
];
const LOSING: VsLine[] = [
  (w, l) => `Beaten in ${w.n} straight meetings with ${w.vs}: ${l}`,
  (w, l) => `${w.vs} have won ${w.n} meetings in a row against their side, ${l}`,
  (w, l) => `No win over ${w.vs} in ${w.n} meetings. ${cap(l)}`,
];
const DUEL: VsLine[] = [
  (w, l) => `Both scored against each other (${w.other}, ${w.vs}) in ${w.n} matches: ${l}`,
  (w, l) => `Traded tries with ${w.other} of ${w.vs} in ${w.n} matches, ${l}`,
  (w, l) => `${w.n} matches in which they and ${w.other} (${w.vs}) both crossed. ${cap(l)}`,
];
const NEMESIS: VsLine[] = [
  (w, l) => `${w.other} of ${w.vs} scored against them in ${w.n} matches in which they did not: ${l}`,
  (w, l) => `${w.other} (${w.vs}) found the line ${w.n} times when they could not, ${l}`,
  (w, l) => `Every time ${w.other} of ${w.vs} scored against them (${w.n} matches), they went without. ${cap(l)}`,
];
const CLASH: VsLine[] = [
  (w, l) => `Both carded in ${w.n} matches against ${w.other} of ${w.vs}: ${l}`,
  (w, l) => `${w.n} matches with ${w.other} (${w.vs}) ended in cards for both: ${l}`,
  (w, l) => `Cards for them and for ${w.other} of ${w.vs}, in ${w.n} matches. ${cap(l)}`,
];
const TOP: ((w: Words) => string)[] = [
  (w) => `Finished as the league's top scorer, ${w.n} points clear of ${w.other} (${w.vs})`,
  (w) => `Led the scoring charts, ${w.n} ahead of ${w.other} of ${w.vs}`,
  (w) => `Top of the scoring table with ${w.other} (${w.vs}) ${w.n} points behind`,
];
const RUNNER: VsLine[] = [
  (w, l) => `Second in the scoring charts, ${w.n} points behind ${w.other} (${w.vs}): ${l}`,
  (w, l) => `${w.other} of ${w.vs} took the scoring title by ${w.n} points: ${l}`,
  (w, l) => `Ran ${w.other} (${w.vs}) close for the scoring title, ${w.n} points short. ${cap(l)}`,
];

export type WordKey =
  | "winning-try" | "winning-kick" | "stand" | PairKey | "replaced"
  | "first-meeting" | "scoring-run" | "drought" | "unbeaten" | "losing" | "duel" | "nemesis" | "clash" | "top-scorer" | "runner-up-scorer";

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
    case "first-meeting": {
      const intro = pick(FIRST_INTRO[w.detail === "left" ? "left" : "passed"], key, "intro", ...seed)(w);
      return intro + pick(FIRST_OUTCOME[resultOf(w.score, w.n)], key, "outcome", ...seed)(w);
    }
    case "scoring-run": return pick(RUN, key, ...seed)(w, label("run", w.n ?? 0, VS_MIN.run, ...seed));
    case "drought": return pick(DRY, key, ...seed)(w, label("dry", w.n ?? 0, VS_MIN.dry, ...seed));
    case "unbeaten": return pick(UNBEATEN, key, ...seed)(w, label("unbeaten", w.n ?? 0, VS_MIN.unbeaten, ...seed));
    case "losing": return pick(LOSING, key, ...seed)(w, label("losing", w.n ?? 0, VS_MIN.losing, ...seed));
    case "duel": return pick(DUEL, key, ...seed)(w, label("duel", w.n ?? 0, VS_MIN.duel, ...seed));
    case "nemesis": return pick(NEMESIS, key, ...seed)(w, label("nemesis", w.n ?? 0, VS_MIN.nemesis, ...seed));
    case "clash": return pick(CLASH, key, ...seed)(w, label("clash", w.n ?? 0, VS_MIN.clash, ...seed));
    case "top-scorer": return pick(TOP, key, ...seed)(w);
    case "runner-up-scorer": return pick(RUNNER, key, ...seed)(w, label("race", w.n ?? 0, 0, ...seed));
  }
}

/** Short phrase for the "Alongside" list, said of the other player. */
export const SHORT: Record<PairKey | "replaced" | "duel" | "nemesis" | "clash" | "top-scorer" | "runner-up-scorer", string> = {
  duel: "scored against each other",
  nemesis: "scored when they could not",
  clash: "cards for both",
  "top-scorer": "next in the scoring charts",
  "runner-up-scorer": "took the scoring title",
  supplier: "tries set up for them",
  finisher: "tries set up by them",
  alternating: "traded tries",
  together: "scored together",
  replaced: "retired; took their place",
};
