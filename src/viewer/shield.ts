import { h } from "../dom";
import { fmtMoney } from "../league/economy";
import { FACILITIES, FACILITY_IDS, MAX_FACILITY_LEVEL } from "../league/facilities";
import { teamRating } from "../league/teams";
import {
  ROUND_NAMES,
  SHIELD_WINS,
  currentRound,
  legacyReport,
  leagueOf,
  managedTie,
  reachedText,
  requestText,
  shieldOf,
  shieldPending,
  tieLine,
  type ShieldTie,
  type Tournament,
} from "../league/shield";
import type { SeasonState } from "../league/season";

const card = (title: string, ...kids: (Node | string)[]) => h("section", { class: "card" }, h("h2", {}, title), ...kids);
/** Her role is stated once, on the request. Everywhere else she is just "Mrs. Daniel". */
const quote = (text: string, intro = false) => h("blockquote", { class: "daniel" }, h("div", { class: "who" }, intro ? "Mrs. Daniel, owner" : "Mrs. Daniel"), text);

function table(head: string[], rows: (string | Node)[][]): HTMLElement {
  const body = h("tbody");
  for (const r of rows) body.append(h("tr", {}, ...r.map((c, i) => h("td", { class: i === 0 ? "club" : "" }, c))));
  return h("table", { class: "squad" }, h("thead", {}, h("tr", {}, ...head.map((x, i) => h("th", { class: i === 0 ? "club" : "" }, x)))), body);
}

/** "Dominion 3 - 2 Pinnacle", with a pip for each Shield won so far out of five. */
export function scoreboard(s: SeasonState): HTMLElement {
  const { score } = shieldOf(s);
  const pips = (n: number) => h("span", { class: "pips" }, ...Array.from({ length: SHIELD_WINS }, (_, i) => h("i", { class: i < n ? "on" : "" })));
  return h("div", { class: "shield-score" },
    h("div", { class: "lg dom" }, h("b", {}, "Dominion"), pips(score.dominion)),
    h("div", { class: "big" }, `${score.dominion} - ${score.pinnacle}`),
    h("div", { class: "lg pin" }, h("b", {}, "Pinnacle"), pips(score.pinnacle)));
}

/** Mrs. Daniel's request, shown after the final matchday until you answer. */
export function requestCard(s: SeasonState, accept: () => void, decline: () => void): HTMLElement {
  const yes = h("button", { class: "primary" }, "Stand for Dominion");
  yes.onclick = accept;
  const no = h("button", {}, "Not this season");
  no.onclick = decline;
  return card("The Founders' Shield", ...requestText(s).map((t, i) => quote(t, i === 0)), h("div", { class: "toolbar" }, yes, no), h("div", { class: "hint" }, "Declining costs nothing. She will ask again later."));
}

function tieBox(t: Tournament, tie: ShieldTie, onReplay?: (id: string) => void): HTMLElement {
  const r = tie.result;
  const side = (id: string, score?: number) =>
    h("div", { class: `side ${leagueOf(t, id)}${id === t.managedId ? " you" : ""}${r && r.winner === id ? " win" : ""}` }, h("span", {}, t.clubs[id].name), h("b", {}, score === undefined ? "" : String(score)));
  const box = h("div", { class: "tie", title: tieLine(t, tie) }, side(tie.a, r?.aScore), side(tie.b, r?.bScore));
  if (r?.decider) box.append(h("div", { class: "hint" }, r.decider === "tries" ? "level: more tries" : "level: golden point"));
  if (onReplay && r && (tie.a === t.managedId || tie.b === t.managedId)) {
    const b = h("button", { class: "ghost" }, "Replay");
    b.onclick = () => onReplay(tie.id);
    box.append(b);
  }
  return box;
}

/** The bracket drawn so far, round by round. */
export function bracket(t: Tournament, onReplay?: (id: string) => void): HTMLElement {
  const cols = (["prelim", "quarter", "semi", "final"] as const).map((id) => {
    const round = t.rounds.find((r) => r.id === id);
    return h("div", { class: "round" }, h("div", { class: "rname" }, ROUND_NAMES[id]), ...(round ? round.ties.map((x) => tieBox(t, x, onReplay)) : [h("div", { class: "hint" }, "To be drawn")]));
  });
  return h("div", { class: "bracket" }, ...cols);
}

export interface ShieldActions {
  watch: () => void;
  play: () => void;
  replay: (id: string) => void;
  busy: boolean;
}

/** This year's tournament: the bracket, and the buttons to play your next tie or play the round out. */
export function tournamentCard(s: SeasonState, act: ShieldActions): HTMLElement {
  const sh = shieldOf(s);
  const t = sh.tournament!;
  const kids: (Node | string)[] = [scoreboard(s)];
  const mine = managedTie(s);
  const round = currentRound(t);
  if (shieldPending(s) && round) {
    if (mine) {
      const foeId = mine.a === s.managedId ? mine.b : mine.a;
      const rating = (id: string) => teamRating(sh.pinnacle.find((c) => c.team.id === id)?.team ?? s.teams.find((c) => c.id === id)!);
      const watch = h("button", { class: "primary big", disabled: act.busy }, "▶ Watch match");
      watch.onclick = act.watch;
      const sim = h("button", { disabled: act.busy }, "Quick sim (Space)");
      sim.onclick = act.play;
      kids.push(h("p", {}, h("b", {}, ROUND_NAMES[round.id]), `: ${t.clubs[mine.a].name} v ${t.clubs[mine.b].name}`), h("div", { class: "dim" }, `You play ${t.clubs[foeId].name}, rated ${rating(foeId)} against your ${rating(s.managedId)}. A knockout: someone goes through.`), h("div", { class: "toolbar" }, watch, sim));
    } else {
      const go = h("button", { class: "primary", disabled: act.busy }, round.id === "prelim" ? "Play the preliminary round (Space)" : t.outAt ? `Play on: ${ROUND_NAMES[round.id].toLowerCase()} (Space)` : `Play the ${ROUND_NAMES[round.id].toLowerCase()} (Space)`);
      go.onclick = act.play;
      kids.push(h("p", {}, round.id === "prelim" ? "Your club is seeded into the quarter-finals. The preliminary round decides the last two places." : `You are out in the ${ROUND_NAMES[t.outAt!].toLowerCase()}. Play on to see who takes the Shield.`), h("div", { class: "toolbar" }, go));
    }
  } else if (t.winnerId) {
    const w = t.clubs[t.winnerId];
    kids.push(h("p", {}, h("b", {}, `${w.name} win the Founders' Shield.`), t.winnerId === t.managedId ? " Your club." : ""));
    if (sh.message) kids.push(quote(sh.message));
  }
  kids.push(bracket(t, act.replay));
  return card(`Founders' Shield, season ${t.season}`, ...kids);
}

/** The Shield tab: the campaign so far, the Pinnacle clubs and your own record. */
export function shieldView(s: SeasonState, act: ShieldActions): HTMLElement {
  const sh = shieldOf(s);
  const left = h("div", { class: "col" });
  left.append(card("Ownership of Dominion League", scoreboard(s), h("div", { class: "hint" }, `Best of nine: the first league to win ${SHIELD_WINS} Founders' Shields owns Dominion League. Results never reset.`), ...(sh.message ? [quote(sh.message)] : [])));
  if (sh.tournament && (shieldPending(s) || sh.tournament.winnerId)) left.append(tournamentCard(s, act));
  const history = sh.campaign.length
    ? table(["Season", "Winners", "Runners-up", "Final", "You"], [...sh.campaign].reverse().map((r) => [`Season ${r.season}`, `${r.winnerName}${r.league === "pinnacle" ? " (P)" : ""}`, r.runnerUpName, r.score, reachedText(r.reached)]))
    : h("div", { class: "hint" }, "No Shield has been played yet.");
  left.append(card("Campaign history", history));

  const p = sh.personal;
  const defeated = Object.entries(p.defeated).sort((a, b) => b[1] - a[1]);
  const right = h("div", { class: "col" });
  right.append(card("Your Shield record",
    h("div", { class: "rv-row" }, h("span", { class: "dim" }, "Tournaments"), h("span", {}, String(p.tournaments))),
    h("div", { class: "rv-row" }, h("span", { class: "dim" }, "Shields won"), h("span", {}, String(p.shields))),
    h("div", { class: "rv-row" }, h("span", { class: "dim" }, "Finals reached"), h("span", {}, String(p.finals))),
    h("div", { class: "rv-row" }, h("span", { class: "dim" }, "Matches"), h("span", {}, `${p.won} won, ${p.played - p.won} lost`)),
    h("div", { class: "hint" }, defeated.length ? `Clubs beaten: ${defeated.map(([n, c]) => (c > 1 ? `${n} ×${c}` : n)).join(", ")}.` : "No club beaten yet.")));
  right.append(card("Pinnacle League clubs", table(["Club", "Rating", "Shields", "Finals", "W-L", "v you"], sh.pinnacle.map((c) => [c.team.name, String(teamRating(c.team)), String(c.record.shields), String(c.record.finals), `${c.record.won}-${c.record.played - c.record.won}`, `${c.record.lostToYou}-${c.record.beatYou}`])), h("div", { class: "hint" }, "“v you” is your wins to theirs in Shield matches. Pinnacle clubs keep their squads and records from year to year.")));
  return h("div", { class: "grid" }, left, right);
}

function legacyCard(s: SeasonState): HTMLElement {
  const r = legacyReport(s);
  const row = (a: string, b: string) => h("div", { class: "rv-row" }, h("span", { class: "dim" }, a), h("span", {}, b));
  return card("Your career",
    row("Seasons", String(r.seasons)),
    row("League titles", String(r.titles)),
    row("Best finish", r.bestFinish ? `${r.bestFinish}` : "-"),
    row("Founders' Shields won", String(r.shields)),
    row("Clubs managed", r.clubs.join(", ")),
    row("Final balance", fmtMoney(r.money)),
    row("Facilities", FACILITY_IDS.map((id) => `${FACILITIES[id].name} ${r.facilities[id]}/${MAX_FACILITY_LEVEL}`).join(" · ")),
    h("div", { class: "hint" }, "Notable players"),
    table(["Player", "Role", "Apps", "Points", "Tries"], r.notable.map((p) => [p.name, p.role, String(p.apps), String(p.points), String(p.tries)])));
}

/** The closing scene: the victory that lets the career go on, or the loss that ends it. */
export function endingView(s: SeasonState, kind: "lost" | "defended", done: () => void): HTMLElement {
  const sh = shieldOf(s);
  const lost = kind === "lost";
  const personal = sh.personal.shields
    ? `${sh.personal.shields} of the ${sh.campaign.length} Shields in this campaign were won by your club.`
    : "Your club did not win a Shield in this campaign.";
  const women = s.gender === "women";
  const words = lost
    ? ["Five Shields to Pinnacle. The league is theirs.", women ? "Our women gave everything. Never doubt what they showed." : "Thank you for everything."]
    : ["Five Shields. Dominion League is ours.", women ? "To every girl who watched: this is yours." : sh.personal.shields ? "Your club carried us. Thank you." : "Thank you."];
  const btn = h("button", { class: "primary big" }, lost ? "Begin a new career" : "Continue your career");
  btn.onclick = done;
  const defeated = Object.entries(sh.personal.defeated).sort((a, b) => b[1] - a[1]);
  return h("div", { class: `ending ${kind}` },
    h("div", { class: "nt-kicker" }, lost ? "THE END OF YOUR CAREER" : "DOMINION LEAGUE ENDURES"),
    h("h1", {}, lost ? "Pinnacle League takes control" : "Dominion League is saved"),
    scoreboard(s),
    ...words.map((t) => quote(t)),
    h("div", { class: "grid" },
      h("div", { class: "col" },
        card("Founders' Shield campaign", table(["Season", "Winners", "Runners-up", "Final", "You"], sh.campaign.map((r) => [`Season ${r.season}`, `${r.winnerName}${r.league === "pinnacle" ? " (P)" : ""}`, r.runnerUpName, r.score, reachedText(r.reached)]))),
        card("Your Shield record", h("p", {}, personal), h("div", { class: "hint" }, `${sh.personal.played} matches: ${sh.personal.won} won, ${sh.personal.played - sh.personal.won} lost. ${sh.personal.finals} finals.`), h("div", { class: "hint" }, defeated.length ? `Clubs defeated: ${defeated.map(([n, c]) => (c > 1 ? `${n} ×${c}` : n)).join(", ")}.` : "No club defeated."))),
      h("div", { class: "col" }, lost ? legacyCard(s) : card("Dominion's defence", h("p", {}, "The ownership storyline is over, but your career and every season after it carry on."), legacyCard(s)))),
    h("div", { class: "toolbar" }, btn));
}
