import type { MatchEvent } from "../engine/types";

/** Every sound the stadium can make. The synthesis for each lives in engine.ts. */
export type CueName =
  | "whistle"
  | "whistleLong"
  | "whistleDouble"
  | "whistleFull"
  | "kick"
  | "tackle"
  | "post"
  | "roar"
  | "cheer"
  | "applause"
  | "groan"
  | "gasp"
  | "boo"
  | "hush"
  | "swell"
  | "horns"
  | "drumFill"
  | "chant";

export interface Cue {
  name: CueName;
  /** Seconds after the moment it is triggered. */
  at: number;
  /** Loudness multiplier, 1 = normal. */
  level: number;
}

const c = (name: CueName, at = 0, level = 1): Cue => ({ name, at, level });

/** At fast replay speeds only these are played, so a rush of events does not turn into noise. */
export const ESSENTIAL: ReadonlySet<CueName> = new Set<CueName>(["whistle", "whistleLong", "whistleDouble", "whistleFull", "roar", "cheer", "horns", "drumFill", "chant"]);

/**
 * What the crowd and the pitch sound like for one match event.
 *
 * `start` is the build-up as a highlight begins (the kick, the crowd leaning in). `result` is what happens when the
 * moment is revealed. `favour` is the side the manager runs: its scores bring the house down, the other side's
 * score brings groans with a little polite applause. Without a managed side (a replay) the crowd is neutral.
 */
export function cuesFor(ev: Pick<MatchEvent, "type" | "variant" | "team">, phase: "start" | "result", favour?: 0 | 1): Cue[] {
  const ours = favour === undefined || ev.team === undefined || ev.team === favour;
  if (phase === "start") {
    switch (ev.type) {
      case "kick":
        return [c("kick", 0.5)];
      case "conversion":
      case "conversion-miss":
      case "penalty-goal":
      case "penalty-miss":
      case "drop-goal":
      case "drop-miss":
        return [c("swell", 0, 0.8), c("kick", 0.9)];
      case "try":
      case "break":
      case "intercept":
        return [c("swell", 0, ev.type === "try" ? 1 : 0.7)];
      default:
        return [];
    }
  }
  switch (ev.type) {
    case "kickoff":
      return [c("whistle"), c("cheer", 0.15, 0.7), c("drumFill", 0.3, 0.7)];
    case "golden":
      return [c("whistleLong"), c("roar", 0.2, 0.8), c("horns", 0.4, 0.8)];
    case "halftime":
      return [c("whistleDouble"), c("applause", 0.4, 0.9)];
    case "fulltime":
      return [c("whistleFull"), c("roar", 0.3, 0.9), c("applause", 0.6), c("horns", 0.8, 0.9), c("drumFill", 1, 1)];
    case "try":
      return ours
        ? [c("roar", 0, 1.35), c("horns", 0.15, 1), c("drumFill", 0.3, 1), c("chant", 1.4, 1)]
        : [c("groan", 0, 1), c("applause", 0.9, 0.35), c("whistle", 0.3, 0.6)];
    case "conversion":
    case "penalty-goal":
    case "drop-goal":
      if (ev.variant === "post-in") return ours ? [c("post"), c("cheer", 0.25, 1.2), c("horns", 0.45, 0.8), c("drumFill", 0.6, 0.8)] : [c("post"), c("groan", 0.25, 0.7)];
      return ours ? [c("cheer", 0, 1.1), c("horns", 0.2, 0.8), c("drumFill", 0.35, 0.8)] : [c("groan", 0, 0.6), c("applause", 0.7, 0.25)];
    case "conversion-miss":
    case "penalty-miss":
    case "drop-miss":
      if (ev.variant === "post") return ours ? [c("post"), c("gasp", 0.05, 0.9), c("groan", 0.7, 0.9)] : [c("post"), c("gasp", 0.05, 0.8), c("cheer", 0.7, 0.7)];
      return ours ? [c("groan", 0.1, 1)] : [c("cheer", 0.1, 0.7)];
    case "break":
      return ours ? [c("cheer", 0, 0.7)] : [c("gasp", 0, 0.8)];
    case "intercept":
      return ours ? [c("cheer", 0, 0.9), c("tackle", 0)] : [c("groan", 0, 0.8), c("tackle", 0)];
    case "turnover":
      // The event's team is the winner of a jackal but the loser of a sixth-tackle turnover, so the crowd stays neutral.
      return [c("tackle"), c("gasp", 0.1, 0.5)];
    case "knock-on":
      return ours ? [c("whistle"), c("groan", 0.1, 0.5)] : [c("whistle"), c("cheer", 0.1, 0.4)];
    case "penalty":
      // The event's team is the side awarded the penalty.
      return ours ? [c("whistleLong"), c("cheer", 0.2, 0.6)] : [c("whistleLong"), c("boo", 0.2, 0.6)];
    case "yellow":
      return ours ? [c("whistleDouble"), c("groan", 0.2, 0.7)] : [c("whistleDouble"), c("cheer", 0.2, 0.8), c("boo", 0.3, 0.4)];
    case "red":
      return ours ? [c("whistleDouble"), c("boo", 0.2, 0.9), c("groan", 0.3, 1)] : [c("whistleDouble"), c("roar", 0.2, 1), c("boo", 0.4, 0.6)];
    case "injury":
      return [c("whistle"), c("hush", 0.2, 1)];
    case "return":
      return [c("applause", 0, 0.5)];
    case "sub":
      return [c("applause", 0, 0.6)];
    case "carry":
      return [c("tackle")];
    default:
      return [];
  }
}

/** How close play is to a try line, 0 (midfield) to 1 (on the line). `pressure` is the 0-1 position of the ball. */
export function tensionAt(pressure: number): number {
  return Math.max(0, Math.min(1, (Math.abs(pressure - 0.5) * 2 - 0.4) / 0.6));
}
