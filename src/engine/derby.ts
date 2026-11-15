import { Rng } from "./rng";

/**
 * Derby effects. When the managed club plays its rival the match is hotter, in two small ways that
 * treat both sides alike so the game cannot be farmed by seeking out the rival:
 *  - form counts for less: the gap between the two sides' ratings is shrunk, so the underdog has a real chance;
 *  - tempers run higher: a penalty is a little more likely to become a card.
 * The rest is atmosphere: a banner on the match, and the odd line of commentary from here.
 */
export const DERBY = {
  /** Multiplies the rating gap in every carry. Below 1 the underdog is lifted and the favourite is held back. */
  gap: 0.8,
  /** Multiplies the chance that a penalty becomes a card. */
  card: 1.25,
};

type Line = readonly string[];
const BANK: Record<string, Line> = {
  try: ["The crowd are on their feet. In a derby, a try like that means more.", "Bragging rights are on the line, and that try could decide them."],
  yellow: ["Tempers are running high in this derby.", "The derby is getting heated, and the referee is having to keep a lid on it."],
  red: ["A derby spoiled by a moment of madness.", "Nobody wanted a red card in a game like this, but the temperature has been rising all night."],
  halftime: ["There is no love lost between these two. The second half should be a cracker.", "A proper derby so far, with everything still to play for."],
  "drop-goal": ["A drop goal in a derby, and the stands erupt."],
  injury: ["A hard derby, and it has taken a toll."],
};
const CHANCE: Record<string, number> = { try: 0.35, yellow: 0.7, red: 0.9, halftime: 0.8, "drop-goal": 0.5, injury: 0.5 };

/** Wording only: it has its own random stream, so it never changes what happens in the match. */
export class DerbyTalk {
  private rng: Rng;
  private last = new Map<string, string>();
  constructor(
    private on: boolean,
    seed: number,
  ) {
    this.rng = new Rng((seed ^ 0x2f6e2b1) >>> 0);
  }

  /** A sentence to add after an event's text, or "" when there is nothing to say. */
  remark(type: string): string {
    const lines = this.on ? BANK[type] : undefined;
    if (!lines || !this.rng.chance(CHANCE[type] ?? 0)) return "";
    const options = lines.length > 1 ? lines.filter((l) => l !== this.last.get(type)) : lines;
    const line = this.rng.pick(options);
    this.last.set(type, line);
    return line;
  }
}
