import { formatInstant, HOUR, londonDateKey, MINUTE } from "./london";
import type { Fixture, Group, Instant, Location, MatchInfo, MatchType, Operation, PlacedFixture, Plan, Spond, Team } from "./types";

/** A Spond event read back as a fixture, for comparing. */
export interface SpondFixture {
  type: Fixture["type"];
  side: Fixture["side"];
  at: Instant;
  opposition: string;
  location: string | null;
}

export const spondToFixture = (spond: Spond): SpondFixture | null => {
  const info = spond.matchInfo;
  if (!info) return null;
  return {
    type: info.type === "TOURNAMENT" ? "cup" : "league",
    side: info.type === "AWAY" ? "away" : "home",
    at: Date.parse(spond.startTimestamp),
    opposition: info.opponentName,
    location: spond.location?.feature ?? null,
  };
};

/** Venues Full-Time uses that haven't been matched to a Spond location yet, in first-seen order. */
export const unknownVenues = (fixtures: Fixture[], locate: (venue: string) => Location | null): string[] =>
  [...new Set(fixtures.map((f) => f.venue))].filter((venue) => locate(venue) === null);

export const placeFixtures = (fixtures: Fixture[], locate: (venue: string) => Location | null): PlacedFixture[] =>
  fixtures.map((fixture) => {
    const location = locate(fixture.venue);
    if (!location) throw new Error(`No Spond location chosen for "${fixture.venue}"`);
    return { ...fixture, location };
  });

export const meetupPrior = (fixture: Fixture): number | null =>
  londonDateKey(fixture.at - 15 * MINUTE) === londonDateKey(fixture.at) ? 15 : null;

const sameFixture = (a: SpondFixture | null, b: PlacedFixture): boolean =>
  a !== null && a.type === b.type && a.side === b.side && a.at === b.at && a.opposition === b.opposition && a.location === b.location.feature;

// Fixtures and Sponds are matched by London calendar date.
const byLondonDate = <T>(items: T[], instantOf: (item: T) => Instant): Map<string, T> =>
  new Map(items.map((item): [string, T] => [londonDateKey(instantOf(item)), item]));

const inDateOrder = <T>(map: Map<string, T>): [string, T][] => [...map.entries()].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));

export const diff = (fixtures: PlacedFixture[], sponds: Spond[]): Pick<Plan, "added" | "modified" | "removed"> => {
  const sortedSponds = [...sponds].sort((a, b) => Date.parse(a.startTimestamp) - Date.parse(b.startTimestamp));
  const fixtureByDate = byLondonDate(fixtures, (f) => f.at);
  const spondByDate = byLondonDate(sortedSponds, (s) => Date.parse(s.startTimestamp));
  return {
    added: inDateOrder(fixtureByDate).filter(([date]) => !spondByDate.has(date)).map(([, f]) => f),
    modified: inDateOrder(fixtureByDate)
      .flatMap(([date, fixture]) => {
        const spond = spondByDate.get(date);
        return spond ? [{ fixture, spond }] : [];
      })
      .filter(({ fixture, spond }) => !(sameFixture(spondToFixture(spond), fixture) && meetupPrior(fixture) === (spond.meetupPrior ?? null))),
    removed: inDateOrder(spondByDate).filter(([date]) => !fixtureByDate.has(date)).map(([, s]) => s),
  };
};

/** No fixtures at all while Spond has upcoming ones is never applied automatically. */
export const planForTeam = (team: Team, fixtures: PlacedFixture[], sponds: Spond[]): Plan => ({
  team,
  fixtureCount: fixtures.length,
  spondCount: sponds.length,
  blocked: fixtures.length === 0 && sponds.length > 0 ? `Full-Time shows no upcoming fixtures but Spond has ${sponds.length}. Nothing will be changed for ${team.label}.` : null,
  ...diff(fixtures, sponds),
});

export const isIgnored = (spond: Spond, ignoredOpponents: string[]): boolean =>
  Boolean(spond.matchInfo) && ignoredOpponents.some((name) => name.trim().toLowerCase() === (spond.matchInfo as MatchInfo).opponentName.trim().toLowerCase());

const spondMatchType = (fixture: Fixture): MatchType => (fixture.type === "cup" ? "TOURNAMENT" : fixture.side === "home" ? "HOME" : "AWAY");

const matchInfoFor = (fixture: Fixture, teamName: string): MatchInfo => ({
  teamName,
  opponentName: fixture.opposition,
  teamColour: null,
  opponentColour: null,
  type: spondMatchType(fixture),
  scoresSet: false,
  scoresSetEver: false,
  teamScore: null,
  opponentScore: null,
  scoresPublic: true,
  scoresFinal: false,
});

const findSubGroup = (group: Group, subGroupId: string) => {
  const subGroup = group.subGroups.find((sg) => sg.id === subGroupId);
  if (!subGroup) throw new Error(`Spond sub-group ${subGroupId} not found. Set the age group up again.`);
  return subGroup;
};

export const createRequest = (fixture: PlacedFixture, group: Group, subGroupId: string) => {
  const subGroup = findSubGroup(group, subGroupId);
  const coachRole = group.roles.find((r) => r.name.toLowerCase() === "coach");
  if (!coachRole) throw new Error('Spond group has no "coach" role');
  const members = group.members.filter((m) => m.subGroups.includes(subGroupId));
  return {
    heading: `${subGroup.name} - ${fixture.opposition}`,
    spondType: "event",
    startTimestamp: formatInstant(fixture.at),
    endTimestamp: formatInstant(fixture.at + HOUR),
    openEnded: false,
    commentsDisabled: false,
    meetupPrior: meetupPrior(fixture),
    maxAccepted: 0,
    rsvpDate: null,
    location: fixture.location,
    owners: members.flatMap((m) => ((m.roles ?? []).includes(coachRole.id) && m.profile ? [{ id: m.profile.id }] : [])),
    visibility: "INVITEES",
    participantsHidden: false,
    autoReminderType: "DISABLED",
    matchInfo: matchInfoFor(fixture, subGroup.name),
    autoAccept: false,
    attachments: [],
    type: "EVENT",
    recipients: {
      groupMembers: members.filter((m) => m.respondent).map((m) => m.id),
      group: { id: group.id, subGroups: [subGroup.id] },
    },
  };
};

export const updateRequest = (spond: Spond, fixture: PlacedFixture, group: Group, subGroupId: string) => ({
  id: spond.id,
  creatorId: spond.creatorId,
  owners: spond.owners.map((o) => ({ id: o.id, response: o.response })),
  heading: spond.heading,
  description: spond.description ?? null,
  startTimestamp: formatInstant(fixture.at),
  endTimestamp: formatInstant(fixture.at + HOUR),
  meetupTimestamp: spond.meetupTimestamp ?? null,
  meetupPrior: meetupPrior(fixture),
  location: fixture.location,
  matchInfo: matchInfoFor(fixture, findSubGroup(group, subGroupId).name),
  matchEvent: spond.matchEvent,
  createdTime: spond.createdTime,
  expired: spond.expired,
});

/** Blocked teams produce no operations. The order matches the Rust client: create, update, delete. */
export const operationsFor = (plan: Plan, group: Group): Operation[] => {
  if (plan.blocked) return [];
  const { team } = plan;
  return [
    ...plan.added.map((f): Operation => ({ kind: "create", label: `${team.label}: create ${f.opposition}`, body: createRequest(f, group, team.subGroupId) })),
    ...plan.modified.map(({ fixture, spond }): Operation => ({ kind: "update", label: `${team.label}: update ${fixture.opposition}`, id: spond.id, body: updateRequest(spond, fixture, group, team.subGroupId) })),
    ...plan.removed.map((s): Operation => ({ kind: "delete", label: `${team.label}: delete ${s.heading}`, id: s.id })),
  ];
};

/** Distinct locations from past and upcoming Spond events, for matching Full-Time venues. */
export const knownLocations = (sponds: Spond[]): Location[] => {
  const byFeature = new Map<string, Location>();
  for (const s of sponds) {
    const l = s.location;
    if (l && l.feature && l.address && l.latitude !== undefined && l.longitude !== undefined && !byFeature.has(l.feature)) {
      byFeature.set(l.feature, { feature: l.feature, address: l.address, latitude: l.latitude, longitude: l.longitude });
    }
  }
  return [...byFeature.values()].sort((a, b) => a.feature.localeCompare(b.feature));
};
