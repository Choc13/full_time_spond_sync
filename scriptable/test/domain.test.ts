import { describe, expect, it } from "vitest";
import { parseClubFixtures } from "../src/domain/fullTime";
import { londonDateKey, londonToInstant } from "../src/domain/london";
import { createRequest, isIgnored, knownLocations, operationsFor, placeFixtures, planForTeam, unknownVenues, updateRequest } from "../src/domain/plan";
import {
  addVenue, clubFixturesUrl, exportSetup, findVenue, importSetup, parseFullTimeLink, rankSubGroups, readSettings, setIgnoredOpponents, suggestSetupName, upsertSetup, writeSettings,
} from "../src/domain/settings";
import rustOutput from "./golden/rust-output.json";
import { clubPageHtml, extract, group, NOW, setup, sponds, team } from "./helpers";

const fixturesFor = (html = clubPageHtml()) => parseClubFixtures(extract(html), [team], NOW).get(team) ?? [];
const plan = () => planForTeam(team, placeFixtures(fixturesFor(), (v) => findVenue(setup, v)), sponds);
const json = (v: unknown) => JSON.parse(JSON.stringify(v));

describe("against the Rust client", () => {
  it("sends the same create requests", () => {
    expect(json(plan().added.map((f) => createRequest(f, group, team.subGroupId)))).toEqual(rustOutput.creates);
  });
  it("sends the same update requests", () => {
    expect(json(plan().modified.map((m) => updateRequest(m.spond, m.fixture, group, team.subGroupId)))).toEqual(rustOutput.updates);
  });
  it("deletes the same events", () => {
    expect(plan().removed.map((s) => s.id)).toEqual(rustOutput.removed);
  });
  it("orders operations as create, update, delete", () => {
    expect(operationsFor(plan(), group).map((o) => o.kind)).toEqual([
      ...rustOutput.creates.map(() => "create"),
      ...rustOutput.updates.map(() => "update"),
      ...rustOutput.removed.map(() => "delete"),
    ]);
  });
});

describe("club fixtures page", () => {
  it("reads the team list and age group", () => {
    const page = extract(clubPageHtml());
    expect(page.teams.map((t) => t.id)).toEqual([169375196, 14943433]);
    expect(page.ageGroup).toBe("Under 10");
  });
  it("only takes each team's own fixtures", () => {
    const fixtures = fixturesFor();
    expect(fixtures.length).toBe(10);
    expect(fixtures.every((f) => f.venue !== "Somewhere Unmapped")).toBe(true);
  });
  it("finds a renamed team by its Full-Time ID", () => {
    const renamed = { ...team, fullTimeName: "Old name" };
    expect(parseClubFixtures(extract(clubPageHtml()), [renamed], NOW).get(renamed)?.length).toBe(fixturesFor().length);
  });
  it("refuses a team that's gone from the team list", () => {
    expect(() => parseClubFixtures(extract(clubPageHtml({ teams: [{ id: 1, name: "Someone else" }] })), [team], NOW)).toThrow(/isn't in Full-Time's team list/);
  });
  it("refuses a failed fetch", () => {
    expect(() => parseClubFixtures(extract(clubPageHtml(), 403), [team], NOW)).toThrow(/HTTP 403/);
  });
  it("refuses a page with no team list, like a block page", () => {
    expect(() => parseClubFixtures(extract("<html><title>Just a moment...</title></html>"), [team], NOW)).toThrow(/block page/);
  });
  it("refuses a page that may be cut off", () => {
    const filler = Array.from({ length: 100 }, () => '<tr><td colspan="10">x</td></tr>');
    expect(() => fixturesFor(clubPageHtml({ extraRows: filler }))).toThrow(/may not be all/);
  });
  it("refuses a team's row it can't read", () => {
    expect(() => fixturesFor(clubPageHtml({ extraRows: [`<tr><td>${team.fullTimeName} postponed</td></tr>`] }))).toThrow(/expected 10 cells/);
  });
  it("blocks all changes when Full-Time has no fixtures but Spond has events", () => {
    const blocked = planForTeam(team, [], sponds);
    expect(blocked.blocked).toBeTruthy();
    expect(operationsFor(blocked, group)).toEqual([]);
    expect(planForTeam(team, [], []).blocked).toBeNull();
  });
});

describe("venues", () => {
  const withoutVenues = { ...setup, venues: [] };
  it("lists venues not yet matched, once each", () => {
    expect(unknownVenues(fixturesFor(), (v) => findVenue(withoutVenues, v))).toEqual(["Goals Reading", "Woodford Park 3G pitch", "Cintra Park", "North Street Theale", "Kings Academy", "Goals", "Woodford Park Grass 2"]);
  });
  it("matches venue names ignoring case and spacing", () => {
    const s = addVenue(withoutVenues, "Kings Academy - 7aside 3G", setup.venues[0].location);
    expect(findVenue(s, "  kings academy -  7ASIDE 3g ")).toEqual(setup.venues[0].location);
  });
  it("offers each Spond location once", () => {
    expect(knownLocations(sponds).map((l) => l.feature)).toEqual(["Goals Reading", "King’s Academy Prospect", "North Street Theale"]);
  });
  it("won't place a fixture at an unmatched venue", () => {
    expect(() => placeFixtures(fixturesFor(), () => null)).toThrow(/No Spond location/);
  });
});

describe("settings", () => {
  it("round-trips through storage", () => {
    const settings = upsertSetup({ version: 1, setups: [] }, setup);
    expect(readSettings(writeSettings(settings))).toEqual(settings);
  });
  it("round-trips a shared setup", () => {
    expect(importSetup(exportSetup(setup))).toEqual(setup);
  });
  it("rejects text that isn't a shared setup", () => {
    expect(() => importSetup("hello")).toThrow(/isn't a shared setup/);
    expect(() => importSetup(JSON.stringify({ format: "other" }))).toThrow(/isn't a shared setup/);
  });
  it("rejects a shared setup with a bad field, naming it", () => {
    const bad = JSON.parse(exportSetup(setup));
    bad.setup.teams[0].fullTimeId = "14943433";
    expect(() => importSetup(JSON.stringify(bad))).toThrow(/teams\[0\]\.fullTimeId should be a whole number/);
  });
  it("replaces a setup with the same name", () => {
    const once = upsertSetup({ version: 1, setups: [] }, setup);
    expect(upsertSetup(once, { ...setup, ignoredOpponents: ["x"] }).setups).toHaveLength(1);
  });
  it("reads ignored events from comma-separated text", () => {
    expect(setIgnoredOpponents(setup, " Binfield Tournament, Cold Ash Tourny,,Binfield Tournament ").ignoredOpponents).toEqual(["Binfield Tournament", "Cold Ash Tourny"]);
  });
  it("ignores events by opponent name, ignoring case", () => {
    expect(isIgnored(sponds[0], ["delta"])).toBe(true);
    expect(isIgnored(sponds[0], ["echo"])).toBe(false);
  });
});

describe("Full-Time links", () => {
  const link = "https://fulltime.thefa.com/fixtures.html?selectedSeason=669507446&selectedFixtureGroupAgeGroup=13&selectedFixtureGroupKey=&selectedDateCode=all&selectedClub=649312641&selectedTeam=&selectedRelatedFixtureOption=3&itemsPerPage=25";
  it("reads the season, age group and club", () => {
    expect(parseFullTimeLink(link)).toEqual({ seasonId: 669507446, ageGroupId: 13, clubId: 649312641 });
  });
  it("explains what's missing", () => {
    expect(() => parseFullTimeLink(link.replace("selectedClub=649312641", "selectedClub="))).toThrow(/which club/);
    expect(() => parseFullTimeLink("https://example.com/?a=1")).toThrow(/isn't a Full-Time link/);
  });
  it("builds the club fixtures link with one page of 100", () => {
    const url = clubFixturesUrl(setup.fullTime);
    expect(url).toContain("selectedClub=649312641");
    expect(url).toContain("itemsPerPage=100");
    expect(parseFullTimeLink(url)).toEqual(setup.fullTime);
  });
  it("suggests a setup name and sub-group", () => {
    expect(suggestSetupName(["Twyford Comets FC U10 Meteors", "Twyford Comets FC U10 Astros"], "Under 10")).toBe("Twyford Comets FC U10");
    expect(rankSubGroups("Twyford Comets FC U10 Meteors", [{ name: "Astros" }, { name: "Meteors" }])[0].name).toBe("Meteors");
  });
});

describe("London time", () => {
  it("agrees with the timezone database for ten years", () => {
    const dates = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/London", year: "numeric", month: "2-digit", day: "2-digit" });
    for (let t = Date.UTC(2026, 0, 1); t < Date.UTC(2036, 0, 1); t += 30 * 60_000) {
      if (londonDateKey(t) !== dates.format(t)) throw new Error(`Mismatch at ${new Date(t).toISOString()}`);
    }
  });
  it("converts in both GMT and BST", () => {
    expect(londonToInstant(2027, 1, 16, 10, 0)).toBe(Date.UTC(2027, 0, 16, 10, 0));
    expect(londonToInstant(2027, 7, 17, 10, 0)).toBe(Date.UTC(2027, 6, 17, 9, 0));
  });
  it("rejects times that don't exist or happen twice", () => {
    expect(() => londonToInstant(2027, 3, 28, 1, 30)).toThrow();
    expect(() => londonToInstant(2027, 10, 31, 1, 30)).toThrow();
  });
});
