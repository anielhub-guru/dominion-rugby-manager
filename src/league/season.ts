import { hashSeed, Rng } from "../engine/rng";
import { MatchSim, RED_BAN, SHAPE_BY_STYLE, attackFit, slotPlayer } from "../engine/match";
import { matchesText } from "../engine/injury";
import { STAT_KEYS, emptyTotals, ROLES, type Attr, type Gender, type MatchLog, type Player, type PlayerTotals, type Role, type ShapeId, type TacticId, type Team } from "../engine/types";
import { describeLine, impact, playerOfTheMatch } from "./awards";
import { buildSchedule, type Fixture } from "./schedule";
import { heavyNotes, heaviestDefeat, mergeNotes, recordMeeting, rivalNotes, rivalOf, type Rivalry } from "./rivals";
import { computeStandings, standingsAt } from "./standings";
import { defaultLeagueRecords, recordMatch, recordRetirement, recordSeasonEnd, type Legend, type LeagueRecords } from "./history";
import { BONUS_FLAVOUR, MATCH_PAY, earnsSquadSlot, MAX_BUYS, MONEY_START, fmtMoney, goalBonus, goalResult, playerValue, prizeFor, sellPrice, teenSalePrice, wageOf } from "./economy";
import { DEFAULT_START_YEAR } from "./calendar";
import { MAX_SPONSOR_DEALS, SPONSOR_LAPSE_MATCHDAY, describeCondition, fanOffer, judgeFanDeal, judgeSeasonDeal, sponsorOffers, type Deal } from "./deals";
import { FACILITIES, FACILITY_IDS, MAX_FACILITY_LEVEL, OFFER_FORMS, PROPOSAL_CHANCE, PROPOSAL_LAPSE_MATCHDAY, SPONSORS, academyBonus, geniusChance, levelOf, projectDuration, recoveryBonus, reducedInjury, trainingSlots, upgradeCost, type FacilityId, type FacilityLevels } from "./facilities";
import { RESERVE_COUNT, makeGenius, evolvePlayers, playShare, generateTeams, makeReserves, initialPotential, makeProspects, objectiveTarget, overall, teamRating } from "./teams";

export { describeLine, impact };

export const SAVE_VERSION = 10;
/** Five starters, three bench, two reserves. */
export const SQUAD_SIZE = 10;
/** Extra squad places a club can earn (see economy.ts earnsSquadSlot). They are depth: extra reserves, outside the matchday eight. */
export const MAX_EXTRA_SLOTS = 2;
/** The most players the manager's club may hold. */
export const squadCapacity = (s: { extraSlots?: number }) => SQUAD_SIZE + Math.min(MAX_EXTRA_SLOTS, s.extraSlots ?? 0);

export type TrainingFocus = "attack" | "defence" | "kicking" | "fitness";
export const TRAINING: Record<TrainingFocus, { label: string; description: string; attrs: Attr[] }> = {
  attack: { label: "Attack", description: "Power, pace and handling.", attrs: ["power", "pace", "handling"] },
  defence: { label: "Defence", description: "Tackling.", attrs: ["tackling"] },
  kicking: { label: "Kicking", description: "Goal-kicking and territory kicks.", attrs: ["kicking"] },
  fitness: { label: "Fitness", description: "Stamina, so players stay fresh late on.", attrs: ["stamina"] },
};

/** A player an AI club has put up for sale. The asking price follows the player's true value, which you cannot see. */
export interface Listing {
  /** Snapshot with `scouted` set: potential is only an estimate until you sign them. */
  player: Player;
  clubId: string;
  /** Asking price in thousands. */
  price: number;
}

/** Everything the manager can do between seasons. Nothing here is compulsory except filling the squad back to eight. */
export interface Intake {
  /** Squad members who retire when the offseason is confirmed. */
  retiring: string[];
  /** Teenage prospects: three for each position that lost a player, one for every other position. Unpicked ones are sold. */
  prospects: Player[];
  /** Players AI clubs have transfer-listed. */
  market: Listing[];
}

/** The manager's choices: players to sell, prospects to sign, listed players to buy. */
export interface OffseasonPlan {
  sell: string[];
  sign: string[];
  buy: string[];
}

export interface SeasonRecord {
  season: number;
  championId: string;
  managedPosition: number;
  /** The club you managed that season. Missing on older saves. */
  clubId?: string;
  /** Who finished second. Missing on older saves. */
  runnerUpId?: string;
  championPoints?: number;
  /** The league's top points scorer that season. Missing on older saves. */
  topScorer?: { name: string; clubId: string; points: number };
}

/** How the approach is presented, set by your recent results rather than by the club. */
export type OfferTier = "elite" | "steady" | "lifeline";

/** A chance to take over another club at the end of a season. */
export interface ClubOffer {
  clubId: string;
  tier: OfferTier;
  mandate: string;
  /** Bank balance you start with at the new club, in thousands of naira. */
  budget: number;
  /** Short squad notes shown on the offer, such as "Ageing core". */
  tags: string[];
}

export interface NewsItem {
  season: number;
  matchday: number;
  text: string;
  /** Special presentation: "title" = you won the league, "finish" = end-of-season position. */
  kind?: "title" | "finish";
  /** Final league position, for kind "finish"/"title". */
  position?: number;
  /** Where the news points to, shown as a link to that tab. */
  link?: "projects" | "deals";
}

/** Career totals include a count of seasons played. */
export type CareerTotals = PlayerTotals & { seasons: number };

export interface SeasonState {
  version: number;
  seed: number;
  /** Which league you are coaching in. */
  gender: Gender;
  season: number;
  managedId: string;
  /** Tactic chosen by the human manager. */
  tactic: TacticId;
  /** Defensive shape chosen by the human manager. */
  shape: ShapeId;
  training: TrainingFocus;
  /** Rating points your players gained from training this season, by player id then attribute. Missing on older saves. */
  trainGains?: Record<string, Partial<Record<Attr, number>>>;
  teams: Team[];
  fixtures: Fixture[];
  /** Next matchday to play (1-based). Greater than totalMatchdays when the season is over. */
  matchday: number;
  totalMatchdays: number;
  history: SeasonRecord[];
  /** Newest first. */
  news: NewsItem[];
  /** Head-to-head records for every pair of clubs. Missing on older saves. */
  rivalry?: Rivalry;
  /** This season's counting stats by player id (every club). */
  seasonStats: Record<string, PlayerTotals>;
  /** Completed seasons, by player id. Add the current season for a full career line. */
  careerStats: Record<string, CareerTotals>;
  /** The manager's bank balance in thousands of naira. */
  money: number;
  /** Offseason decisions waiting on the manager. The new season cannot be played until resolved. */
  intake?: Intake;
  /** Clubs that want you as their manager. They have to be accepted or turned down before the offseason. */
  offers?: ClubOffer[];
  /** The season after which you last had an offer. */
  lastOfferSeason?: number;
  /** Strong offers you have turned down since you last moved. Each makes the next approach a little less likely. */
  declinedTop?: number;
  /** Each club's records, by club id. Start from generated founding records and are broken as you play. */
  records: LeagueRecords;
  /** Long-serving players who have retired, by the club they retired from. */
  legends: Record<string, Legend[]>;
  /** Extra squad places earned at the club you manage, on top of SQUAD_SIZE. Lost if you move to another club. */
  extraSlots?: number;
  /** The calendar year of season 1. The year of any season is startYear + season - 1 (see calendar.ts). */
  startYear: number;
  /** Facility levels by club id. A club with no entry is at the starter level for everything. */
  facilities?: Record<string, FacilityLevels>;
  /** The construction under way at the club you manage. Only one at a time. It counts down by matchday. */
  project?: Project;
  /** A facility offer on the table (from the board or a sponsor). It lapses after matchday PROPOSAL_LAPSE_MATCHDAY. */
  proposal?: ProjectProposal;
  /** A promise made to a sponsor: you stay at the club through this season, so no job offers arrive until then. */
  commitment?: { sponsor: string; untilSeason: number };
  /** Sponsor offers on the table and deals you have accepted (sponsors and fans). See deals.ts. */
  deals?: Deal[];
  /** The fan challenge you passed on, as "season:matchday", so it is not shown again. */
  fanPassed?: string;
  /** Extra match winnings from a fan challenge met, paid after the match on this matchday. */
  gateBoost?: { season: number; matchday: number; extra: number };
}

/** An offer to build a facility. A board offer comes out of your budget; a sponsor pays part or all of it for a promise to stay. */
export interface ProjectProposal {
  facility: FacilityId;
  kind: "board" | "sponsor";
  sponsor?: string;
  /** Share of the cost the sponsor pays: 0 for the board, up to 1. */
  sponsorShare: number;
  /** Seasons you promise to stay in return (0 for the board). */
  stay: number;
}

/** A facility upgrade being built. The cost has been paid; the new level arrives when `remaining` reaches 0. */
export interface Project {
  clubId: string;
  facility: FacilityId;
  /** Matchdays left. Time only passes when matches are played, so the offseason never ticks it. */
  remaining: number;
  /** The level it will reach. */
  level: number;
}

/** Upgrades a saved season from an older version, or returns null if it cannot be upgraded. */
export function migrateSave(raw: SeasonState): SeasonState | null {
  let s = raw;
  if (s.version === 3) s = { ...s, version: 4, seasonStats: {}, careerStats: {} };
  if (s.version === 4) {
    s = structuredClone(s);
    for (const t of s.teams) for (const p of t.players) p.potential ??= initialPotential(p, new Rng(hashSeed(s.seed, p.id, "pot")));
    s.version = 5;
  }
  if (s.version === 5) s = { ...s, version: 6, money: MONEY_START };
  if (s.version === 6) {
    // Older squads had eight players: add two reserves to every club.
    s = structuredClone(s);
    for (const t of s.teams) {
      const add = makeReserves(t, s.seed);
      t.players.push(...add);
      t.reserves = add.map((p) => p.id);
    }
    s.version = 7;
  }
  if (s.version === 7) s = { ...s, version: 8 };
  if (s.version === 8) s = { ...s, version: 9, records: defaultLeagueRecords(s.seed, s.gender), legends: {} };
  if (s.version === 9) s = { ...s, version: 10, startYear: DEFAULT_START_YEAR };
  if (s.version !== SAVE_VERSION) return null;
  return { ...s, shape: s.shape ?? "sweeper" };
}

export function newGame(seed: number, managedId: string, gender: Gender = "men", startYear: number = DEFAULT_START_YEAR): SeasonState {
  const teams = generateTeams(seed, gender);
  if (!teams.some((t) => t.id === managedId)) throw new Error(`Unknown team ${managedId}`);
  const fixtures = buildSchedule(teams.map((t) => t.id), 1);
  const me = teams.find((t) => t.id === managedId)!;
  return {
    version: SAVE_VERSION,
    seed,
    gender,
    startYear,
    season: 1,
    managedId,
    tactic: me.style,
    shape: "sweeper",
    training: "attack",
    teams,
    fixtures,
    matchday: 1,
    totalMatchdays: Math.max(...fixtures.map((f) => f.matchday)),
    history: [],
    news: [{ season: 1, matchday: 0, text: `Welcome to ${me.name}. Set your starting five, tactic and training focus, then play your first match.` }],
    seasonStats: {},
    careerStats: {},
    money: MONEY_START,
    records: defaultLeagueRecords(seed, gender),
    legends: {},
    ...firstDeals(teams, seed, managedId),
  };
}

/** Sponsor offers for the first season of a new game. */
function firstDeals(teams: Team[], seed: number, managedId: string): { deals?: Deal[] } {
  const deals = sponsorOffers({ seed, season: 1, managedId, teams } as SeasonState);
  return deals.length ? { deals } : {};
}

/** Accept a sponsor's offer. Up to MAX_SPONSOR_DEALS can run at once. */
export function acceptDeal(prev: SeasonState, id: string): SeasonState {
  const d = prev.deals?.find((x) => x.id === id && x.source === "sponsor" && x.status === "offered");
  if (!d) throw new Error("That offer is no longer open.");
  if (prev.deals!.filter((x) => x.source === "sponsor" && x.status === "active").length >= MAX_SPONSOR_DEALS) throw new Error(`You can have at most ${MAX_SPONSOR_DEALS} sponsor deals at once.`);
  const state = structuredClone(prev);
  state.deals!.find((x) => x.id === id)!.status = "active";
  state.news = [{ season: state.season, matchday: state.matchday, text: `Deal agreed with ${d.from}: ${describeCondition(d.cond, state).toLowerCase()}. They pay ${fmtMoney(d.reward)}; if you miss it you pay ${fmtMoney(d.penalty)}. Settled at the end of the season.`, link: "deals" as const }, ...state.news].slice(0, 14);
  return state;
}

export function declineDeal(prev: SeasonState, id: string): SeasonState {
  const state = structuredClone(prev);
  state.deals = (state.deals ?? []).filter((x) => x.id !== id);
  return state;
}

/** Take the supporters' challenge for the next match. They pay out straight after it if you meet it. */
export function acceptFanChallenge(prev: SeasonState): SeasonState {
  const offer = fanOffer(prev);
  if (!offer) throw new Error("The supporters have no challenge for this match.");
  const state = structuredClone(prev);
  state.deals = [...(state.deals ?? []), { ...offer, status: "active" }];
  state.news = [{ season: state.season, matchday: state.matchday, text: `The supporters have a challenge for matchday ${state.matchday}: ${describeCondition(offer.cond, state).toLowerCase()}.${offer.reward ? ` ${fmtMoney(offer.reward)} if you do.` : offer.gate ? " A bigger crowd next match if you do." : ""}`, link: "deals" as const }, ...state.news].slice(0, 14);
  return state;
}

export function passFanChallenge(prev: SeasonState): SeasonState {
  return { ...prev, fanPassed: `${prev.season}:${prev.matchday}` };
}

export const isSeasonOver = (s: SeasonState) => s.matchday > s.totalMatchdays;

export function teamById(s: SeasonState, id: string): Team {
  const t = s.teams.find((x) => x.id === id);
  if (!t) throw new Error(`Unknown team ${id}`);
  return t;
}

/** The facility levels at the club you manage. */
export const facilitiesOf = (s: Pick<SeasonState, "facilities" | "managedId">): FacilityLevels => s.facilities?.[s.managedId] ?? {};

/** Starts building the next level of a facility. The cost leaves the budget now, less anything a sponsor pays. */
export function startProject(prev: SeasonState, id: FacilityId, sponsor?: { name: string; pays: number }): SeasonState {
  if (prev.project) throw new Error("A project is already under construction.");
  const cost = upgradeCost(facilitiesOf(prev), id);
  if (cost === null) throw new Error(`The ${FACILITIES[id].name} is already fully upgraded.`);
  const pay = cost - (sponsor?.pays ?? 0);
  if (prev.money < pay) throw new Error(`You cannot afford this: it costs ${fmtMoney(pay)} and the balance is ${fmtMoney(prev.money)}.`);
  const state = structuredClone(prev);
  const level = levelOf(facilitiesOf(prev), id) + 1;
  const remaining = projectDuration(facilitiesOf(prev), id)!;
  state.money -= pay;
  state.project = { clubId: state.managedId, facility: id, remaining, level };
  const text = sponsor
    ? `Construction begins on the ${FACILITIES[id].name} (level ${level}). ${sponsor.name} pays ${fmtMoney(sponsor.pays)} of the ${fmtMoney(cost)} cost${pay ? ` and you pay ${fmtMoney(pay)}` : ""}. It will take ${remaining} matchdays.`
    : `Construction begins on the ${FACILITIES[id].name} (level ${level}) for ${fmtMoney(cost)}. It will take ${remaining} matchdays.`;
  state.news = [{ season: state.season, matchday: 0, text, link: "projects" as const }, ...state.news].slice(0, 14);
  return state;
}

/** What an offer costs and asks, or null when there is no offer (or the facility is already fully upgraded). */
export function proposalTerms(s: SeasonState): { cost: number; sponsorPays: number; youPay: number; stay: number } | null {
  if (!s.proposal) return null;
  const cost = upgradeCost(facilitiesOf(s), s.proposal.facility);
  if (cost === null) return null;
  const sponsorPays = Math.round((cost * s.proposal.sponsorShare) / 10) * 10;
  return { cost, sponsorPays, youPay: cost - sponsorPays, stay: s.proposal.stay };
}

/** Take the offer: the project starts now. For a sponsor, you also promise to stay at the club. */
export function acceptProposal(prev: SeasonState): SeasonState {
  const terms = proposalTerms(prev);
  const offer = prev.proposal;
  if (!offer || !terms) throw new Error("There is no offer open.");
  const state = startProject(prev, offer.facility, offer.kind === "sponsor" ? { name: offer.sponsor!, pays: terms.sponsorPays } : undefined);
  delete state.proposal;
  if (offer.kind === "sponsor") {
    // The promise covers this many seasons, counting the one about to be played.
    state.commitment = { sponsor: offer.sponsor!, untilSeason: Math.max(state.commitment?.untilSeason ?? 0, state.season + offer.stay - 1) };
    state.news = [{ season: state.season, matchday: 0, text: `You have promised ${offer.sponsor} that you will stay at the club for ${offer.stay} season${offer.stay === 1 ? "" : "s"}, so no other club can approach you until then.` }, ...state.news].slice(0, 14);
  }
  return state;
}

export function declineProposal(prev: SeasonState): SeasonState {
  const state = structuredClone(prev);
  delete state.proposal;
  return state;
}

/** At the start of an offseason an offer may arrive to upgrade the club's least developed facility, in one of a few forms. */
function maybePropose(state: SeasonState): NewsItem | undefined {
  if (state.project) return undefined;
  const levels = facilitiesOf(state);
  const open = FACILITY_IDS.filter((id) => levelOf(levels, id) < MAX_FACILITY_LEVEL);
  const rng = new Rng(hashSeed(state.seed, state.season, "proposal"));
  if (!open.length || !rng.chance(PROPOSAL_CHANCE)) return undefined;
  const low = Math.min(...open.map((id) => levelOf(levels, id)));
  const id = rng.pick(open.filter((x) => levelOf(levels, x) === low));
  const form = rng.weighted(OFFER_FORMS, (f) => f.weight);
  const level = levelOf(levels, id) + 1;
  const sponsor = form.sponsorShare > 0 ? rng.pick(SPONSORS) : undefined;
  state.proposal = { facility: id, kind: sponsor ? "sponsor" : "board", ...(sponsor ? { sponsor } : {}), sponsorShare: form.sponsorShare, stay: form.stay(level) };
  const t = proposalTerms(state)!;
  const text = sponsor
    ? `${sponsor} offers to pay ${fmtMoney(t.sponsorPays)} towards the ${FACILITIES[id].name} if you promise to stay at the club for ${t.stay} season${t.stay === 1 ? "" : "s"}.`
    : `The board proposes upgrading the ${FACILITIES[id].name} for ${fmtMoney(t.cost)}, paid from your budget.`;
  return { season: state.season, matchday: 0, text: `${text} The offer stands until matchday ${PROPOSAL_LAPSE_MATCHDAY}.`, link: "projects" };
}

/** Adds the finished level to the club's facilities and clears the project. */
function finishProject(state: SeasonState, matchday: number): NewsItem {
  const p = state.project!;
  const mine = ((state.facilities ??= {})[p.clubId] ??= {});
  mine[p.facility] = p.level;
  delete state.project;
  return { season: state.season, matchday, text: `Project complete: the ${FACILITIES[p.facility].name} reaches level ${p.level} of ${MAX_FACILITY_LEVEL}. ${FACILITIES[p.facility].effect}`, link: "projects" };
}

/** One matchday of construction. Returns the news item when it finishes. */
function tickProject(state: SeasonState, matchday: number): NewsItem | undefined {
  if (!state.project) return undefined;
  state.project.remaining--;
  return state.project.remaining <= 0 ? finishProject(state, matchday) : undefined;
}

export function managedFixture(s: SeasonState): Fixture | undefined {
  return s.fixtures.find((f) => f.matchday === s.matchday && (f.homeId === s.managedId || f.awayId === s.managedId));
}

/**
 * AI clubs play their style, except that an attacking club whose lineup lacks the pace and handling
 * for it falls back to balanced rather than throwing the ball about and getting countered.
 */
export function aiTactic(team: Team): TacticId {
  if (team.style !== "attacking") return team.style;
  const lineup = team.lineup.map((id) => team.players.find((p) => p.id === id)).filter((p): p is Player => !!p);
  return attackFit(lineup) < -0.1 ? "balanced" : "attacking";
}

/** Builds a steppable simulation for a fixture, using the manager's tactic for their own club. */
export function buildSim(s: SeasonState, f: Fixture, live = false): MatchSim {
  const home = teamById(s, f.homeId);
  const away = teamById(s, f.awayId);
  const rival = rivalOf(s.rivalry, s.managedId);
  const heavy = heaviestDefeat(s.rivalry, s.managedId);
  const opp = home.id === s.managedId ? away.id : away.id === s.managedId ? home.id : undefined;
  const managedIsHome = home.id === s.managedId;
  let notes = opp && opp === rival ? rivalNotes(s.rivalry, s.managedId, rival, teamById(s, rival).name, managedIsHome) : undefined;
  if (opp && heavy && opp === heavy.id) {
    const h = heavyNotes(heavy.by, managedIsHome);
    notes = notes ? mergeNotes(notes, h) : h;
  }
  return new MatchSim({
    id: f.id,
    season: s.season,
    matchday: f.matchday,
    home,
    away,
    homeTactic: home.id === s.managedId ? s.tactic : aiTactic(home),
    awayTactic: away.id === s.managedId ? s.tactic : aiTactic(away),
    homeShape: home.id === s.managedId ? s.shape : SHAPE_BY_STYLE[aiTactic(home)],
    awayShape: away.id === s.managedId ? s.shape : SHAPE_BY_STYLE[aiTactic(away)],
    // AI clubs always adapt after a card; the manager decides themselves when watching live.
    homeAiSubs: home.id !== s.managedId,
    awayAiSubs: away.id !== s.managedId,
    homeAuto: !(live && home.id === s.managedId),
    awayAuto: !(live && away.id === s.managedId),
    ...(notes ? { rival: notes } : {}),
    // Your rival's fixtures are derbies: hotter, and form counts for less. The heavy-defeat rematch is only a story.
    ...(opp && opp === rival ? { derby: true } : {}),
    seed: hashSeed(s.seed, s.season, f.id),
  });
}

/**
 * Plays the next matchday. If the manager watched their match live, pass its log
 * and that result is used instead of simulating it. Returns the new state (the
 * input is untouched) and every match log for saving.
 */
export function playMatchday(prev: SeasonState, managedLog?: MatchLog): { state: SeasonState; logs: MatchLog[] } {
  if (isSeasonOver(prev)) throw new Error("Season is over");
  if (prev.intake) throw new Error("Choose your new signings before playing");
  const state = structuredClone(prev);
  const ids = state.teams.map((t) => t.id);
  const before = computeStandings(ids, state.fixtures);
  const logs: MatchLog[] = [];
  for (const f of state.fixtures.filter((x) => x.matchday === state.matchday)) {
    const log = managedLog && managedLog.id === f.id ? managedLog : buildSim(state, f).runToEnd().toLog();
    const best = playerOfTheMatch(log);
    f.result = {
      homeScore: log.homeScore,
      awayScore: log.awayScore,
      homeTries: log.homeTries,
      awayTries: log.awayTries,
      ...(best ? { potm: { id: best.line.id, name: best.line.name, club: best.club, rating: best.rating } } : {}),
    };
    logs.push(log);
  }

  const md = state.matchday;
  // Which club was your rival going into this round, so the news matches what the commentary said.
  const rivalBefore = rivalOf(state.rivalry, state.managedId);
  const heavyBefore = heaviestDefeat(state.rivalry, state.managedId);
  state.rivalry ??= {};
  for (const l of logs) recordMeeting(state.rivalry, l.homeId, l.awayId, l.homeScore, l.awayScore);
  const news: string[] = [];
  const mine = logs.find((l) => l.homeId === state.managedId || l.awayId === state.managedId);
  if (mine) {
    const home = mine.homeId === state.managedId;
    const [pf, pa] = home ? [mine.homeScore, mine.awayScore] : [mine.awayScore, mine.homeScore];
    const opp = home ? mine.awayName : mine.homeName;
    const verb = pf > pa ? "Won" : pf === pa ? "Drew" : "Lost";
    let pay = pf > pa ? MATCH_PAY.win : pf === pa ? MATCH_PAY.draw : MATCH_PAY.loss;
    const boost = state.gateBoost?.season === state.season && state.gateBoost.matchday === md ? state.gateBoost.extra : 0;
    pay += boost;
    delete state.gateBoost;
    state.money += pay;
    const after = computeStandings(ids, state.fixtures);
    const was = before.findIndex((r) => r.teamId === state.managedId) + 1;
    const now = after.findIndex((r) => r.teamId === state.managedId) + 1;
    const move = md === 1 ? `Now ${ord(now)}.` : now < was ? `Up to ${ord(now)}.` : now > was ? `Down to ${ord(now)}.` : `Holding ${ord(now)}.`;
    news.push(`${verb} ${pf}-${pa} ${home ? "vs" : "at"} ${opp}. ${move} Match winnings ${fmtMoney(pay)}${boost ? ", including a bigger gate" : ""}.`);
    if (now === 1 && was !== 1) news.push("You have gone top of the table.");
    const oppId = home ? mine.awayId : mine.homeId;
    if (rivalBefore === oppId) news.push(pf > pa ? `Bragging rights: you beat your rivals ${opp}.` : pf < pa ? `Your rivals ${opp} get the better of you.` : `Honours even with your rivals ${opp}.`);
    if (heavyBefore?.id === oppId && pf > pa) news.push(`Revenge: you beat ${opp}, who had handed you your heaviest defeat.`);
    if (rivalBefore !== oppId && !rivalBefore && rivalOf(state.rivalry, state.managedId) === oppId) news.push(`${opp} have become your rivals.`);
  }
  news.push(...recordPlayers(state, logs));
  for (const log of logs) for (const b of recordMatch(state.records, log)) if (b.clubId === state.managedId) news.push(b.text);
  if (md === state.totalMatchdays) {
    const table = standingsAt(ids, state.fixtures, state.totalMatchdays);
    for (const b of recordSeasonEnd(state.records, state.season, table, state.teams, state.seasonStats)) if (b.clubId === state.managedId) news.push(b.text);
  }
  applyLoad(state, logs);
  for (const club of state.teams) if (club.id !== state.managedId) aiRest(club);
  news.push(...train(state, md));
  const items: NewsItem[] = news.map((text) => ({ season: state.season, matchday: md, text }));
  if (md === state.totalMatchdays) items.unshift(finalPositionNews(state, ids, md));
  const built = tickProject(state, md);
  if (built) items.unshift(built);
  items.unshift(...settleDeals(state, md, mine));
  if (state.proposal && md >= PROPOSAL_LAPSE_MATCHDAY) {
    delete state.proposal;
    items.unshift({ season: state.season, matchday: md, text: "The board's project proposal has lapsed." });
  }
  state.news = [...items, ...state.news].slice(0, 14);
  state.matchday++;
  return { state, logs };
}

/**
 * Pays out the supporters' challenge for the match just played, and closes the sponsors' window to accept once
 * the lapse matchday arrives. Returns the news for what happened.
 */
function settleDeals(state: SeasonState, md: number, mine?: MatchLog): NewsItem[] {
  const out: NewsItem[] = [];
  if (!state.deals) return out;
  for (const d of state.deals.filter((x) => x.source === "fans" && x.matchday === md && x.status === "active")) {
    const met = mine ? judgeFanDeal(d, state, mine) : false;
    const what = describeCondition(d.cond, state).toLowerCase();
    if (met) state.money += d.reward;
    if (met && d.gate) state.gateBoost = { season: state.season, matchday: md + 1, extra: d.gate };
    const thanks = d.reward ? `They raise ${fmtMoney(d.reward)} for the club.` : d.gate ? "Expect a bigger crowd at the next match." : "They are right behind you.";
    out.push({ season: state.season, matchday: md, text: met ? `The supporters are delighted: you met their challenge (${what}). ${thanks}` : `The supporters wanted you to ${what}, and are disappointed.`, link: "deals" });
  }
  state.deals = state.deals.filter((x) => !(x.source === "fans" && x.matchday === md));
  if (md >= SPONSOR_LAPSE_MATCHDAY && state.deals.some((x) => x.source === "sponsor" && x.status === "offered")) {
    state.deals = state.deals.filter((x) => !(x.source === "sponsor" && x.status === "offered"));
    out.push({ season: state.season, matchday: md, text: "The sponsors' offers have lapsed.", link: "deals" });
  }
  return out;
}

/** The player's career: completed seasons plus the current one. */
export function careerLine(s: SeasonState, id: string): CareerTotals {
  const total: CareerTotals = { ...emptyTotals(), seasons: 0 };
  const prior = s.careerStats[id];
  if (prior) Object.assign(total, prior);
  const now = s.seasonStats[id];
  if (now) {
    for (const k of STAT_KEYS) total[k] += now[k];
    if (now.apps > 0) total.seasons++;
  }
  return total;
}

/**
 * Post-match tiredness, driven by stamina. Minutes on the pitch add load (less for high stamina),
 * then everyone recovers a share of it before the next matchday (faster for high stamina). Resting
 * players recover fully in a couple of matches; a stamina-60 regular settles around 18, stamina 40 around 33.
 */
export const LOAD_PER_MATCH = 30;
export function afterMatch(p: { stamina: number; tired?: number }, share: number, bonus = 0): number {
  const gain = LOAD_PER_MATCH * share * (1.5 - p.stamina / 100);
  const recover = Math.min(0.95, 0.3 + p.stamina * 0.005 + bonus);
  return Math.min(100, Math.max(0, ((p.tired ?? 0) + gain) * (1 - recover)));
}

function applyLoad(state: SeasonState, logs: MatchLog[]) {
  const load: Record<string, number> = Object.assign({}, ...logs.map((l) => l.load ?? {}));
  for (const t of state.teams) {
    for (const p of t.players) {
      const v = afterMatch(p, load[p.id] ?? 0, t.id === state.managedId ? recoveryBonus(facilitiesOf(state)) : 0);
      if (v < 0.5) delete p.tired;
      else p.tired = Math.round(v * 10) / 10;
    }
  }
}

/**
 * AI clubs rest tired players between matches. Each slot goes to whoever scores best once tiredness is
 * counted (it costs stat points at kickoff and drains stamina faster), so a worn-out low-stamina starter
 * sits when the bench is close in quality, and a high-stamina one plays on.
 */
const slotScore = (p: Player, slot: Role) => {
  const eff = overall(slotPlayer(p, slot));
  const t = (p.tired ?? 0) / 100;
  // A natural fit keeps its place unless tiredness really bites.
  return eff * (1 - t * 0.15) - t * 8 + (p.role === slot ? 3 : 0);
};

/** Auto-select strategies offered in the squad screen's dropdown. Add a new one here, then handle it in autoSelect. */
export const AUTO_MODES = {
  best: { label: "Best team", description: "Best starters, bench and reserves from current ratings, tiredness and suspensions." },
  rested: { label: "Most rested", description: "The freshest players start and sit on the bench; the most tired go to the reserves. Ratings and positions only break ties." },
} as const;
export type AutoMode = keyof typeof AUTO_MODES;

/**
 * Picks the best squad from current form: starters by fit and freshness, then the three best of the
 * rest on the bench and the remaining players as reserves. Suspended and injured players go last, to the reserves.
 */
export function autoSelect(team: Team, mode: AutoMode = "best"): { lineup: string[]; reserves: string[] } {
  // "rested" puts the freshest players first (least tired), using fit and rating only to break ties.
  const rested = mode === "rested";
  const tired = (p: Player) => Math.round(p.tired ?? 0);
  const used = new Set<string>();
  const lineup = ROLES.map((slot) => {
    const pool = team.players.filter((p) => !used.has(p.id));
    const best = pool.filter((p) => !isOut(p)).sort((a, b) => (rested ? tired(a) - tired(b) : 0) || slotScore(b, slot) - slotScore(a, slot))[0] ?? pool[0];
    used.add(best.id);
    return best.id;
  });
  const rest = team.players
    .filter((p) => !used.has(p.id))
    .sort((a, b) => Number(isOut(a)) - Number(isOut(b)) || (rested ? tired(a) - tired(b) : 0) || overall(b) * (1 - (b.tired ?? 0) / 700) - overall(a) * (1 - (a.tired ?? 0) / 700));
  // The bench is three; everyone beyond the matchday eight is a reserve, so an extra squad place adds a reserve.
  const reserves = Math.max(RESERVE_COUNT, team.players.length - 8);
  return { lineup, reserves: rest.slice(rest.length - reserves).map((p) => p.id) };
}

export function aiRest(club: Team) {
  const score = slotScore;
  const free = club.players.filter((p) => !isOut(p) && !club.reserves?.includes(p.id));
  const used = new Set<string>();
  const next = ROLES.map((slot, i) => {
    const pick = free.filter((p) => !used.has(p.id)).sort((a, b) => score(b, slot) - score(a, slot))[0];
    const keep = pick ?? club.players.find((p) => p.id === club.lineup[i])!;
    used.add(keep.id);
    return keep.id;
  });
  club.lineup = next;
}

export const isSuspended = (p: { ban?: number }) => (p.ban ?? 0) > 0;
export const isInjured = (p: { injury?: { games: number } }) => (p.injury?.games ?? 0) > 0;
/** Cannot play the next match: suspended or injured. */
export const isOut = (p: { ban?: number; injury?: { games: number } }) => isSuspended(p) || isInjured(p);

/** Best fit for a slot from players who are free to play: same natural role first, then overall rating. */
export function bestReplacement(team: Team, slot: Role, exclude: Set<string>) {
  return team.players
    .filter((p) => !exclude.has(p.id) && !isOut(p) && !team.reserves?.includes(p.id))
    .sort((a, b) => Number(b.role === slot) - Number(a.role === slot) || overall(b) - overall(a))[0];
}

/**
 * Adds the matchday's player stats to the season, serves bans and injuries, and applies new ones.
 * They are counted down before new ones are applied, so a player sent off on matchday N with a
 * one-match ban misses matchday N+1 and is available again on N+2.
 */
function recordPlayers(state: SeasonState, logs: MatchLog[]): string[] {
  const news: string[] = [];
  const everyone = new Map(state.teams.flatMap((t) => t.players.map((p) => [p.id, { p, t }] as const)));
  for (const { p } of everyone.values()) {
    if ((p.ban ?? 0) > 0) p.ban = (p.ban ?? 0) - 1;
    if (p.injury) {
      p.injury.games--;
      if (p.injury.games <= 0) delete p.injury;
    }
  }
  const banned: { id: string; name: string; offence: string; matches: number }[] = [];
  for (const log of logs) {
    for (const l of log.players ?? []) {
      const tot = (state.seasonStats[l.id] ??= emptyTotals());
      for (const k of STAT_KEYS) tot[k] += l[k];
      if (l.reds > 0) {
        // Logs from before ban lengths existed carry no details: every red was one match.
        const b = log.bans?.find((x) => x.id === l.id);
        const who = everyone.get(l.id);
        if (who) who.p.ban = b?.matches ?? RED_BAN;
        if (b) banned.push(b);
      }
    }
    for (const i of log.injuries ?? []) {
      if (i.games <= 0) continue; // a knock only ended that match
      const who = everyone.get(i.id);
      // The medical centre only helps the club you manage.
      if (who) who.p.injury = { label: i.label, games: who.t.id === state.managedId ? reducedInjury(i.games, facilitiesOf(state)) : i.games };
    }
  }
  const mine = logs.find((l) => l.homeId === state.managedId || l.awayId === state.managedId);
  const team = teamById(state, state.managedId);
  if (mine?.players) {
    const lines = mine.players.filter((l) => team.players.some((p) => p.id === l.id));
    const star = [...lines].sort((a, b) => impact(b) - impact(a))[0];
    if (star && impact(star) > 3) news.push(`Standout: ${star.name} (${describeLine(star)}).`);
    for (const l of lines) {
      const ban = banned.find((b) => b.id === l.id);
      if (l.reds > 0) news.push(ban && ban.matches > 1 ? `${l.name} was sent off for ${ban.offence} and is banned for ${matchesText(ban.matches)}.` : `${l.name} was sent off and is suspended for your next match.`);
      else if (l.yellows > 0) news.push(`${l.name} spent time in the sin bin.`);
    }
    for (const i of mine.injuries ?? []) {
      if (!team.players.some((p) => p.id === i.id)) continue;
      const games = team.players.find((p) => p.id === i.id)?.injury?.games ?? i.games;
      news.push(i.games > 0 ? `${i.name} is injured (${i.label.toLowerCase()}) and will miss ${matchesText(games)}.` : `${i.name} took a knock (${i.label.toLowerCase()}) and came off, but should be fine for the next match.`);
    }
  }
  // Keep the manager's starting five legal: replace any suspended or injured starter with the best available player.
  for (let i = 0; i < ROLES.length; i++) {
    const cur = team.players.find((p) => p.id === team.lineup[i]);
    if (!cur || !isOut(cur)) continue;
    const rep = bestReplacement(team, ROLES[i], new Set(team.lineup));
    if (!rep) continue;
    team.lineup[i] = rep.id;
    news.push(`${cur.name} is ${isSuspended(cur) ? "suspended" : "injured"}, so ${rep.name} comes into the starting five at ${ROLES[i]}.`);
  }
  return news;
}

/** End-of-season announcement: where the manager's club finished, with a special item for winning the league. */
function finalPositionNews(state: SeasonState, ids: string[], md: number): NewsItem {
  const table = standingsAt(ids, state.fixtures, state.totalMatchdays);
  const pos = table.findIndex((r) => r.teamId === state.managedId) + 1;
  const row = table[pos - 1];
  const club = teamById(state, state.managedId).name;
  const base = { season: state.season, matchday: md, position: pos };
  if (pos === 1) {
    return { ...base, kind: "title", text: `CHAMPIONS! ${club} win the Season ${state.season} league title with ${row.points} points.` };
  }
  const champ = teamById(state, table[0].teamId).name;
  const tail = pos <= 3 ? " A podium finish." : "";
  return { ...base, kind: "finish", text: `Full time on Season ${state.season}: ${club} finish ${ord(pos)} of ${table.length} on ${row.points} points. ${champ} are champions.${tail}` };
}

function ord(n: number): string {
  const v = n % 100;
  const suffix = v >= 11 && v <= 13 ? "th" : (["th", "st", "nd", "rd"][n % 10] ?? "th");
  return `${n}${suffix}`;
}

/** Weekly training: a few squad members have a chance to gain a point in the focus area. */
function train(state: SeasonState, md: number): string[] {
  const rng = new Rng(hashSeed(state.seed, state.season, "train", md));
  const team = teamById(state, state.managedId);
  const focus = TRAINING[state.training];
  const out: string[] = [];
  // Only players who can still improve are picked, so a maxed-out player never wastes one of the three slots.
  const open = (p: Player) => overall(p) < (p.potential ?? 99) && focus.attrs.some((a) => p[a] < 95);
  for (const p of rng.shuffle(team.players.filter(open)).slice(0, trainingSlots(facilitiesOf(state)))) {
    if (!rng.chance(0.8)) continue;
    const attr = rng.pick(focus.attrs.filter((a) => p[a] < 95));
    p[attr]++;
    const g = ((state.trainGains ??= {})[p.id] ??= {});
    g[attr] = (g[attr] ?? 0) + 1;
    out.push(`Training: ${p.name} improved ${attr} to ${p[attr]}.`);
  }
  // AI clubs train too, but slower than a manager who is paying attention: one player a week, half the time,
  // on a focus of the club's own. Same ceiling (potential) as everyone else. No news for these.
  const keys = Object.keys(TRAINING) as TrainingFocus[];
  for (const club of state.teams) {
    if (club.id === state.managedId) continue;
    const r = new Rng(hashSeed(state.seed, state.season, "ai-train", md, club.id));
    if (!r.chance(AI_TRAIN_CHANCE)) continue;
    const p = r.pick(club.players);
    const attr = r.pick(TRAINING[keys[Math.floor(r.next() * keys.length)]].attrs);
    if (p[attr] >= 95 || overall(p) >= (p.potential ?? 99)) continue;
    p[attr]++;
  }
  return out;
}

/** Weekly chance that an AI club's training lifts one player by a point (the manager's club gets up to three at 80%). */
const AI_TRAIN_CHANCE = 0.5;

/** The finished season as a history entry: champions, runners-up and the league's top scorer. */
export function seasonRecordFor(state: SeasonState): SeasonRecord {
  const ids = state.teams.map((t) => t.id);
  const table = standingsAt(ids, state.fixtures, state.totalMatchdays);
  const finish = table.findIndex((r) => r.teamId === state.managedId) + 1;
  let topScorer: SeasonRecord["topScorer"];
  for (const club of state.teams) {
    for (const p of club.players) {
      const pts = state.seasonStats[p.id]?.points ?? 0;
      if (pts > (topScorer?.points ?? 0)) topScorer = { name: p.name, clubId: club.id, points: pts };
    }
  }
  return { season: state.season, championId: table[0].teamId, managedPosition: finish, clubId: state.managedId, runnerUpId: table[1]?.teamId, championPoints: table[0].points, ...(topScorer ? { topScorer } : {}) };
}

export function startNextSeason(prev: SeasonState): SeasonState {
  if (!isSeasonOver(prev)) throw new Error("Season is not over");
  const state = structuredClone(prev);
  const ids = state.teams.map((t) => t.id);
  const table = standingsAt(ids, state.fixtures, state.totalMatchdays);
  const finish = table.findIndex((r) => r.teamId === state.managedId) + 1;
  // The goal that applied to the season just played, worked out before this season joins the history.
  const goal = objectiveTarget(state.managedId, lastFinishHere(state));
  const clearOfSecond = table[0].teamId === state.managedId && table[1] ? table[0].points - table[1].points : 0;
  state.history.push(seasonRecordFor(state));
  for (const [id, now] of Object.entries(state.seasonStats)) {
    const career = (state.careerStats[id] ??= { ...emptyTotals(), seasons: 0 });
    for (const k of STAT_KEYS) career[k] += now[k];
    if (now.apps > 0) career.seasons++;
  }
  // Sponsor deals are judged on the season just played, before its stats are cleared.
  const dealResults = (state.deals ?? []).filter((d) => d.source === "sponsor" && d.status === "active").map((d) => ({ d, met: judgeSeasonDeal(d, state, finish), what: describeCondition(d.cond, state).toLowerCase() }));
  const played = state.seasonStats;
  const matches = state.totalMatchdays;
  state.seasonStats = {};
  state.trainGains = {};
  for (const t of state.teams) for (const p of t.players) {
    delete p.tired;
    delete p.injury; // the offseason heals everyone; bans still carry over
  }
  const news: string[] = [];
  const lastSeason = state.season;
  // Season finances: prize money for the finishing position, less the wage bill.
  const prize = prizeFor(finish);
  const wages = teamById(state, state.managedId).players.reduce((t, p) => t + wageOf(p), 0);
  state.money += prize - wages;
  news.push(`Season ${state.season} finances: ${ord(finish)} place prize money ${fmtMoney(prize)}, wage bill ${fmtMoney(-wages)}. Balance ${fmtMoney(state.money)}.`);
  delete state.proposal;
  const dealNews: NewsItem[] = [];
  for (const { d, met, what } of dealResults) {
    state.money += met ? d.reward : -d.penalty;
    dealNews.push({ season: state.season, matchday: 0, text: met ? `${d.from} deal met (${what}): they pay ${fmtMoney(d.reward)}. Balance ${fmtMoney(state.money)}.` : `${d.from} deal missed (${what}): you pay ${fmtMoney(d.penalty)}. Balance ${fmtMoney(state.money)}.`, link: "deals" });
  }
  delete state.deals;
  delete state.fanPassed;
  const result = goal.text ? goalResult(finish, goal.maxPos, clearOfSecond) : "missed";
  if (result !== "missed") {
    const bonus = goalBonus(result);
    state.money += bonus;
    const line = new Rng(hashSeed(state.seed, state.season, "bonus")).pick(BONUS_FLAVOUR[result]);
    news.push(`${result === "smashed" ? "Goal smashed" : "Goal achieved"} (${goal.text.toLowerCase()}): bonus ${fmtMoney(bonus)}. ${line} Balance ${fmtMoney(state.money)}.`);
  }
  if (earnsSquadSlot(finish, result) && (state.extraSlots ?? 0) < MAX_EXTRA_SLOTS) {
    state.extraSlots = (state.extraSlots ?? 0) + 1;
    news.push(`${finish === 1 ? "Champions" : "Beyond expectations"}: the board funds an extra squad place. You can now carry ${squadCapacity(state)} players, as extra depth for injuries and bans.`);
  }
  state.season++;
  const retirees = evolvePlayers(state.teams, hashSeed(state.seed, state.season), (id) => playShare(played[id]?.apps ?? 0, matches));
  news.push(`Season ${state.season} begins. Squads have aged and ratings have shifted.`);
  let n = 0;
  const season = state.season;
  for (const team of state.teams) {
    const out = retirees.get(team.id) ?? [];
    // Long careers are remembered by the club, whoever is managing it.
    for (const r of out) {
      const kept = recordRetirement(state.legends, team.id, r, overall(r), state.careerStats[r.id], lastSeason);
      if (kept && team.id === state.managedId) news.push(`${r.name} retires after ${kept.seasons} seasons and ${kept.apps} appearances. A club legend.`);
    }
    if (team.id === state.managedId) {
      for (const r of out) {
        r.retiring = true;
        news.push(`${r.name} (${r.age}) retires.`);
      }
      continue;
    }
    // AI clubs know their prospects' true potential and take the best one.
    for (const r of out) {
      const best = makeProspects(team, `${season}.${n++}`, r.role, state.seed).sort((a, b) => (b.potential ?? 0) - (a.potential ?? 0))[0];
      replacePlayer(team, r.id, best);
      delete state.careerStats[r.id];
    }
  }
  state.intake = buildIntake(state, managedRetirees(state, retirees));
  const genius = state.intake.prospects.find((p) => p.genius);
  const proposed = maybePropose(state);
  const offered = sponsorOffers(state);
  if (offered.length) state.deals = offered;
  // A promise to a sponsor keeps other clubs away until it runs out.
  if (state.commitment && lastSeason > state.commitment.untilSeason) delete state.commitment;
  const offers = state.commitment ? [] : buildOffers(state);
  if (offers.length) {
    state.offers = offers;
    state.lastOfferSeason = state.season - 1;
    news.push(offers.length > 1 ? `${offers.length} clubs have approached you about the manager's job.` : `${teamById(state, offers[0].clubId).name} have approached you about the manager's job.`);
  }
  state.fixtures = buildSchedule(ids, state.season);
  state.matchday = 1;
  news.push("The offseason is open: fill your squad, and look at the youth shortlist and the transfer list. The season starts when you confirm.");
  const extra: NewsItem[] = [];
  if (genius) extra.push({ season: state.season, matchday: 0, text: `The youth academy has found a genius: ${genius.name}, a ${genius.role} aged ${genius.age}, is on your youth shortlist.`, link: "projects" });
  if (proposed) extra.push(proposed);
  if (offered.length) extra.push({ season: state.season, matchday: 0, text: offered.length > 1 ? `${offered.length} sponsors have made offers for the coming season. Accept before matchday ${SPONSOR_LAPSE_MATCHDAY}.` : `${offered[0].from} has made an offer for the coming season. Accept before matchday ${SPONSOR_LAPSE_MATCHDAY}.`, link: "deals" });
  extra.push(...dealNews);
  state.news = [...extra, ...news.map((text) => ({ season: state.season, matchday: 0, text })), ...state.news].slice(0, 14);
  return state;
}

const managedRetirees = (state: SeasonState, retirees: Map<string, Player[]>) => (retirees.get(state.managedId) ?? []).map((p) => p.id);

/** Builds the manager's offseason options. Deterministic from the save seed, so reloading cannot reroll them. */
function buildIntake(state: SeasonState, retiring: string[]): Intake {
  const team = teamById(state, state.managedId);
  const vacated = new Set(retiring.map((id) => team.players.find((p) => p.id === id)!.role));
  const prospects = ROLES.flatMap((role) => makeProspects(team, `${state.season}.${role}`, role, state.seed, vacated.has(role) ? 3 : 1, academyBonus(facilitiesOf(state))));
  // A good academy now and then turns up a genius, who takes the place of one prospect (a vacancy's if there is one).
  const gr = new Rng(hashSeed(state.seed, state.season, "genius"));
  if (gr.chance(geniusChance(facilitiesOf(state)))) {
    const roles = vacated.size ? ROLES.filter((r) => vacated.has(r)) : ROLES;
    const role = gr.pick(roles);
    const at = prospects.findIndex((p) => p.role === role);
    prospects[at] = makeGenius(team, `${state.season}.${role}`, role, state.seed);
  }

  // Each AI club lists one player. Veterans and bench players are far likelier than stars,
  // and the asking price is off the player's true value by a club's own guess, up or down.
  const rng = new Rng(hashSeed(state.seed, state.season, "market"));
  const market: Listing[] = [];
  for (const club of state.teams) {
    if (club.id === state.managedId) continue;
    const pick = rng.weighted(club.players, (p) => {
      const bench = club.lineup.includes(p.id) ? 0 : 0.8;
      return (1 + Math.max(0, p.age - 28) * 0.8 + bench) / (1 + Math.max(0, overall(p) - 66) / 4);
    });
    const price = Math.max(50, Math.round((playerValue(pick) * (1.15 + 0.35 * rng.signed())) / 10) * 10);
    const seen: Player = { ...structuredClone(pick), scouted: Math.max(30, Math.min(95, (pick.potential ?? overall(pick)) + rng.int(-6, 6))) };
    delete seen.potential; // true potential stays hidden until signed
    market.push({ player: seen, clubId: club.id, price });
  }
  return { retiring, prospects, market };
}

/** Put a new player in an old one's squad place and starting slot. */
function replacePlayer(team: Team, oldId: string, next: Player) {
  const i = team.players.findIndex((p) => p.id === oldId);
  if (i < 0) throw new Error(`Unknown player ${oldId}`);
  team.players[i] = next;
  team.lineup = team.lineup.map((id) => (id === oldId ? next.id : id));
  if (team.reserves) team.reserves = team.reserves.map((id) => (id === oldId ? next.id : id));
}

export interface PlanCheck {
  ok: boolean;
  problems: string[];
  /** Squad size after the plan. It must be from SQUAD_SIZE up to `capacity`. */
  size: number;
  /** The most players the squad may hold: SQUAD_SIZE plus any extra places earned. */
  capacity: number;
  sellIncome: number;
  teenIncome: number;
  buyCost: number;
  moneyAfter: number;
  /** The squad as it would be after the plan. */
  roster: Player[];
}

/** Checks a plan without applying it. The offseason screen uses this to explain why Confirm is disabled. */
export function checkPlan(s: SeasonState, plan: OffseasonPlan): PlanCheck {
  const intake = s.intake;
  if (!intake) throw new Error("Nothing to decide");
  const team = teamById(s, s.managedId);
  const retiring = new Set(intake.retiring);
  const sell = new Set(plan.sell);
  const problems: string[] = [];
  const keep = team.players.filter((p) => !retiring.has(p.id) && !sell.has(p.id));
  for (const id of sell) if (!team.players.some((p) => p.id === id && !retiring.has(id))) problems.push("You can only sell players who are in your squad.");
  const signed = plan.sign.map((id) => intake.prospects.find((p) => p.id === id));
  const bought = plan.buy.map((id) => intake.market.find((l) => l.player.id === id));
  if (signed.some((x) => !x) || bought.some((x) => !x)) problems.push("Someone you chose is no longer on offer.");
  const roster = [...keep, ...signed.filter((x): x is Player => !!x), ...bought.filter((x): x is Listing => !!x).map((l) => l.player)];
  if (plan.buy.length > MAX_BUYS) problems.push(`You can make at most ${MAX_BUYS} transfer signings per offseason.`);
  const capacity = squadCapacity(s);
  if (roster.length < SQUAD_SIZE || roster.length > capacity) problems.push(capacity > SQUAD_SIZE ? `Your squad must have ${SQUAD_SIZE} to ${capacity} players (it would have ${roster.length}).` : `Your squad must have ${SQUAD_SIZE} players (it would have ${roster.length}).`);
  for (const role of ROLES) if (!roster.some((p) => p.role === role)) problems.push(`You need at least one natural ${role}.`);
  const sellIncome = team.players.filter((p) => sell.has(p.id)).reduce((t, p) => t + sellPrice(p), 0);
  const unsigned = intake.prospects.filter((p) => !plan.sign.includes(p.id));
  const teenIncome = unsigned.reduce((t, p) => t + teenSalePrice(p), 0);
  const buyCost = bought.reduce((t, l) => t + (l?.price ?? 0), 0);
  const moneyAfter = s.money + sellIncome + teenIncome - buyCost;
  // Debt never blocks the season (you can always refill the squad for free), it only stops you buying.
  if (buyCost > 0 && moneyAfter < 0) problems.push(`You cannot afford this: the balance would be ${fmtMoney(moneyAfter)}.`);
  return { ok: problems.length === 0, problems, size: roster.length, capacity, sellIncome, teenIncome, buyCost, moneyAfter, roster };
}

/** A sensible default: the best scouted prospect for each retiree's position, no selling, no buying. */
export function autoPlan(s: SeasonState): OffseasonPlan {
  const plan: OffseasonPlan = { sell: [], sign: [], buy: [] };
  if (!s.intake) return plan;
  const team = teamById(s, s.managedId);
  const taken = new Set<string>();
  for (const id of s.intake.retiring) {
    const role = team.players.find((p) => p.id === id)!.role;
    const best = s.intake.prospects.filter((p) => p.role === role && !taken.has(p.id)).sort((a, b) => (b.scouted ?? 0) - (a.scouted ?? 0))[0];
    if (best) {
      taken.add(best.id);
      plan.sign.push(best.id);
    }
  }
  // An earned extra place is filled with the best scouted prospect left, for the weakest position.
  const spare = squadCapacity(s) - (team.players.length - s.intake.retiring.length + plan.sign.length);
  for (let n = 0; n < spare; n++) {
    const have = (role: Role) => team.players.filter((p) => p.role === role && !s.intake!.retiring.includes(p.id)).length + plan.sign.filter((id) => s.intake!.prospects.find((p) => p.id === id)?.role === role).length;
    const best = s.intake.prospects.filter((p) => !taken.has(p.id)).sort((a, b) => have(a.role) - have(b.role) || (b.scouted ?? 0) - (a.scouted ?? 0))[0];
    if (!best) break;
    taken.add(best.id);
    plan.sign.push(best.id);
  }
  return plan;
}

/** Applies the manager's offseason plan. Throws (with the reason) if it is not valid. */
export function completeOffseason(prev: SeasonState, plan: OffseasonPlan): SeasonState {
  const check = checkPlan(prev, plan);
  if (!check.ok) throw new Error(check.problems[0]);
  const state = structuredClone(prev);
  const intake = state.intake!;
  const team = teamById(state, state.managedId);
  const news: string[] = [];
  const season = state.season;
  const retiring = new Set(intake.retiring);
  const sell = new Set(plan.sell);

  // A club never drops a player it has just listed for someone else's sale.
  const listed = new Set(intake.market.map((l) => l.player.id));
  // Sold players go to an AI club, replacing their weakest player in that position if they are better.
  for (const p of team.players.filter((x) => sell.has(x.id))) {
    const price = sellPrice(p);
    let target: { club: Team; weakest: Player } | null = null;
    for (const club of state.teams) {
      if (club.id === team.id) continue;
      const weakest = club.players.filter((x) => x.role === p.role && !listed.has(x.id)).sort((a, b) => playerValue(a) - playerValue(b))[0];
      if (weakest && (!target || playerValue(weakest) < playerValue(target.weakest))) target = { club, weakest };
    }
    news.push(`Sold ${p.name} (${p.role}, ${p.age}) to ${target?.club.name ?? "a club abroad"} for ${fmtMoney(price)}.`);
    if (target && playerValue(p) > playerValue(target.weakest)) {
      replacePlayer(target.club, target.weakest.id, structuredClone(p));
      delete state.careerStats[target.weakest.id];
    }
  }

  const joiners: Player[] = [];
  for (const id of plan.sign) {
    const p = intake.prospects.find((x) => x.id === id)!;
    joiners.push(p);
    news.push(`Signed prospect ${p.name} (${p.role}, ${p.age}).`);
  }
  let k = 0;
  for (const id of plan.buy) {
    const l = intake.market.find((x) => x.player.id === id)!;
    const club = teamById(state, l.clubId);
    const real = club.players.find((x) => x.id === id);
    if (!real) throw new Error(`${l.player.name} is no longer available`);
    // The selling club replaces them with a prospect, so the league keeps its numbers.
    const youngster = makeProspects(club, `${season}.b${k++}`, real.role, state.seed, 1)[0];
    replacePlayer(club, real.id, youngster);
    joiners.push(real);
    news.push(`Bought ${real.name} (${real.role}, ${real.age}) from ${club.name} for ${fmtMoney(l.price)}.`);
  }
  const unsigned = intake.prospects.filter((p) => !plan.sign.includes(p.id));
  if (unsigned.length) news.push(`Sold ${unsigned.length} unpicked prospects for ${fmtMoney(check.teenIncome)}.`);

  team.players = [...team.players.filter((p) => !retiring.has(p.id) && !sell.has(p.id)), ...joiners];
  for (const p of team.players) {
    delete p.retiring;
    delete p.scouted;
  }
  // Keep the starting five legal: anyone who left is replaced by the best natural fit.
  const used = new Set(team.lineup.filter((id) => team.players.some((p) => p.id === id)));
  team.lineup = team.lineup.map((id, i) => {
    if (team.players.some((p) => p.id === id)) return id;
    const rep = bestReplacement(team, ROLES[i], used);
    used.add(rep.id);
    return rep.id;
  });
  // Reserves who left are gone; top up with the weakest players outside the starting five. Everyone beyond
  // the matchday eight is a reserve, so an extra squad place means an extra reserve.
  team.reserves = (team.reserves ?? []).filter((id) => team.players.some((p) => p.id === id));
  while (team.reserves.length < Math.max(RESERVE_COUNT, team.players.length - 8)) {
    const next = team.players.filter((p) => !team.lineup.includes(p.id) && !team.reserves!.includes(p.id)).sort((a, b) => overall(a) - overall(b))[0];
    if (!next) break;
    team.reserves.push(next.id);
  }
  state.money = check.moneyAfter;
  delete state.intake;
  delete state.offers; // the UI makes you answer first; confirming the offseason anyway means staying
  state.news = [...news.map((text) => ({ season: state.season, matchday: 0, text })), ...state.news].slice(0, 14);
  return state;
}

// ------------------------------------------------------------------ job offers

/** Seasons you finished with the club you manage now. Older saves did not record the club, so those count. */
export function recordsAtCurrentClub(state: SeasonState): SeasonRecord[] {
  return state.history.filter((r) => !r.clubId || r.clubId === state.managedId);
}

/** Your last finish at the club you manage now, or undefined if you have not finished a season there. */
export function lastFinishHere(state: SeasonState): number | undefined {
  return recordsAtCurrentClub(state).at(-1)?.managedPosition;
}

/** At least this many seasons between approaches. */
const OFFER_MIN_GAP = 2;
/** After this many seasons without one, a manager doing well is always approached. */
const OFFER_SURE_GAP = 4;

/**
 * Offers from other clubs after a season. Never before two seasons are done, and never two years running.
 * Good results make an approach likely and bring strong clubs; middling ones bring mid-table clubs; poor
 * ones rarely bring anything, and then only from clubs near the bottom. Deterministic from the save seed.
 */
function buildOffers(state: SeasonState): ClubOffer[] {
  const done = state.season - 1;
  const hist = state.history;
  if (hist.length < 2) return [];
  const gap = done - (state.lastOfferSeason ?? 0);
  if (gap < OFFER_MIN_GAP) return [];
  const recent = recordsAtCurrentClub(state).slice(-2);
  if (!recent.length) return [];
  // Latest finish counts double; after a move only the seasons at the new club count.
  const perf = recent.length === 2 ? (2 * recent[1].managedPosition + recent[0].managedPosition) / 3 : recent[0].managedPosition;
  const tier: OfferTier = perf <= 3 ? "elite" : perf <= 5.5 ? "steady" : "lifeline";
  const rng = new Rng(hashSeed(state.seed, state.season, "offers"));
  let chance = tier === "elite" ? 0.45 : tier === "steady" ? 0.3 : 0.1;
  if (tier !== "lifeline") chance = Math.max(0.15, chance - 0.08 * (state.declinedTop ?? 0));
  const sure = tier !== "lifeline" && gap >= OFFER_SURE_GAP;
  if (!sure && !rng.chance(chance)) return [];

  const byRating = [...state.teams].sort((a, b) => teamRating(b) - teamRating(a));
  const others = byRating.filter((t) => t.id !== state.managedId);
  // The best clubs only ever come for a manager who is winning; a poor one hears from the bottom three.
  let pool = tier === "elite" ? others : tier === "steady" ? others.slice(2) : others.slice(-3);
  const count = tier === "lifeline" ? 1 : rng.chance(tier === "elite" ? 0.3 : 0.2) ? 2 : 1;
  const out: ClubOffer[] = [];
  for (let i = 0; i < count && pool.length; i++) {
    const club = rng.weighted(pool, (t) => Math.max(1, teamRating(t) - 50));
    pool = pool.filter((t) => t.id !== club.id);
    out.push(describeOffer(club, byRating.findIndex((t) => t.id === club.id), tier, rng));
  }
  return out;
}

function describeOffer(club: Team, rank: number, tier: OfferTier, rng: Rng): ClubOffer {
  const mandate = rank < 2 ? "Win the league" : rank < 4 ? "Finish in the top half" : rank < 6 ? "Stay clear of the bottom three" : rng.pick(["Avoid finishing bottom", "Rebuild and stay up"]);
  const budget = Math.max(1500, Math.round((2200 + (7 - rank) * 700 + rng.int(-500, 500)) / 100) * 100);
  const tags: string[] = [];
  const avgAge = club.players.reduce((t, p) => t + p.age, 0) / club.players.length;
  const room = club.players.reduce((t, p) => t + Math.max(0, (p.potential ?? overall(p)) - overall(p)), 0) / club.players.length;
  if (avgAge >= 28) tags.push("Ageing core");
  else if (avgAge <= 24.5) tags.push("Young squad");
  if (room >= 7) tags.push("Strong youth");
  const starters = club.lineup.map((id) => club.players.find((p) => p.id === id)!);
  const weakest = starters.reduce((w, p) => (overall(p) < overall(w) ? p : w));
  if (overall(weakest) < teamRating(club) - 6) tags.push(`Needs a ${weakest.role}`);
  if (!tags.length) tags.push("Settled squad");
  return { clubId: club.id, tier, mandate, budget, tags: tags.slice(0, 2) };
}

/** Take the job. The club you leave is run by the AI from now on and the squad you join is the one it already has. */
export function acceptOffer(prev: SeasonState, clubId: string): SeasonState {
  const offer = prev.offers?.find((o) => o.clubId === clubId);
  if (!offer) throw new Error("That offer is no longer open");
  const state = structuredClone(prev);
  const old = teamById(state, state.managedId);
  // Players who were about to retire from the club you leave are replaced the way the AI does it.
  let n = 0;
  for (const r of old.players.filter((p) => p.retiring)) {
    const best = makeProspects(old, `${state.season}.t${n++}`, r.role, state.seed).sort((a, b) => (b.potential ?? 0) - (a.potential ?? 0))[0];
    replacePlayer(old, r.id, best);
    delete state.careerStats[r.id];
  }
  // AI clubs run a squad of ten: the extra places you earned go, and the weakest spare players are released.
  while (old.players.length > SQUAD_SIZE) {
    const spare = old.players.filter((p) => !old.lineup.includes(p.id)).sort((a, b) => overall(a) - overall(b))[0];
    old.players = old.players.filter((p) => p.id !== spare.id);
    old.reserves = (old.reserves ?? []).filter((id) => id !== spare.id);
    delete state.careerStats[spare.id];
  }
  // A project in progress is finished for the club you leave: it is paid for and belongs to them.
  if (state.project) state.news = [finishProject(state, 0), ...state.news];
  delete state.proposal;
  const club = teamById(state, clubId);
  state.managedId = clubId;
  state.tactic = club.style;
  state.shape = SHAPE_BY_STYLE[club.style];
  state.money = offer.budget;
  if (state.extraSlots) state.news = [{ season: state.season, matchday: 0, text: `The extra squad places you earned stay with ${old.name}: the spare players are released.` }, ...state.news];
  delete state.extraSlots;
  state.trainGains = {};
  state.declinedTop = 0;
  delete state.offers;
  state.deals = sponsorOffers(state);
  delete state.fanPassed;
  state.intake = buildIntake(state, []);
  const text = `You leave ${old.name} and take over ${club.name}. Board mandate: ${offer.mandate.toLowerCase()}. Starting balance ${fmtMoney(offer.budget)}.`;
  state.news = [{ season: state.season, matchday: 0, text }, ...state.news].slice(0, 14);
  return state;
}

/** Stay where you are. Turning down a strong offer makes the next approach slightly less likely. */
export function declineOffers(prev: SeasonState): SeasonState {
  const state = structuredClone(prev);
  if (state.offers?.some((o) => o.tier !== "lifeline")) state.declinedTop = (state.declinedTop ?? 0) + 1;
  delete state.offers;
  const me = teamById(state, state.managedId);
  state.news = [{ season: state.season, matchday: 0, text: `You turn down the offers and stay at ${me.name}.` }, ...state.news].slice(0, 14);
  return state;
}
