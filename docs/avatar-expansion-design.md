# Women’s avatar hairstyle and goggles expansion

## Understanding summary

- Add five practical women’s rugby hairstyles with distinct portrait and action silhouettes.
- Preserve the existing monochrome, hand-illustrated visual style and colour treatment.
- Append all new hairstyle indices so existing saved players keep their appearances.
- Carry every approved hairstyle through the Avatar page, both Silhouette Lab pages and Dominion League.
- Add rugby goggles as the only equipment item and keep them independent of hairstyle.
- Prefer the simplest maintainable implementation over a general layered-equipment system.
- Keep the Silhouette Lab as an external approval workspace; import only approved artwork into the game.

## Assumptions and non-functional requirements

- Existing portrait dimensions, local asset loading and render performance remain unchanged.
- Existing saves may omit the goggles field and must render exactly as they do now.
- Newly generated players receive the expanded hairstyle selection but goggles remain off by default.
- Customization remains local static artwork and introduces no new network, security or privacy requirements.
- The existing manual artwork approval and import workflow remains the maintenance model.
- Men’s avatars, new colours, additional gear and automatic Lab synchronization are outside this scope.

## Approved appearance set

Append these five hairstyles without reordering or reusing existing indices:

1. **Curly afro** — a loose-curled, medium-volume afro with a rounded but naturally asymmetric outline. The user-supplied rugby photograph from 16 November 2026 is the primary shape reference. This is distinct from the existing compact natural puff.
2. **Tapered natural crop** — short sides with textured natural height. Reference: [Simi Pam](https://www.rugbypass.com/news/simi-pam-a-journey-of-passion-perseverance-and-inclusivity/).
3. **Twin Dutch braids** — two tight, clearly separated plaits that remain visible in a front-facing crop. Reference: [match-ready women’s rugby braids](https://www.irishtimes.com/gallery/life-style/fashion/2023/03/24/no-bad-hair-days-for-women-rugby-players-during-the-six-nations/).
4. **Tied-back locs** — medium locs gathered into a low athletic ponytail, with readable side sections. Reference: [Brown women’s rugby](https://brownbears.com/news/2025/4/19/womens-rugby-places-third-at-ivy-league-7s-tournament).
5. **Curly high ponytail** — loose curls flowing backward from a high tie rather than forming a compact puff. Reference: [Shaunagh Brown](https://www.therugbyjournal.com/rugby-blog/shaunagh-brown).

Practicality references include [women’s rugby match-day plaits](https://www.irishtimes.com/life-style/2023/03/24/match-ready-hair-if-its-not-tight-and-tucked-away-its-like-james-lowe-on-the-wing/) and [natural and protective hair in women’s rugby](https://www.skysports.com/rugby-union/news/12981657/simi-pam-explores-why-hair-can-be-a-barrier-for-black-women-in-taking-up-sport-and-exercise).

## Goggles design

Rugby goggles are the only approved equipment item. Their shape must follow the rounded, continuous form described by the [World Rugby goggles specification](https://www.world.rugby/the-game/facilities-equipment/equipment/specifications/goggles).

- Extend `Look` with `goggles?: boolean`; a missing value means `false`.
- Keep goggles off for existing and newly generated players unless explicitly selected.
- Render goggles as an independent monochrome overlay so they work with current and future hairstyles.
- In portraits, draw the curved front frame and short temple tabs rather than a full strap over flattened hair artwork.
- Draw the overlay before facial deformation so the frame and facial features transform together.
- In action silhouettes, use a simplified frame-and-strap mark only where the head is large enough to remain readable.
- Offer an **Off / Rugby goggles** control in the Avatar page.

## Data and artwork flow

1. Create two approved portrait assets for every new hairstyle in `dominion-player-avatars.html`.
2. Append the new names and indices without changing existing saved meanings.
3. Add each style at one matching index in both Silhouette Lab pages and complete every supported action pose.
4. Add the ten approved WebP portraits to `src/assets/avatars/`.
5. Extend the hairstyle lists, portrait imports, face landmarks, Lab mappings and cutaway extraction count.
6. Pass the optional goggles flag through portrait and cutaway rendering without multiplying hairstyle assets.
7. Import only approved Lab artwork into Dominion League.

## Validation plan

- Verify both base faces, all three builds and every facial-control combination.
- Verify goggles with every existing and new hairstyle, including the sports hijab.
- Check both White Outline and White Silhouette preview modes.
- Check every single-athlete and multi-athlete pose, including mixed hairstyles.
- Remove interior lens detail at sizes where it creates visual noise.
- Confirm old saves without `goggles` render identically.
- Confirm random hairstyle assignment includes the five appended styles but never enables goggles.
- Follow the Lab transition checks, then run the game test suite and production build.

## Decision log

| Decision | Alternatives considered | Reason |
|---|---|---|
| Preserve the current monochrome illustration style | Introduce accessory colours | Visual consistency and lower production cost |
| Add five silhouette-balanced hairstyles | Add a braid-heavy set | Greater visible variety with less overlap |
| Name the supplied afro reference **Curly afro** | Generic rounded afro | Accurately reflects its loose curl pattern |
| Support only rugby goggles | Scrum cap, headband, tape, sleeves and other gear | Goggles are visible, rugby-valid and do not hide hair |
| Store `goggles?: boolean` | Bake goggled duplicates into every portrait | Avoids doubling current and future artwork |
| Default goggles to off | Random assignment | Preserves existing appearances and keeps equipment intentional |
| Append hairstyle indices | Reorder or reuse indices | Protects saved-player compatibility |

