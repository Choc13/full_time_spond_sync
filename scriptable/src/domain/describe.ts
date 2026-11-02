import { formatLondon } from "./london";
import { meetupPrior, spondToFixture } from "./plan";
import type { Fixture, FixtureSide, FixtureType, Operation, Plan, PreviewRow, PreviewSection, Spond, VenueKey } from "./types";
import { VENUES } from "./venues";

const sideLabel = (side: FixtureSide): string => (side === "home" ? "Home" : "Away");
const typeLabel = (type: FixtureType): string => (type === "cup" ? "Cup" : "League");
const venueLabel = (venue: VenueKey): string => VENUES[venue].feature;
const describeFixture = (f: Fixture): string => `${formatLondon(f.at)} · ${f.opposition} (${sideLabel(f.side)}, ${typeLabel(f.type)})`;

const describeChanges = (fixture: Fixture, spond: Spond): string[] => {
  const current = spondToFixture(spond);
  if (current === null) return ["Spond event has no match details"];
  const change = (label: string, from: string, to: string): string[] => (from === to ? [] : [`${label}: ${from} → ${to}`]);
  const meetup = (m: number | null): string => (m === null ? "none" : `${m} min`);
  return [
    ...change("Time", formatLondon(current.at), formatLondon(fixture.at)),
    ...change("Opposition", current.opposition, fixture.opposition),
    ...change("Venue", venueLabel(current.venue), venueLabel(fixture.venue)),
    ...change("Competition", typeLabel(current.type), typeLabel(fixture.type)),
    ...change("Side", sideLabel(current.side), sideLabel(fixture.side)),
    ...change("Meet-up", meetup(spond.meetupPrior ?? null), meetup(meetupPrior(fixture))),
  ];
};

const describeRemoved = (spond: Spond): string => {
  const fixture = spondToFixture(spond);
  return fixture ? describeFixture(fixture) : `${formatLondon(Date.parse(spond.startTimestamp))} · ${spond.heading}`;
};

export const describePlan = (plan: Plan): PreviewSection => {
  const rows: PreviewRow[] = plan.blocked
    ? [{ kind: "blocked", title: "Blocked", subtitle: plan.blocked }]
    : [
        ...plan.added.map((f): PreviewRow => ({ kind: "added", title: `New: ${describeFixture(f)}`, subtitle: venueLabel(f.venue) })),
        ...plan.modified.map(({ fixture, spond }): PreviewRow => ({ kind: "modified", title: `Change: ${describeFixture(fixture)}`, subtitle: describeChanges(fixture, spond).join("\n") })),
        ...plan.removed.map((s): PreviewRow => ({ kind: "removed", title: `Delete: ${describeRemoved(s)}`, subtitle: "No longer on Full-Time" })),
      ];
  return {
    title: plan.team.name,
    summary: `Full-Time ${plan.fixtureCount} · Spond ${plan.spondCount}`,
    rows: rows.length ? rows : [{ kind: "none", title: "Up to date", subtitle: "" }],
  };
};

export const summariseOperations = (operations: Operation[]): string => {
  const count = (kind: Operation["kind"]): number => operations.filter((o) => o.kind === kind).length;
  return `Create ${count("create")}, update ${count("update")}, delete ${count("delete")}`;
};
