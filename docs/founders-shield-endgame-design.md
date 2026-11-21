# Founders' Shield Endgame Design

## Purpose

Create a long-term storyline that gives Dominion League a meaningful endgame without imposing a normal stopping point. Players can secure the league's independence and continue indefinitely, but losing the ownership campaign produces a genuine career ending.

## Story Premise

Dominion League is owned by **Mrs. Rakido Kasham Daniel**, a successful businesswoman and former player.

After the player fully develops their club, Mrs. Daniel reveals that the rival **Pinnacle League** has acquired the right to challenge for control of Dominion League.

Ownership will be decided through the **Founders' Shield**: an annual knockout tournament between five Dominion clubs and five Pinnacle clubs.

## Storyline Trigger

The storyline becomes eligible only when every player-controlled facility reaches level three.

The postseason request then has an increasing chance of appearing:

- First eligible postseason: 25%
- Second: 50%
- Third: 75%
- Fourth and later: 100%

The probability remains hidden from the player.

At 100%, Mrs. Daniel makes the request every postseason. The player can still decline indefinitely.

### Declining

Declining carries no gameplay penalty. Mrs. Daniel responds:

> "Very well. I'll hold them off for another season."

The request returns during a future postseason according to the current appearance probability.

Once the player accepts, the ownership campaign begins and the Founders' Shield runs annually until one league wins the campaign.

## Tournament Participants

Each Founders' Shield contains ten clubs:

- The player's club
- Four other Dominion League clubs
- Five Pinnacle League clubs

The four additional Dominion clubs are selected by their final league position.

The five Pinnacle clubs are generated when the storyline begins. Their identities and tournament records persist across seasons so the player can develop recognisable rivalries with them.

## Tournament Structure

The tournament is a straight knockout.

### Preliminary Round

Four clubs play two preliminary matches, reducing the field from ten clubs to eight.

- The player's club always receives a quarter-final seed.
- Two additional Dominion clubs receive seeds based on league position.
- Three Pinnacle clubs receive seeds.
- The remaining two clubs from each league contest cross-league preliminary matches.

### Main Bracket

The remaining eight clubs play:

1. Quarter-finals
2. Semi-finals
3. Founders' Shield Final

Cross-league pairings should be prioritised where the bracket permits them.

The player controls only their own club. Every other match is simulated by the existing match engine.

## Ownership Campaign

The Founders' Shield operates as a best-of-nine ownership campaign.

Each annual tournament victory adds one point to the winning league:

> **Dominion 3 — 2 Pinnacle**

The first league to win five tournaments decides ownership.

Results never reset. Every tournament permanently advances the storyline.

## Player's Narrative Role

Any Dominion club can win the tournament and successfully defend the league.

The player remains the central character because:

- Their club is the only human-managed participant.
- Their completed facilities and developed squad should make them one of Dominion's strongest representatives.
- Their club always receives a quarter-final seed.
- Personal victory receives the strongest celebration and recognition from Mrs. Daniel.

If the player is eliminated, another Dominion club can still rescue the league. No artificial penalty is applied, but Dominion's chances naturally fall because its human-managed and usually best-developed club has been removed.

If another Dominion club wins after the player is eliminated, Mrs. Daniel says:

> "They kept us alive. Next season, I want the Shield in your hands."

## Campaign Outcomes

### Dominion Wins Five Shields

Dominion League permanently defeats the takeover attempt.

The game presents:

- A victory scene with Mrs. Daniel
- The complete Founders' Shield campaign history
- The player's personal tournament record
- Clubs defeated and Shields personally won
- Recognition of the player's role in preserving the league

The ownership storyline ends, but the player's career and normal seasons continue indefinitely.

### Pinnacle Wins Five Shields

Pinnacle League takes control of Dominion League.

This produces the genuine career ending:

- A final scene with Mrs. Daniel
- The complete campaign history
- The player's career and legacy report
- Final trophies, records, finances and notable players
- An option to begin a new career

## Non-Functional Requirements

- Reuse the existing deterministic match engine.
- Store all campaign state inside the existing local save.
- Introduce no backend, accounts, analytics or personal-data collection.
- Migrate existing saves with safe default values.
- Persist Pinnacle club identities and campaign history.
- Add negligible loading or simulation overhead.
- Keep tournament logic separate from normal league standings.

## Explicit Non-Goals

- Mrs. Daniel's former-player backstory and wider era content
- A complete Pinnacle League season
- Controlling other Dominion clubs
- Online tournaments or leaderboards
- Forced acceptance of the tournament request
- Implementing the feature during the design phase

## Decision Log

1. The endgame is an optional storyline rather than a mandatory career limit.
2. Mrs. Rakido Kasham Daniel owns Dominion League and personally issues the request.
3. The rival organisation is called **Pinnacle League**.
4. The ownership tournament is called **The Founders' Shield**.
5. Completing every facility to level three unlocks the storyline.
6. The request probability rises from 25% to 100%.
7. The player may decline indefinitely, including after the probability reaches 100%.
8. The player controls only their own club.
9. Any Dominion club can win an annual defence.
10. The tournament uses five Dominion and five Pinnacle clubs.
11. Pinnacle club identities persist between seasons.
12. The player's club receives a quarter-final seed.
13. Ownership uses a best-of-nine campaign rather than five consecutive victories.
14. Dominion winning five Shields ends the threat but not the career.
15. Pinnacle winning five Shields produces the genuine career ending.
