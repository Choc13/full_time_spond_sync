import { JSDOM } from "jsdom";
import { extractClubPage } from "../src/adapters/clubPage";
import type { Setup } from "../src/domain/settings";
import { SYNC_MARKER, withSyncMarker } from "../src/domain/plan";
import type { ClubPage, Group, Location, Spond, Team } from "../src/domain/types";
import rustOutput from "./golden/rust-output.json";
import scenario from "./golden/scenario.json";
import venues from "./golden/venues.json";

export const NOW = Date.UTC(2026, 10, 2);
export const TEAM_ID = 14943433;
export const group = scenario.group as unknown as Group;
/** The scenario's events as they were before the sync marked its own events. */
export const unmarkedSponds = scenario.sponds as unknown as Spond[];
/** The scenario's events, all made by the sync. */
export const sponds: Spond[] = unmarkedSponds.map((s) => ({ ...s, description: withSyncMarker(s.description) }));
/** What the Rust client sent for the scenario, plus the marker this app adds to its own events. */
export const expected = {
  creates: rustOutput.creates.map((c) => ({ ...c, description: SYNC_MARKER })),
  updates: rustOutput.updates.map((u) => ({ ...u, description: withSyncMarker(u.description) })),
  removed: rustOutput.removed,
};
export const team: Team = { label: "Meteors", fullTimeId: TEAM_ID, fullTimeName: scenario.team_name, subGroupId: scenario.sub_group_id };

export const setup: Setup = {
  name: "Twyford Comets FC U10",
  fullTime: { seasonId: 669507446, ageGroupId: 13, clubId: 649312641 },
  spondGroupId: group.id,
  teams: [team],
  venues: Object.entries(venues).map(([fullTimeName, location]) => ({ fullTimeName, location: location as Location })),
  ignoredOpponents: [],
};

const td = (cls: string, html: string) => `<td class="${cls}"> <a href="/displayFixture.html?id=1"> ${html} </a> </td>`;

/** The scenario's fixtures as Full-Time's club fixtures page, with other club teams' fixtures mixed in. */
export const clubPageHtml = (options: { teams?: { id: number; name: string }[]; extraRows?: string[] } = {}): string => {
  const old = new JSDOM(scenario.html).window.document;
  const text = (e: Element) => (e.textContent ?? "").replace(/\s+/g, " ").trim();
  const row = (type: string, date: string, time: string, home: string, away: string, venue: string) =>
    `<tr class="">${td("bold", type)}${td("left", `<span>${date}</span> <span class="color-dark-grey">${time}</span>`)}${td("home-team right", home)}<td class="team-logo"></td>${td("score", "VS")}<td class="team-logo"></td>${td("road-team left", away)}${td("left", venue)}${td("left", "UNDER 10 - DD")}<td class="status-notes center"> </td></tr>`;
  const rows = [...old.querySelectorAll("tbody tr")].map((tr) => {
    const c = [...tr.querySelectorAll("td")];
    const [date, time] = [...c[1].querySelectorAll("span")].map(text);
    return row(text(c[0]), date, time, text(c[2]), text(c[6]), text(c[7]));
  });
  const other = row("L", "14/11/26", "09:00", "Twyford Comets FC U10 Galaxy", "Burghfield U10 Bolts", "Somewhere Unmapped");
  const teams = options.teams ?? [
    { id: 169375196, name: "Twyford Comets FC U10 Galaxy" },
    { id: TEAM_ID, name: scenario.team_name },
  ];
  return `<!doctype html><html><head><script>window.ran = 1</script><title>Fixtures</title></head><body>
<select id="form1_selectedFixtureGroupAgeGroup"><option value="12">Under 9</option><option value="13" selected="selected">Under 10</option></select>
<select id="form1_selectedTeam"><option value="">All</option>${teams.map((t) => `<option value="${t.id}">${t.name}</option>`).join("")}</select>
<div class="fixtures-table table-scroll"><table><thead><tr><th>Type</th></tr></thead><tbody>${[other, ...rows, ...(options.extraRows ?? [])].join("")}</tbody></table></div></body></html>`;
};

/** Runs code as the WebView would: a fresh page that doesn't execute the fetched HTML's scripts. */
export const runInWebView = (code: string): unknown => new JSDOM("<!doctype html>", { runScripts: "outside-only" }).window.eval(code);

export const extract = (html: string, status = 200): ClubPage => ({
  status,
  ...JSON.parse(runInWebView(`JSON.stringify((${extractClubPage.toString()})(${JSON.stringify(html)}))`) as string),
});
