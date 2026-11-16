# Avatar and silhouette artwork pipeline

This is the canonical workflow for player hairstyles, headgear, avatar appearances and related image transformations. The preview tools stay outside Dominion League; only approved artwork and mappings are imported into the game.

## When this workflow applies

Before changing artwork, classify the request:

| Request | Avatar page | Silhouette Lab | Game import |
|---|---:|---:|---:|
| New hairstyle or headgear used by players | Required | Required | Required |
| New base face or avatar facial treatment | Required | Only if it changes the action silhouette | Required |
| Eyes, nose, lips or jaw deformation | Required | Not currently represented | Required for avatar code only |
| New cutaway pose or action-only redraw | Not required | Required | Required |
| Colour, cleanup or other image transformation | Update every surface that uses the changed source | Update if visible in cutaways | Required for affected assets |

Do not mark a hairstyle or headgear request complete after changing only one surface.

## Current ownership and mapping

- `dominion-player-avatars.html` is the appearance workspace. It previews six hairstyle slots, two base faces, three builds and facial deformations.
- `dominion-multi-test.html` and `dominion-solo-test.html` are the action-silhouette workspaces. They currently support five Lab hairstyles and build scaling, but not avatar facial deformations.
- `src/assets/avatars/` contains the avatar WebP files used by Dominion League.
- `src/league/look.ts` owns game hairstyle names, visible selection and build definitions.
- `src/viewer/avatar.ts` owns avatar asset imports, face landmarks and rendering.
- `src/cutaways/data.ts` maps each game hairstyle to a Lab hairstyle through `LAB_HAIR`.
- `scripts/extract-cutaway-art.mjs` imports approved Lab artwork into `src/cutaways/art/`.

| Game index | Avatar hairstyle | Lab index | Lab hairstyle |
|---:|---|---:|---|
| 0 | Cornrows | 0 | Original braided ponytail |
| 1 | Natural puff | 2 | Natural puff |
| 2 | Sports hijab | 3 | Sports hijab |
| 3 | Side-part bob | 4 | Bob cut |
| 4 | Short twists | 0 | Fallback; avatar slot is not currently selectable |
| 5 | Braided bun | 1 | Braided bun |

Indices are saved in player data. Append new styles; do not reorder or reuse existing indices.

## End-to-end procedure

### 1. Create and approve the avatar appearance

Work in the sibling `dominion-silhouette-lab/dominion-player-avatars.html` page.

1. Add a clear, stable hairstyle or headgear name.
2. Produce aligned artwork for both base faces. A new portrait index needs one image in `artwork` and the matching image in `alternateFaces`.
3. Add the index to `visibleHair` only when both face variants are approved.
4. Add face landmark measurements for the new crop to both rows of `faceY`.
5. Check all builds and facial controls in both White Outline and White Silhouette preview modes.
6. Export the two approved WebP files for the corresponding `aN.webp` and `bN.webp` game slots.

### 2. Carry the style into the Silhouette Lab

Update both `dominion-multi-test.html` and `dominion-solo-test.html`.

1. Give the style one Lab index and the same user-facing name in both pages.
2. Create the style for every supported action pose, including the artwork collections used by `mainLooks`, `extraLooks` and `jackalArt` where applicable.
3. Preserve the shared scalp anchor, framing, transparent background and pose geometry. Follow `SPRITE-SPEC.md` for generation and measurement rules.
4. Test single-athlete and multi-athlete scenes, including pairings where the athletes have different hairstyles.
5. Follow `TESTING.md` and check all approved entry and exit transitions.

### 3. Import only approved work into Dominion League

1. Add the avatar files to `src/assets/avatars/` without replacing an existing index.
2. Append the hairstyle name and selectable index in `src/league/look.ts`.
3. Import both face assets, extend `FACE_ART`, and add both face-landmark entries in `src/viewer/avatar.ts`.
4. Extend `LAB_HAIR` in `src/cutaways/data.ts` with the matching Lab index.
5. Update `scripts/extract-cutaway-art.mjs` so its alternate-look count includes the new Lab style; it currently assumes four alternatives plus the original style.
6. Import the cutaway artwork:

   ```sh
   npm run cutaways:extract -- /path/to/dominion-multi-test.html /path/to/dominion-solo-test.html
   ```

7. Run `npm test` and `npm run build`.

## Completion checks

- Both avatar face files exist and render at the same portrait index.
- The new index was appended rather than inserted or reordered.
- The avatar page works in outline and silhouette modes.
- Both Lab pages use the same hairstyle name and Lab index.
- Every supported cutaway pose has artwork for the new Lab hairstyle.
- `LAB_HAIR` has one entry for every game hairstyle and every value names an existing Lab hairstyle.
- Existing saved players retain their original appearances.
- Tests and the production build pass.
- The Lab UI itself has not been added to Dominion League.

## Decision log

- The workflow remains manual; automatic synchronization is not required.
- The Avatar page remains the starting point for player appearances.
- The Silhouette Lab remains the approval and action-pose workspace.
- Dominion League receives only approved assets, mappings and renderer updates.
- This document is the canonical cross-project workflow; repository `AGENTS.md` files point agents here.
