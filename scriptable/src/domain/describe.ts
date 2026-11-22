import { formatLondon } from "./london";
import { isSynced, meetupPrior, spondToFixture } from "./plan";
import type { FixtureSide, FixtureType, Operation, PlacedFixture, Plan, PreviewRow, PreviewSection, Spond } from "./types";

const sideLabel = (side: FixtureSide): string => (side === "home" ? "Home" : "Away");
const typeLabel = (type: FixtureType): string => (type === "cup" ? "Cup" : "League");
const describeFixture = (f: { at: number; opposition: string; side: FixtureSide; type: FixtureType }): string =>
  `${formatLondon(f.at)} · ${f.opposition} (${sideLabel(f.side)}, ${typeLabel(f.type)})`;

const TAKE_OVER = "Added by hand: from now on the sync keeps it up to date";

const describeChanges = (fixture: PlacedFixture, spond: Spond): string[] => {
  const takeOver = isSynced(spond) ? [] : [TAKE_OVER];
  const current = spondToFixture(spond);
  if (current === null) return [...takeOver, "Spond event has no match details"];
  const change = (label: string, from: string, to: string): string[] => (from === to ? [] : [`${label}: ${from} → ${to}`]);
  const meetup = (m: number | null): string => (m === null ? "none" : `${m} min`);
  return [
    ...takeOver,
    ...change("Time", formatLondon(current.at), formatLondon(fixture.at)),
    ...change("Opposition", current.opposition, fixture.opposition),
    ...change("Venue", current.location ?? "none", fixture.location.feature),
    ...change("Competition", typeLabel(current.type), typeLabel(fixture.type)),
    ...change("Side", sideLabel(current.side), sideLabel(fixture.side)),
    ...change("Meet-up", meetup(spond.meetupPrior ?? null), meetup(meetupPrior(fixture))),
  ];
};

const describeSpond = (spond: Spond): string => {
  const fixture = spondToFixture(spond);
  return fixture ? describeFixture(fixture) : `${formatLondon(Date.parse(spond.startTimestamp))} · ${spond.heading}`;
};

export const describePlan = (plan: Plan): PreviewSection => {
  const rows: PreviewRow[] = plan.blocked
    ? [{ kind: "blocked", title: "Blocked", subtitle: plan.blocked }]
    : [
        ...plan.added.map((f): PreviewRow => ({ kind: "added", title: `New: ${describeFixture(f)}`, subtitle: f.location.feature })),
        ...plan.modified.map(({ fixture, spond }): PreviewRow => ({ kind: "modified", title: `Change: ${describeFixture(fixture)}`, subtitle: describeChanges(fixture, spond).join("\n") })),
        ...plan.removed.map((s): PreviewRow => ({ kind: "removed", title: `Delete: ${describeSpond(s)}`, subtitle: "No longer on Full-Time" })),
      ];
  const changes = rows.length ? rows : [{ kind: "none" as const, title: "Up to date", subtitle: "" }];
  const kept = plan.kept.map((s): PreviewRow => ({ kind: "kept", title: `Keep: ${describeSpond(s)}`, subtitle: "Added by hand, so the sync leaves it alone" }));
  return {
    title: plan.team.label,
    summary: `Full-Time ${plan.fixtureCount} · Spond ${plan.spondCount}`,
    rows: [...changes, ...kept],
  };
};

export const summariseOperations = (operations: Operation[]): string => {
  const count = (kind: Operation["kind"]): number => operations.filter((o) => o.kind === kind).length;
  return `Create ${count("create")}, update ${count("update")}, delete ${count("delete")}`;
};
