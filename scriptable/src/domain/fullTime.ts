import { londonToInstant } from "./london";
import { ITEMS_PER_PAGE } from "./settings";
import type { ClubPage, ClubPageRow, Fixture, FixtureType, Instant, Team } from "./types";

const parseFixtureType = (cell: string): FixtureType => {
  const value = cell.trim().toLowerCase();
  if (value === "l" || value === "o") return "league";
  if (value === "cup") return "cup";
  throw new Error(`Unknown fixture type "${cell.trim()}"`);
};

const parseFixtureTime = (spans: string[]): Instant => {
  if (spans.length !== 2) throw new Error("Expected a date and a time in the fixture row");
  const text = `${spans[0].trim()} ${spans[1].trim()}`;
  const match = /^(\d{1,2})\/(\d{1,2})\/(\d{2}) (\d{1,2}):(\d{2})$/.exec(text);
  if (!match) throw new Error(`Invalid fixture date "${text}"`);
  const [day, month, year, hour, minute] = match.slice(1).map(Number);
  return londonToInstant(2000 + year, month, day, hour, minute);
};

const same = (a: string, b: string): boolean => a.trim().toLowerCase() === b.trim().toLowerCase();

const parseRow = (row: ClubPageRow, teamName: string): Fixture => {
  const home = same(row.home, teamName);
  return {
    type: parseFixtureType(row.type),
    side: home ? "home" : "away",
    at: parseFixtureTime(row.dateSpans),
    opposition: (home ? row.away : row.home).trim(),
    venue: row.venue.replace(/\s+/g, " ").trim(),
  };
};

/**
 * Reads each team's upcoming fixtures from the club fixtures page.
 *
 * A block or error page has no team filter, and would otherwise look like a club with no
 * fixtures, deleting every upcoming event. A page cut off at the page size would silently
 * drop fixtures, so that is refused too.
 */
export const parseClubFixtures = (page: ClubPage, teams: Team[], now: Instant): Map<Team, Fixture[]> => {
  if (page.status !== 200) throw new Error(`Full-Time returned HTTP ${page.status}`);
  if (page.teams.length === 0) throw new Error("The Full-Time page has no team list, so it may be a block page. Nothing was changed.");
  if (page.tableCount > 1) throw new Error(`Expected one fixtures table on Full-Time, found ${page.tableCount}`);
  if (page.rows.length >= ITEMS_PER_PAGE) throw new Error(`Full-Time listed ${page.rows.length} fixtures, which may not be all of them. Nothing was changed.`);

  return new Map(
    teams.map((team): [Team, Fixture[]] => {
      // Match on Full-Time's current name for the team ID, in case the team was renamed.
      const listed = page.teams.find((t) => t.id === team.fullTimeId);
      if (!listed) throw new Error(`${team.label} (${team.fullTimeName}) isn't in Full-Time's team list for this age group any more. Set the age group up again.`);
      const fixtures = page.rows
        .filter((row) => same(row.home, listed.name) || same(row.away, listed.name) || (row.cellCount !== 10 && row.text.toLowerCase().includes(listed.name.toLowerCase())))
        .map((row) => {
          if (row.cellCount !== 10) throw new Error(`Couldn't read a Full-Time fixture for ${team.label}: expected 10 cells, found ${row.cellCount}`);
          if (same(row.home, listed.name) && same(row.away, listed.name)) throw new Error(`${team.label} is listed as playing itself on Full-Time`);
          return parseRow(row, listed.name);
        })
        .filter((fixture) => fixture.at >= now);
      return [team, fixtures];
    }),
  );
};
