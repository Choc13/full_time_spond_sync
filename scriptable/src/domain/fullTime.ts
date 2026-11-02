import { londonToInstant } from "./london";
import type { Fixture, FixtureType, FixturesPage, Instant, PageRow, Team, VenueKey } from "./types";

const parseFixtureType = (cell: string): FixtureType => {
  const value = cell.trim().toLowerCase();
  if (value === "l" || value === "o") return "league";
  if (value === "cup") return "cup";
  throw new Error(`Unknown fixture type "${value}"`);
};

const parseFixtureTime = (spans: string[]): Instant => {
  if (spans.length !== 2) throw new Error("Expected a date and a time in the fixture row");
  const text = `${spans[0].trim()} ${spans[1].trim()}`;
  const match = /^(\d{1,2})\/(\d{1,2})\/(\d{2}) (\d{1,2}):(\d{2})$/.exec(text);
  if (!match) throw new Error(`Invalid fixture date "${text}"`);
  const [day, month, year, hour, minute] = match.slice(1).map(Number);
  return londonToInstant(2000 + year, month, day, hour, minute);
};

const parseVenue = (cell: string): VenueKey => {
  const name = cell.trim().toLowerCase();
  if (name.includes("goals")) return "goals";
  if (name.includes("woodford")) {
    if (name.includes("grass")) return "woodfordParkGrass";
    if (name.includes("3g")) return "woodfordPark3G";
    throw new Error(`Unknown Woodford venue type "${name}"`);
  }
  if (name.includes("kings academy")) return "kingsAcademy";
  if (name.includes("cintra park")) return "cintraPark";
  if (name.includes("north street theale")) return "northStreetTheale";
  throw new Error(`Unknown venue "${name}". It needs adding to the app.`);
};

const oppositionFrom = (texts: string[], teamName: string): string | null => {
  if (texts.length !== 1) throw new Error("Expected one team link in the fixture row");
  return texts[0].toLowerCase() === teamName.toLowerCase() ? null : texts[0];
};

const parseFixtureRow = (row: PageRow, teamName: string): Fixture => {
  if (row.cellCount !== 8) throw new Error(`Expected 8 cells in a fixture row, found ${row.cellCount}`);
  const home = oppositionFrom(row.home, teamName);
  const away = oppositionFrom(row.away, teamName);
  if ((home === null) === (away === null)) throw new Error(`${teamName} was not listed as exactly one of home or away`);
  return {
    type: parseFixtureType(row.type),
    side: home === null ? "home" : "away",
    at: parseFixtureTime(row.dateSpans),
    opposition: (home === null ? away : home) as string,
    venue: parseVenue(row.venue),
  };
};

/**
 * A challenge or error page contains no fixtures table. Without these checks it would
 * look like a team with no fixtures, and that team's upcoming events would be deleted.
 */
export const parseFixturesPage = (page: FixturesPage, team: Team, now: Instant): Fixture[] => {
  if (page.status !== 200) throw new Error(`Full-Time returned HTTP ${page.status} for ${team.name}`);
  if (!page.teamNameFound) throw new Error(`The Full-Time page for ${team.name} doesn't mention "${team.fullTimeName}", so it may be a block page`);
  if (page.tableCount > 1) throw new Error(`Expected one fixtures table for ${team.name}, found ${page.tableCount}`);
  return page.rows.map((row) => parseFixtureRow(row, team.fullTimeName)).filter((fixture) => fixture.at >= now);
};
