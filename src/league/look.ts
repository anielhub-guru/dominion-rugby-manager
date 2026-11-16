import type { Gender, Look, Player } from "../engine/types";
import { hashSeed } from "../engine/rng";

/** Hairstyle names, indexed by Look.portrait. Index 4 (short twists) has no usable art and is never picked. */
export const HAIR = [
  "Cornrows",
  "Natural puff",
  "Sports hijab",
  "Side-part bob",
  "Short twists",
  "Braided bun",
  "Curly afro",
  "Tapered natural crop",
  "Twin Dutch braids",
  "Tied-back locs",
  "Curly high ponytail",
] as const;
export const VISIBLE_HAIR = [0, 1, 2, 3, 5, 6, 7, 8, 9, 10] as const;
/** Build name and the horizontal scale it applies to the portrait. */
export const BUILDS: readonly (readonly [string, number])[] = [["Lean", 0.97], ["Balanced", 1], ["Broad", 1.035]];

/** A new player's look: a random hairstyle, face and build. Face tweaks (eyes, nose, lips, jaw) start at the original. */
export function makeLook(key: string): Look {
  return {
    portrait: VISIBLE_HAIR[hashSeed(key, "hair") % VISIBLE_HAIR.length],
    build: hashSeed(key, "build") % BUILDS.length,
    face: hashSeed(key, "face") % 2,
    goggles: false,
    eyes: 0,
    nose: 0,
    lips: 0,
    jaw: 0,
  };
}

/** A player's look. Players saved before avatars existed get a stable one worked out from their id and name. Men have no artwork yet. */
export function lookOf(p: Player, gender: Gender): Look | null {
  if (gender !== "women") return null;
  return p.look ?? makeLook(`${p.id}|${p.name}`);
}

export const describeLook = (l: Look) => `${HAIR[l.portrait]} · ${BUILDS[l.build][0]}${l.goggles ? " · Rugby goggles" : ""}`;
