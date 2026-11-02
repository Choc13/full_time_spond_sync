import { describe, expect, it } from "vitest";
import { JSDOM } from "jsdom";
import { extractFixturesPage } from "../src/adapters/fixturesPage";
import { parseFixturesPage } from "../src/domain/fullTime";
import { londonDateKey, londonToInstant } from "../src/domain/london";
import { createRequest, operationsFor, planForTeam, updateRequest } from "../src/domain/plan";
import type { FixturesPage, Group, Spond, Team } from "../src/domain/types";
import rustOutput from "./golden/rust-output.json";
import scenario from "./golden/scenario.json";

// rust-output.json is what the original Rust diff and request builders produced for scenario.json.
const NOW = Date.UTC(2026, 10, 2);
const team: Team = { name: "Meteors", fullTimeName: scenario.team_name, teamId: 1, seasonId: 1, subGroupId: scenario.sub_group_id };
const group = scenario.group as unknown as Group;
const sponds = scenario.sponds as unknown as Spond[];

const extract = (html: string, status = 200): FixturesPage => {
  const { window } = new JSDOM("<!doctype html>", { runScripts: "outside-only" });
  const call = `JSON.stringify((${extractFixturesPage.toString()})(${JSON.stringify(html)}, ${JSON.stringify(team.fullTimeName)}))`;
  return { status, ...JSON.parse(window.eval(call) as unknown as string) };
};

describe("against the Rust client", () => {
  const fixtures = parseFixturesPage(extract(scenario.html), team, NOW);
  const plan = planForTeam(team, fixtures, sponds);

  it("sends the same create requests", () => {
    expect(JSON.parse(JSON.stringify(plan.added.map((f) => createRequest(f, group, team.subGroupId))))).toEqual(rustOutput.creates);
  });
  it("sends the same update requests", () => {
    expect(JSON.parse(JSON.stringify(plan.modified.map((m) => updateRequest(m.spond, m.fixture, group, team.subGroupId))))).toEqual(rustOutput.updates);
  });
  it("deletes the same events", () => {
    expect(plan.removed.map((s) => s.id)).toEqual(rustOutput.removed);
  });
  it("orders operations as create, update, delete", () => {
    expect(operationsFor(plan, group).map((o) => o.kind)).toEqual([
      ...rustOutput.creates.map(() => "create"),
      ...rustOutput.updates.map(() => "update"),
      ...rustOutput.removed.map(() => "delete"),
    ]);
  });
});

describe("safety guards", () => {
  it("rejects a failed fetch", () => {
    expect(() => parseFixturesPage(extract(scenario.html, 403), team, NOW)).toThrow(/HTTP 403/);
  });
  it("rejects a page that isn't the team's page", () => {
    expect(() => parseFixturesPage(extract("<html><title>Just a moment...</title></html>"), team, NOW)).toThrow(/block page/);
  });
  it("allows a real page with no fixtures, but blocks all changes if Spond has events", () => {
    const fixtures = parseFixturesPage(extract(`<html><title>${team.fullTimeName}</title></html>`), team, NOW);
    expect(fixtures).toEqual([]);
    const plan = planForTeam(team, fixtures, sponds);
    expect(plan.blocked).toBeTruthy();
    expect(operationsFor(plan, group)).toEqual([]);
  });
  it("doesn't block when both sides are empty", () => {
    expect(planForTeam(team, [], []).blocked).toBeNull();
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
