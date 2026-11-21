import { h } from "../dom";
import { LEGEND_MIN_SEASONS, RECORD_KEYS, RECORD_META } from "../league/history";
import { alongside, chronicleItems, followedTeamNarration, isLive, type EraProspect } from "../league/era";
import { reachedText } from "../league/shield";
import { overall } from "../league/teams";
import { isSeasonOver, seasonRecordFor, teamById, type SeasonRecord, type SeasonState } from "../league/season";

const ord = (n: number) => `${n}${n >= 11 && n <= 13 ? "th" : (["th", "st", "nd", "rd"][n % 10] ?? "th")}`;
const name = (s: SeasonState, id?: string) => (id ? teamById(s, id).name : "-");

/** Completed seasons, plus the season just finished if the next one has not started yet. */
export function allSeasons(s: SeasonState): SeasonRecord[] {
  const done = [...s.history];
  if (isSeasonOver(s) && !done.some((r) => r.season === s.season)) done.push(seasonRecordFor(s));
  return done;
}

function table(head: string[], rows: (string | HTMLElement)[][], cls = "squad"): HTMLElement {
  const t = h("table", { class: cls }, h("thead", {}, h("tr", {}, ...head.map((x, i) => h("th", { class: i === 0 ? "club" : "" }, x)))));
  const body = h("tbody");
  for (const r of rows) body.append(h("tr", {}, ...r.map((c, i) => h("td", { class: i === 0 ? "club" : "" }, c))));
  t.append(body);
  return t;
}

/** Champions by year. */
export function championsCard(s: SeasonState): HTMLElement {
  const seasons = allSeasons(s);
  const sec = h("section", { class: "card" }, h("h2", {}, "Champions by year"));
  if (!seasons.length) return (sec.append(h("div", { class: "hint" }, "No seasons completed yet. Each champion is recorded here at the end of the season.")), sec);
  const titles = new Map<string, number>();
  for (const r of seasons) titles.set(r.championId, (titles.get(r.championId) ?? 0) + 1);
  const rows = [...seasons].reverse().map((r) => [
    `Season ${r.season}`,
    name(s, r.championId) + (r.championPoints !== undefined ? ` (${r.championPoints} pts)` : ""),
    name(s, r.runnerUpId),
    r.topScorer ? `${r.topScorer.name}, ${name(s, r.topScorer.clubId)} (${r.topScorer.points})` : "-",
    r.clubId ? `${name(s, r.clubId)}: ${r.managedPosition}` : String(r.managedPosition),
  ]);
  sec.append(table(["Season", "Champions", "Runners-up", "Top scorer (pts)", "You finished"], rows));
  const counts = [...titles].sort((a, b) => b[1] - a[1]).map(([id, n]) => `${name(s, id)} ${n}`);
  sec.append(h("div", { class: "hint" }, `Titles: ${counts.join(", ")}.`));
  return sec;
}

/** Founders' Shield winners by year; empty until the first tournament has been played. */
export function shieldHistoryCard(s: SeasonState): HTMLElement | null {
  const camp = s.shield?.campaign ?? [];
  if (!camp.length) return null;
  const sec = h("section", { class: "card" }, h("h2", {}, "Founders' Shield by year"));
  sec.append(table(["Season", "Winners", "Runners-up", "Final", "You"], [...camp].reverse().map((r) => [`Season ${r.season}`, `${r.winnerName}${r.league === "pinnacle" ? " (P)" : ""}`, r.runnerUpName, r.score, reachedText(r.reached)])));
  sec.append(h("div", { class: "hint" }, "(P) marks a Pinnacle club."));
  return sec;
}

/** One club's records and retired legends, with a picker for which club. */
export function clubCard(s: SeasonState, clubId: string, pick: (id: string) => void): HTMLElement {
  const recs = s.records[clubId];
  const select = h("select", { title: "Choose a club" });
  for (const t of s.teams) select.append(h("option", { value: t.id, selected: t.id === clubId }, t.name));
  select.onchange = () => pick(select.value);
  const sec = h("section", { class: "card" }, h("h2", {}, "Club records"), h("div", { class: "toolbar" }, select));
  if (recs) {
    const rows = RECORD_KEYS.map((k) => {
      const r = recs[k];
      const who = RECORD_META[k].kind === "player" ? r.holder : r.vs ? `vs ${r.vs}` : "";
      const when = r.season === 0 ? "Before the league" : `Season ${r.season}`;
      return [RECORD_META[k].label, String(r.value), who || "-", r.season === 0 ? when : r.vs && RECORD_META[k].kind === "player" ? `${when}, vs ${r.vs}` : when];
    });
    sec.append(table(["Record", "Value", "Holder", "Set"], rows));
    sec.append(h("div", { class: "hint" }, "Founding records are set by the club's standing before the league began. Break one and it goes in the club news."));
  }
  const legends = s.legends[clubId] ?? [];
  sec.append(h("h2", { class: "sub" }, "Retired legends"));
  if (!legends.length) sec.append(h("div", { class: "hint" }, `Players who retire after ${LEGEND_MIN_SEASONS} or more seasons are remembered here, by the club they retired from.`));
  else sec.append(table(["Player", "Role", "Retired", "Seasons", "Apps", "Points", "Tries", "Tackles"], legends.map((l) => [l.name, l.role, `Season ${l.season}, age ${l.age}`, String(l.seasons), String(l.apps), String(l.points), String(l.tries), String(l.tackles)])));
  return sec;
}

/** Where a followed player is now, as a fact. */
function whereNow(s: SeasonState, e: EraProspect): string {
  const club = s.teams.find((t) => t.players.some((p) => p.id === e.id));
  if (e.status === "playing" && club) return `${club.name}`;
  if (e.status === "intake") return "On the youth shortlist";
  if (e.status === "unattached") return "Without a club";
  if (e.status === "retired") return "Retired";
  return "No longer followed";
}

const STATUS_CHIP: Record<string, [string, string]> = { playing: ["PLAYING", "g"], intake: ["SHORTLIST", "y"], unattached: ["NO CLUB", "y"], retired: ["RETIRED", "r"], closed: ["CLOSED", "r"] };

/** One followed career: who they are, their story as a timeline, who they played alongside, then the seasons. */
function careerPanel(s: SeasonState, e: EraProspect): HTMLElement {
  const nameOf = (id: string) => teamById(s, id).name;
  const club = s.teams.find((t) => t.players.some((p) => p.id === e.id));
  const p = club?.players.find((x) => x.id === e.id);
  const teamContext = club ? followedTeamNarration(s.eraProspects ?? [], club) : null;
  const [chipText, chipCls] = STATUS_CHIP[e.status] ?? ["", ""];
  const facts = [e.role, whereNow(s, e), ...(p ? [`age ${p.age}`, `overall ${overall(p)}`] : [])].join(" · ");
  const panel = h("section", { class: `career ${isLive(e) ? "" : "over"}` },
    h("div", { class: "career-head" }, h("h3", {}, e.name), h("span", { class: `card-chip ${chipCls}` }, chipText)),
    h("div", { class: "hint" }, facts),
    teamContext ? h("div", { class: "career-context" }, teamContext) : null);

  const items = chronicleItems(e, nameOf);
  const story = h("ol", { class: "timeline" }, ...items.map((i) => h("li", { class: i.story ? "story" : "" }, h("span", { class: "when" }, `S${i.season}`), h("span", { class: "what" }, i.text))));
  const others = alongside(e, nameOf);
  const mate = (o: (typeof others)[number]) => h("div", { class: "mate" }, h("b", {}, o.club ? `${o.name} (${o.club})` : o.name), h("span", { class: "dim" }, o.what.join(" · ")));
  const teammates = others.filter((o) => !o.club);
  const rivals = others.filter((o) => o.club);
  const side = h("div", { class: "alongside" },
    h("h4", {}, "Teammates"), ...(teammates.length ? teammates.map(mate) : [h("div", { class: "hint" }, "No teammate has stood out yet.")]),
    h("h4", {}, "Opponents"), ...(rivals.length ? rivals.map(mate) : [h("div", { class: "hint" }, "No opponent has stood out yet.")]));
  panel.append(h("div", { class: "career-body" }, h("div", {}, h("h4", {}, "Story"), story), side));
  if (e.summary) panel.append(h("div", { class: "career-end" }, e.summary));

  panel.append(h("h4", {}, "Season by season"));
  if (e.seasons.length) panel.append(table(["Season", "Club", "Club finished", "Age", "Overall", "Apps", "Points"], e.seasons.map((x) => [`Season ${x.season}`, nameOf(x.clubId), x.position ? ord(x.position) : "-", x.age ? String(x.age) : "-", x.overall ? String(x.overall) : "-", x.matches ? `${x.apps} of ${x.matches}` : String(x.apps), String(x.points ?? 0)])));
  else if (e.status === "unattached") panel.append(h("div", { class: "hint" }, `No club yet. ${e.windowLeft ?? 0} ${e.windowLeft === 1 ? "offseason" : "offseasons"} left in which a club may sign them.`));
  else if (e.status === "playing") panel.append(h("div", { class: "hint" }, "No season on a roster completed yet."));
  else panel.append(h("div", { class: "hint" }, "No seasons on a roster."));
  return panel;
}

/** The careers Dominion follows, as tabs: live careers first, then retired or closed ones greyed, newest first in each. */
export function followedCard(s: SeasonState, selected: string | null, pick: (id: string) => void): HTMLElement {
  const sec = h("section", { class: "card" }, h("h2", {}, "Followed careers"));
  const list = [...(s.eraProspects ?? [])].sort((a, b) => Number(isLive(b)) - Number(isLive(a)) || b.introducedSeason - a.introducedSeason);
  if (!list.length) return (sec.append(h("div", { class: "hint" }, "Now and then a youth intake marks one prospect. Dominion follows that career and keeps its facts here, whatever happens to them.")), sec);
  const current = list.find((e) => e.id === selected) ?? list[0];
  const tabs = h("div", { class: "career-tabs", role: "tablist" });
  for (const e of list) {
    const over = !isLive(e);
    const b = h("button", { class: `career-tab ${e.id === current.id ? "active" : ""} ${over ? "over" : ""}`, role: "tab", title: over ? `${e.name} has ${e.status === "retired" ? "retired" : "left the league"}` : e.name }, e.name, over ? h("small", {}, e.status === "retired" ? "retired" : "closed") : null);
    b.onclick = () => pick(e.id);
    tabs.append(b);
  }
  sec.append(tabs, careerPanel(s, current));
  return sec;
}
