/** Milliseconds since the epoch. */
export type Instant = number;

export type FixtureType = "cup" | "league";
export type FixtureSide = "home" | "away";

/** A fixture as Full-Time lists it, from one team's point of view. */
export interface Fixture {
  type: FixtureType;
  side: FixtureSide;
  at: Instant;
  opposition: string;
  /** The venue exactly as Full-Time names it. */
  venue: string;
}

/** A fixture whose venue has been matched to a Spond location. */
export interface PlacedFixture extends Fixture {
  location: Location;
}

export interface Location {
  feature: string;
  address: string;
  latitude: string | number;
  longitude: string | number;
}

/** One team being synced: its Full-Time listing and its Spond sub-group. */
export interface Team {
  label: string;
  fullTimeId: number;
  fullTimeName: string;
  subGroupId: string;
}

export type MatchType = "HOME" | "AWAY" | "TOURNAMENT";

export interface MatchInfo {
  teamName: string;
  opponentName: string;
  teamColour: string | null;
  opponentColour: string | null;
  type: MatchType;
  scoresSet: boolean;
  scoresSetEver: boolean;
  teamScore: number | null;
  opponentScore: number | null;
  scoresPublic: boolean;
  scoresFinal: boolean;
}

/** An event as returned by the Spond API. Unlisted fields are deliberately not sent back. */
export interface Spond {
  id: string;
  creatorId: string;
  owners: { id: string; response: string }[];
  heading: string;
  description?: string | null;
  startTimestamp: string;
  endTimestamp: string;
  meetupTimestamp?: string | null;
  meetupPrior?: number | null;
  location?: Location | null;
  matchInfo?: MatchInfo | null;
  matchEvent: boolean;
  createdTime: string;
  expired: boolean;
}

export interface GroupMember {
  id: string;
  profile?: { id: string } | null;
  subGroups: string[];
  respondent: boolean;
  roles?: string[] | null;
}

export interface SubGroup {
  id: string;
  name: string;
}

export interface Group {
  id: string;
  name?: string;
  members: GroupMember[];
  subGroups: SubGroup[];
  roles: { id: string; name: string }[];
}

/** One row of the Full-Time club fixtures table, as text. */
export interface ClubPageRow {
  cellCount: number;
  text: string;
  type: string;
  dateSpans: string[];
  home: string;
  away: string;
  venue: string;
}

/** What the adapter reads from the Full-Time club fixtures page. */
export interface ClubPage {
  status: number;
  /** The page's team filter: every club team in the age group. */
  teams: { id: number; name: string }[];
  ageGroup: string;
  tableCount: number;
  rows: ClubPageRow[];
}

export interface Plan {
  team: Team;
  fixtureCount: number;
  spondCount: number;
  blocked: string | null;
  added: PlacedFixture[];
  modified: { fixture: PlacedFixture; spond: Spond }[];
  removed: Spond[];
  /** Events added by hand that aren't on Full-Time. The sync never changes them. */
  kept: Spond[];
}

export type Operation =
  | { kind: "create"; label: string; body: object }
  | { kind: "update"; label: string; id: string; body: object }
  | { kind: "delete"; label: string; id: string };

export type RowKind = "added" | "modified" | "removed" | "kept" | "blocked" | "none";
export interface PreviewRow {
  kind: RowKind;
  title: string;
  subtitle: string;
}
export interface PreviewSection {
  title: string;
  summary: string;
  rows: PreviewRow[];
}
