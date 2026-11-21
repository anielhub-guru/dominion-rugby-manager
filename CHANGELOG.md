# Changelog

Versions follow `MAJOR.MINOR.PATCH`. The version lives in `package.json` and is mirrored in
`src-tauri/tauri.conf.json`, `src-tauri/Cargo.toml` and `src-tauri/Cargo.lock` (a test fails if they
drift apart). It is shown in the app footer and on the new-game screen.

## 0.13.0

- Sound. Matches now have a Nigerian stadium soundtrack, all synthesised in the app (no audio files). A supporters'
  section roars and swells as play nears a try line, and a band of shekere shakers, congas, an agogo bell, a dundun and a
  talking drum plays highlife-style phrases with plastic corneta horns and hand claps. Derbies are louder.
- Pitch sounds: the referee's whistle (kick-off, penalties, cards, half time, a triple blast at full time), boot on ball,
  tackles, and the ball ringing off the upright.
- The crowd reacts to the match from your club's side: a roar, horns, drum roll and chant for your try, groans when the
  other side scores, a gasp and groan for a kick off the post, cheers for their misses, boos for a red card against you
  and a hush for an injury. Replays are neutral.
- Sound controls (a mute button and a volume slider, remembered between matches) sit in the match controls. Sound pauses
  with the match, drops to a murmur while skipping, and thins out at 4x and 8x so fast play stays clear.

## 0.12.0

- The Founders' Shield: a long-term ownership storyline (see docs/founders-shield-endgame-design.md). When every
  facility at your club is level 3, Mrs. Rakido Kasham Daniel may ask you, after the last matchday, to defend Dominion
  League against Pinnacle League. The chance rises with each eligible postseason (hidden from you) and is certain from
  the fourth. Declining costs nothing and she asks again later.
- Once accepted, a ten-club knockout is played every postseason: you, four Dominion clubs by league position and five
  persistent Pinnacle clubs. Two preliminary ties, then quarter-finals (you are always seeded in), semi-finals and the
  final. Level matches are settled on tries; if tries are level too, a sudden-death golden-point period is played out with real tries, kicks and highlights until someone scores. Shield matches use rested squads and do not touch
  the league table, stats, injuries or money. Watch your own ties live or quick-sim them; the rest use the match engine.
- Each Shield scores a point for the winner's league, first to five. Five for Dominion ends the threat and the career goes
  on; five for Pinnacle ends the career, with a campaign history and legacy report and the option to begin a new career.
- New Shield tab with the campaign score, history, Pinnacle clubs and your own record. Saves migrate to version 11.

## 0.11.2

- Followed careers sharing a club now get live context in the History tab. It distinguishes players competing for
  the same natural position, who currently holds that slot, out-of-position starts, and followed teammates in other
  positions who can be selected alongside them.

## 0.11.1

- Followed players: the first match against a former teammate now gets a chronicle line (with the seasons they shared
  and who scored), and so does a return to the club whose intake introduced them, whether they were once on its
  books or not. At most one reunion is told a season, for the teammate they shared most seasons with.

## 0.11.0

- History tab: followed careers are now tabs, one per player. Live careers come first, newest first; players who have
  retired or left the league follow, greyed and marked "retired" or "closed". The first tab is open by default.
- Followed players now have stories against other clubs. The chronicle records the first meeting with the club that
  introduced them (whether it passed on them or they left it), with the score and whether they scored. Across a
  career it also notices scoring runs against a club, long droughts (only for players who score elsewhere), unbeaten
  runs and runs of defeats, scoring duels and one-sided contests with a player from another club, matches where both
  were carded, and a season finishing top of, or just behind, the league's scoring charts. A pattern is told again
  only after it has grown by a few meetings, and a season adds at most three of these lines. The History tab splits
  "Alongside" into Teammates and Opponents.
- Story moments for followed players. The match engine now records who scored each try and who carried in the phase
  before (a try assist, or the kicker on a grubber or chip), and late goal-line defence by a side narrowly ahead.
  When a season closes, the History tab's chronicle can add up to one deciding moment (the try or kick that won a
  match, or the last big stop in a narrow win) and up to two patterns with a teammate (setting up their tries, being
  set up by them, scoring in turn over five or more matches, scoring in the same match four or more times), plus a
  line when they took over from a retiring player's role. Most seasons add nothing. Wording comes from banks of
  variants with colour words (such as "a friendly rivalry" or "a dependable supply line"), chosen steadily per entry.
  Matches played before this version carry no assists.
- History tab: each followed career is now its own panel, with a status tag, a one-line summary, the story as a
  timeline (moments and teammate patterns stand out from plain facts), an "Alongside" column for teammates, and the
  season-by-season table underneath. Live careers come first.
- Story moments: one reusable announcement popup (`showStory` in `src/viewer/story.ts`) with a tag, title, text, optional
  picture and a button. Moments queue, so two in a row never stack. The followed-player announcement uses it, and
  signing a followed player now gets its own moment when you confirm the offseason. Future events can call it too.
- Followed players: the FOLLOWED tag now shows wherever the player is named (squad, stats, scouting, training, the
  offseason lists, recommendations and compare), including while they are marked RETIRING or SELLING. The History
  tab tells more of the career: age and overall on entering the intake, and for each season the club's league finish,
  age, overall and appearances out of matches, plus a line when their club won the league. Seasons recorded by older
  saves show a dash for what was not kept.
- Club facilities, on their own Projects tab (key 4; the others move along one). Build a Training ground (one more
  player trains each matchday), a Medical centre (injuries last a match less, never under one, and tired players
  recover faster) or a Youth academy (prospects arrive with +2 potential). Each has three levels costing 1m, 2m and
  3m, paid up front. Construction takes matchdays (3, 5 and 7), only one project runs at a time, and time only passes
  when matches are played. News items about projects link to the tab, and the Overview and Training screens point to it.
  Facilities belong to the club: if you move on, a project in progress is finished for the club you leave.
- Genius discovery. A youth academy can turn up a genius in the offseason (10% a year per level): a teenager with a
  potential of 88 or more, marked GENIUS on your youth shortlist.
- Facility offers. In the offseason an offer to upgrade your least developed facility may arrive, in one of three
  forms that all end the same way: a board offer (the whole cost comes out of your budget), a sponsor who pays all of
  it, or a sponsor who pays half. A sponsor wants a promise in return: you stay at the club for a number of seasons
  and no other club can approach you until then. The cost leaves your budget the moment you accept, and if you cannot
  afford your part the offer cannot be taken. It lapses after matchday 6 and uses your one construction slot.
- Deals, on their own tab (key 5; Table, Fixtures and History move along one). Money for meeting a target, in two
  sizes that work the same way.
  - Sponsor deals are season-long. Up to two sponsors make offers each offseason, to be accepted before matchday 3,
    and two can run at once. Targets: play a named squad player in 7 matches, finish in the top N, win N matches, keep
    the opposition scoreless N times, or lose no more than N. They are set from your squad's strength. A met deal
    pays out and a missed one costs 30% of the reward, both in the end-of-season finances.
  - Fan challenges are one match. Before some matches the supporters set a challenge: beat this club, beat your
    rivals (a rival match nearly always gets one), win, do not lose, or play a named player. Take it or pass. They pay
    straight after the match if you meet it, and nothing is lost if you do not.
  News items about deals link to the tab, and the Overview shows the supporters' challenge and the deals running.
  Taking another job drops your deals and brings the new club's own offers.
- A calendar. Each season is a year (the header shows it), and an era will last ten seasons whatever your results.
  New games start in 2020 for now. Saves upgrade to version 10.

- Auto select modes. A dropdown beside Auto select on the squad screen lets you choose how it picks. New: Most rested, which picks the freshest players for the starting five and
  bench (ratings and positions only break ties) and sends the most tired to the reserves. Banned and injured players
  are still left out.
- Derbies. Your matches against your rival (the club you have the most history with) are now derbies: marked RIVAL ·
  DERBY on the fixture list, with a DERBY badge on the scoreboard and match centre, and now and then a line of derby
  commentary. They play differently, for both sides alike so they cannot be farmed: the gap between the two teams
  shrinks by 20% (the underdog has a real chance, the favourite is not safe), and a penalty is 25% more likely to
  bring a card. The match against the club that gave you your heaviest defeat is still only a story.
- Injuries. Tackles can hurt the runner or the tackler, more often on hard tackles (line breaks) and on tired legs.
  The hurt player comes off for the best player on the bench (a free substitution, it does not use one of the
  three) and the commentary says what happened. About a third of injuries are only a knock; the rest keep the
  player out for 1 to 5 matches (a sprained ankle, a torn calf, a dislocated shoulder). No injury can end a season,
  and everyone heals over the offseason. An injured starter is replaced in your starting five with a note in the
  club news, an injured player cannot be picked, and the Squad tab shows INJURED with the matches left. Rare: about
  one lasting injury per club every season and a half. Injuries use their own random stream, so a match with none
  plays out as it always did.
- Longer bans for dangerous play. A straight red is now for a named offence, and the ban depends on it: a badly
  mistimed tackle (2 matches), a dangerous high tackle (3), a swinging elbow (4) and, very rarely, a spear tackle (5).
  A second yellow is still one match. The commentary names the offence and the ban, the club news says how long, and
  the Squad tab shows BANNED with the matches left. A red for a dangerous tackle on a runner often injures the
  runner too. Match logs record each ban; older saves and logs count every red as one match.
- Extra squad places. Winning the league, or smashing the board's goal, now earns one more place in your squad on top
  of the ten, up to two extra (twelve players). It is depth, not another starter: the extra players are reserves,
  outside the matchday eight, for cover when someone is hurt or banned. You do not have to fill it and a bigger
  squad costs more in wages. The season review announces it, the offseason accepts a squad of ten up to your
  capacity, and the default plan fills it. If you move to another club the places stay behind and the club you leave
  drops back to ten.
- Injury cutaway (placeholder). An injury now triggers a cutaway in both leagues, drawn as a plain "PLAYER DOWN" card
  with the player's name and a note that the art is still to be drawn. It is listed under "Art needed" in
  `src/cutaways/README.md`, with how to replace it.

- Weather. Each match now has a sky, picked from the match id so a replay shows the same weather: clear (about a third
  of matches), drizzle, rain, heavy rain, windy (dust and leaves blown across), harmattan haze (a dusty amber wash),
  sunny (a warm glow with soft rays) or hot (orange warmth and rising heat shimmer), with a wind direction. It is drawn
  over the arena and the illustrated cutaways, the match header names it, and the commentary mentions it at kick-off,
  half time and now and then on knock-ons, kicks, tries and missed goal kicks. It is cosmetic: it never touches the
  match random stream, so results are unchanged, and clear matches read exactly as before. It is skipped when the
  system asks for reduced motion. The Match Centre shows a one-line report under the fixture before kick-off
  (for example "☀️ Sunny · 31°C · Light breeze").
- A frequency menu in the Cutaways control (Rare, Normal, Often, Lots) sets how likely each moment is to get a cutaway,
  how many play in a match and how far apart they are. Often is the default and Normal is the old behaviour; the choice is remembered.
- Offseason screen redesign. The league table is gone from this screen. The recruitment advice now comes first, as
  cards with large portraits, and the confirm button sits at the top. A compare panel stays in view beside the lists:
  click any player (in a list, on a recommendation, or a name in the scouts' notes) to put them on the spider chart
  next to one of your own, picked automatically by position or from a menu, with Sign, Buy or Sell right there.
  A second tab keeps the squad view of now against after your plan. Lists show portraits.
- Recruitment advice. The offseason now fills the empty space beside the squad with up to three suggestions: the
  weakest or empty positions after retirements and your current plan, each with the best youth prospect or
  transfer-listed player for it, what it costs, and whether the scouts think the price is cheap, fair or steep. A
  Sign or Buy button adds them to your plan, and the advice updates as the plan changes. It also flags a listing
  that looks overpriced. It uses only scouting information, never hidden potential. The offseason intro text is
  shorter.
- Fixed the play-time clock: the running total went back to zero on every launch, because the startup key
  migration in storage swept up its old `arena:` key. It now uses a `dominion:` key. The season review also gains
  an "around the league" card (champions, top scorer, best attack and defence, and where your club ranks).
- Season review. When a season ends, the empty space on the Overview now shows how it went: your finish against
  last season, record and points, whether you met or smashed the board's goal and the bonus it pays, the prize
  money, wage bill and balance that starting the next season will apply, best win and heaviest defeat, player of
  the season and the squad's stat leaders, the three best developed players (training points plus the offseason
  growth their playing time has earned), and any club records broken.
- Match experience. Playing matches now develops players, not just training. At the offseason a player's growth
  toward potential is scaled by the share of the season's matches they played: for under-22s from 0.4x on the
  bench to 1.2x as an ever-present, for 22 to 27 from 0.7x to 1.2x. Veterans from 31 who played at least half
  the matches fade more slowly. Potential and star ratings are unchanged, so a benched prospect reaches their
  ceiling later rather than never. Weekly training is still random, so players who are not picked can still
  catch up. The Player progress table shows each player's appearances and a pace tag (Fast, Steady or
  Stalling: needs games). AI clubs follow the same rules.
- Added a fictional-content disclaimer to the league picker screen and the README.
- Two kick-off cutaways: the captain calls the team in, or a winger shows for a pass. One side is picked at random and the captain is its oldest player.
- Four more illustrated cutaways: an interception, a missed kick at goal, a scored kick at goal (conversion,
  penalty or drop goal) and a grubber or chip and chase. The kick and chase drawing shows the kick itself, so it
  plays before the arena scene; the others show a result or a reaction and play after it.

## 0.10.0

- Illustrated cutaways in the women's league. Now and then a moment is shown as a detailed drawing over the
  arena: a card, a try (an open dive, diving through an ankle tackle or breaking a waist tackle, or the
  celebration), a big hit or waist-wrap or double-team tackle, a last-ditch cover tackle, and a jackal
  turnover. The players drawn wear their own hairstyle. They are chosen at random, two or three a match (never
  twice within seven match minutes), and a replay shows the same ones. A Cutaways control under the match view picks how they
  cut in (forward diagonal, split slash or hard cut) or switches them off, with an optional impact shake;
  the choice is remembered, and reduced-motion systems start with them off. They live in `src/cutaways`,
  which can be updated on its own (see its README).

## 0.9.0

- Player avatars. Every player in the women's league is created with a look: one of five hairstyles, one of two
  base faces and a build (lean, balanced or broad). The squad screen shows the avatar of the player you last
  clicked, or your first starter, with their name. Player of the match (on the overview and the full-time panel) and the best player on each
  side show their avatar too. Prospects, reserves and new signings get a
  look the same way, and players from older saves are given a stable one. The men's league keeps its placeholder
  until its artwork exists. The look also stores eyes, nose, lips and jaw adjustments (all at the original for
  now) ready for a future customise option.
- Rare long-range drop goal: about one in ten territory kicks that would have run dead is instead a monster kick
  that holds its line and splits the posts for three points. The arena shows the usual towering kick, then it
  goes over the bar instead of running dead.
- Season goal bonus: meeting the club goal at the end of the season pays a cash bonus (₦600k), and smashing it
  pays more (₦1.5m), each with a line of board flavour text in the club news. Smashing it means finishing two
  or more places inside the goal, or, for a title goal, winning the league by six points or more.

## 0.8.1

- The overview now has a Season goal and rivalry card under the last result. It shows your club goal with the
  position it needs, whether you are on track or behind and by how many points, and the matchdays left. Below
  it sit your rival (record, streak and next meeting) and the club that gave you your heaviest defeat.
- Club news moved under the league table on the overview.

## 0.8.0

- New History tab (key 6). Champions by year: champions, runners-up, the league's top scorer, your own finish
  and a title count per club.
- Club records, kept per club: biggest win, most points and tries in a match, most league points in a season,
  and the best player performances in a match and in a season. Each club starts with generated founding
  records that follow the club's strength (strong clubs start higher), and they fall as seasons are played.
  Breaking one of your club's records appears in the club news. Pick any club to see its records.
- Retired legends: a player who retires after three or more seasons is remembered by the club they retired
  from (best eight kept per club), with their career line. No hall of fame. Save version 9; older saves get
  founding records and start recording legends from the next retirement.

## 0.7.0

- Job offers: after two or more seasons, other clubs may approach you. Good results bring strong clubs, middling
  ones mid-table clubs, and poor form only a rare lifeline from a bottom club. Taking a job moves you to that
  club with its squad, a mandate and a new bank balance; your old club carries on under the computer. Turning
  down strong offers makes the next approach a little less likely. Offers judge only your record at your
  current club, and the club goal follows your last finish there. Save version 8.
- New Training tab: pick the focus and see what each player has gained this season. Training no longer wastes
  a slot on a player who cannot improve, and the choice of who trains is now an unbiased shuffle.
- New highlights: carries held up on the line (with a few different looks), sixth-tackle turnovers deep in
  the opposition half, and kicks that bounce into touch.
- The Gamble team talk is now called All in.
- Rivals: every pair of clubs keeps a head-to-head record, and after three meetings your closest history becomes
  your rival. Games against them get a rivalry line at kick-off and full time, plus a line in the club news. Fixtures show a RIVAL tag, and a separate LOST BY tag marks the club that beat you
  by the widest score (14 points or more), with its own kick-off line.

## 0.6.0 (stable alpha)

- Matches are more draining (fatigue 0.65), so substitutions matter. Tiredness now carries between matches:
  playing a lot builds it, resting clears it, and both scale with the player's stamina. Tired players start
  weaker and tire faster; the Squad table shows a Weary/Tired tag. It resets each season.
- AI clubs rest worn-out starters and make their own substitutions (at most two, never for your club). Each
  club has its own coaching temperament, with some randomness every match.
- Defensive shapes rebalanced: Sweeper back beats a quick Winger, Flat line beats power forwards, Narrow
  edges a balanced attack.
- Fixed a runner who had beaten the defence turning back to be tackled. A chased carrier's top speed now
  fades gradually, he never steers backward into the tackle, and nobody can run off the end of the field.

- The ball no longer spins in a player's hands. It now moves by what happened to it: passes spiral
  (pointed, laces turning), long kicks tumble end over end, chips turn slowly, grubbers skip and wobble.
- New grubber and chip and chase near the line (a chaser races a defender for the ball in-goal; a try,
  a covered ball or a dead ball). Attacking sides try them most, Defensive least.
- Attacking sides now string several passes together before the runner is released.
- Tackles need real contact. The tackler now chases the carrier (faster than a runner with the ball) and the hit
  only lands when the two touch, instead of firing on a timer. The carrier keeps running and shifts line until he
  is hit, instead of stopping to wait for the tackle.
- Passes before a try now vary with how close the line is. Within 12 m the player just takes it and goes
  (or one short pass); within 25 m no long loops or chains; passing chains are 2 to 4 passes, not a fixed count.
- AI clubs now train too, at a slower rate than you: about half a point a week for one player, up to the
  player's potential, instead of none.
- Try animation: the ball stays in the scorer's hands until it is grounded, so it no longer looks thrown.

## 0.5.0

- League picker redesigned: pixel-art man and woman on the Men's / Women's league cards, left-aligned
  layout and a hover effect.
- Spider (radar) chart of the six ratings. Squad tab: **Team shape** (your starting five against the next
  opponent or the league average, with the ratings your tactic leans on marked) and a **Player profile**
  when you select a player. Offseason: your best five now against after your plan, and a profile of any
  player you click (yours, a prospect or a listed player) against the player they would replace.
  Counting stats stay in the table, since a radar suits ratings but not mixed-unit stats.

## 0.4.0

- Attacking is now strong only for the right side. Its bonus scales with the pace and handling of your
  starting five; a side without them makes more errors and is countered when it loses the ball. Before, it
  won 55 to 70% of matches whatever the squad. Now (same overall rating, vs Balanced): about 40% when
  unsuited, 53% neutral, 61 to 68% when well suited. The Squad tab shows how well your five suits it, and AI
  clubs that cannot play it fall back to Balanced.
- Offseason screen replaces the single prospect pick: sell any player, sign any prospect from the youth
  shortlist (replacing anyone you choose, not just your oldest), and optionally buy from the transfer list.
- Money: match winnings, prize money by finishing position, sales, and unpicked prospects sold; a wage bill
  that grows with squad quality. Player value depends on ability, young potential and age. Only the manager's
  club keeps a balance. Transfer listings favour veterans and bench players and are priced by true value,
  while you only see a noisy potential estimate, so deals and traps are real. At most 2 signings a window.
- Debt never blocks the season, it only stops you buying.
- Saves are version 6; versions 3 to 5 are upgraded on load.

## 0.3.0

- Player lifecycle: every player has a hidden potential. Youngsters grow toward it, veterans fade and
  lose potential, and players retire from 31 (certain by 35). Previously nobody ever left, and by season 40
  the league was full of 65-year-olds at the rating floor. Now it holds steady: tested over 50 seasons.
- Offseason decisions: a scouted shortlist of three prospects for each retiree (potential shown as a
  noisy 1 to 5 star estimate), plus an optional succession signing for your oldest player. The new season
  starts when you confirm. AI clubs take their best prospect automatically.
- Training now stops at a player's potential, and new talent depends less on a club's fixed tier, so the
  champions change over the years instead of one club winning for ever.
- The previous save is kept as `season.bak.json`.
- Saves from 0.2.x (version 4) are upgraded on load. New `Pot` column in the Squad tab for your club.

## 0.2.0

- Nigerian clubs and player names; choose the men's or women's league at the start of a new game.
- Cards: yellow (sin bin) and red (sent off, one-match ban), a man down is felt in the match.
- Defensive shape (sweeper back, flat line, narrow) with scouting advice for the next opponent.
  The game pauses to ask how to cover when one of your players is carded in a match you watch.
  Tactic and shape are visible in the highlight animations.
- Player of the match, best player on each side, and a rating at full time; saved on the result.
- Player stats, varied commentary, and an in-game rulebook with a first-launch guide and in-match help.
- Resume button in the side panel, kicker's-eye view of kicks at goal, contact and ball physics.

## 0.1.0

- First release: offline Tauri 2 desktop app with the match engine, league, table, live match
  screen and highlight arena.
