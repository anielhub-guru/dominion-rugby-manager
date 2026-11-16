# Era Prospect: design

Status: proposal, not built. Checked against the code on 2026-11-16.

## Purpose

Dominion already simulates full careers. This feature makes a few ordinary ones memorable.

The system does not write a player's story. It notices when the simulation has produced a story-shaped moment and records the few facts a user can build a story from. The rule for all text is: **juxtapose facts, do not explain their emotional meaning.**

> Released by Dominion two seasons ago, Daniel Okoro will make his first league start for Abuja Wardens, against Dominion.

No motive is stated. The user supplies it.

## Principles

- **No narrative protection.** An era prospect can fail to get a contract, never play, stagnate, get injured, or retire early. A short career is a complete story.
- **Rarity guarantees attention, not ability.** Potential is drawn from a credible range, not from the genius generator. The marker must not read as a promise of a star.
- **"Ordinary career" is a first-class outcome.** Twelve steady seasons with one move and one title can matter more than a superstar.
- **No stated emotions or labels.** No "determined", "disappointing" or "legend" in text the game writes about a specific player. Counts and records only.
- **Track only era players.** Everyone else keeps today's behaviour.

## What the code already provides

| Need | Existing support |
| --- | --- |
| Special-prospect precedent | `makeGenius` ([teams.ts:180](../src/league/teams.ts)), `Player.genius`, genius roll in `buildIntake` ([season.ts:866](../src/league/season.ts)) |
| Player identity across clubs | Ids are kept when a player is sold or bought (`structuredClone`), so one id can be followed |
| Career totals | `careerStats[id]`: `apps`, `points`, `tries`, `tackles`, `seasons` ([season.ts:129](../src/league/season.ts)) |
| Retirement hook | Retirement loop at [season.ts:816-837](../src/league/season.ts), already calls `recordRetirement` |
| AI replacement of retirees | Same loop: best of three generated prospects via `makeProspects` |
| Unpicked prospects | Sold in `completeOffseason` ([season.ts:1023](../src/league/season.ts)); news only, no record kept |
| Save migration | `migrateSave` is versioned; an optional field is trivial |

## What the code lacks

1. **Per-season history per player.** `seasonStats` is cleared every season, so "first regular season" and "first three seasons" cannot be derived. Solved by a small per-season record kept for era players only.
2. **Starts versus bench.** `apps` is one number. Either add a `starts` stat (touches `STAT_KEYS` and the match log) or word facts around appearances. Start with appearances.
3. **Awards.** Check what `awards.ts` records per player before promising "first major award" text.
4. **Head-to-head for a player.** Rivalry is club against club. "First match against the origin club" is computed at match time, for the era player only.

## Data

One optional field on `SeasonState`, plus a flag on `Player`.

```ts
interface EraProspect {
  id: string;            // player id, followed across clubs
  name: string;
  role: Role;
  originClubId: string;  // the club whose intake introduced them
  introducedSeason: number;
  status: "intake" | "unattached" | "playing" | "retired" | "closed";
  /** Era player who was not signed: the player object, kept off every roster. */
  waiting?: Player;
  /** Offseasons left in which an AI club may sign them. */
  windowLeft?: number;
  /** One line per season once playing: club and appearances. */
  seasons: { season: number; clubId: string; apps: number }[];
  /** Sparse permanent facts shown on the profile. */
  chronicle: { season: number; key: ChronicleKey; clubId?: string; value?: number }[];
}
// SeasonState.eraProspects?: EraProspect[]
// Player.era?: boolean   // like `genius`, marks the player in lists
```

Chronicle entries are facts keyed by type (`introduced`, `no-contract`, `joined`, `debut`, `first-regular-season`, `injured-long`, `returned`, `award`, `retired`). Text is built from them at display time, so wording can change without touching saves.

## Introduction

- Rolled in the offseason beside the genius roll in `buildIntake`, using its own seed key (`hashSeed(seed, season, "era")`) so reloading cannot reroll it.
- The era prospect takes the place of one shortlist prospect, in a vacated role if there is one. Never in the same intake as a genius.
- Potential: drawn from the normal prospect range with a modest upward spread, not 88+. Scouting noise as for any prospect, so the shortlist does not reveal the truth.
- One introduction cutaway. Wording states facts only: name, role, age, club, season.

### Frequency

Every ten seasons is too sparse for most users to ever see a career finish.

- 20-25% chance per offseason, with a guarantee after about 6 seasons without one (about one every 4-5 seasons).
- At most 3 live era players at once.
- Slow it down first if playtests show users cannot name them.

## If the manager signs them

They are an ordinary squad member with the `era` flag. Id and career follow them if later sold or bought. The profile shows the chronicle.

Guard: the sale code replaces the buyer's weakest player in the role ([season.ts:1000](../src/league/season.ts)). Era players must be excluded, in the same way the `listed` set already protects market players.

## If the manager does not sign them

No rescue mechanism and no vacancy tracking.

1. At `completeOffseason`, the unsigned era prospect is stored in `waiting` with status `unattached` and `windowLeft = 2`.
2. News and chronicle entry, neutral and sparse:

   > **No contract offered**
   > Daniel Okoro leaves the Dominion intake without joining a club.

   It does not say the story is over, because it may not be.
3. In each following offseason, inside the retirement loop, for each AI club that has a retirement in the prospect's role: roll a chance (about 50%, seeded `hashSeed(seed, season, "era-return", id)`). On success the prospect replaces that club's generated replacement instead of calling `makeProspects` for that slot. Their ratings get one normal evolve step per season spent waiting.
4. News when placed, facts only:

   > **A first chance elsewhere**
   > Released by Dominion, Daniel Okoro joins Abuja Wardens.
5. After the window closes (`windowLeft` reaches 0) without a club: status `closed`, chronicle ends. No further text.

If an AI club later lists them, the manager can buy them back through the existing market. No extra code.

## Presentation levels

1. **Cutaways** (structural only): introduction, retirement. A major breakthrough only if genuinely unusual.
2. **Highlighted news** (rare, five types to start): first appearance, first regular season, first match against the origin club, major injury, transfer back to the origin club.
3. **Chronicle** (profile): permanent sparse facts, for example
   ```
   S10 Entered Dominion's youth intake
   S10 Joined Abuja Wardens
   S12 Made league debut
   S25 Retired, aged 33
   ```

## Retirement summary

Computed from the record when the player retires. A player may match several patterns; the text picks the most evocative combination of facts. Patterns are summaries, not labels shown to the user.

`no_professional_contract`, `brief_career`, `ordinary_professional`, `late_bloomer`, `unfulfilled_potential`, `second_club_success`, `journeyman`, `one_club_servant`.

Examples of the text (facts only):

- "Bello retires with 137 appearances, two league titles and no individual awards."
- "Bello retires at 32. Her 14 league appearances all came during her first three seasons."

Variety comes from combining facts (club, seasons waiting, origin club, injuries, totals), not from writing many stories. Several lines per event, chosen by which facts are available.

## Build order

1. Era record, `era` flag, introduction roll and cutaway, unsigned handling and the delayed placement. Closing and placement messages.
2. Per-season record and chronicle on the profile.
3. Retirement summary from career totals (`apps`, `seasons`, `points`) and the per-season record.
4. Highlight news types, one at a time.
5. Optional: a `starts` stat to support start-based facts.

Step 1 alone is a playable test of whether users remember the name.

## Risks

- **Over-writing.** Too many events or any stated emotion destroys the imaginative space. Keep text to facts.
- **Dilution.** If marked players appear too often, the marker means nothing. Watch frequency.
- **Thin careers.** If few meaningful facts exist per career, summaries become generic. Steps 2-3 test this.
- **Silent deletion.** Era players must be protected anywhere the code replaces or removes a player (sale replacement, `acceptOffer` spare release at [season.ts:1137](../src/league/season.ts), retirement cleanup of `careerStats`).
- **Working-tree overlap.** `engine/types.ts` and `src/cutaways/` currently have uncommitted avatar changes. Settle those before touching the same files.

## Evidence that would lower the value

- Users do not remember the prospect's name.
- Chronicle lines feel the same as ordinary news.
- Users read the introduction as a promise of a star.
- Careers yield too few facts for varied summaries.
- Users feel cheated by "No contract offered".

## Out of scope

Branch managers, a general event bus, AI-written narrative, survival protection, a general release system, simulating careers outside the league.
