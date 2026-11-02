/** Milliseconds since the epoch. */
export type Instant = number;

export type VenueKey = "goals" | "kingsAcademy" | "woodfordPark3G" | "woodfordParkGrass" | "cintraPark" | "northStreetTheale";
export type FixtureType = "cup" | "league";
export type FixtureSide = "home" | "away";

export interface Fixture {
  type: FixtureType;
  side: FixtureSide;
  at: Instant;
  opposition: string;
  venue: VenueKey;
}

export interface Team {
  name: string;
  fullTimeName: string;
  teamId: number;
  seasonId: number;
  subGroupId: string;
}

/** Coordinates are strings because that is how the Rust client sends them. */
export interface Location {
  feature: string;
  address: string;
  latitude: string | number;
  longitude: string | number;
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

export interface Group {
  id: string;
  members: GroupMember[];
  subGroups: { id: string; name: string }[];
  roles: { id: string; name: string }[];
}

/** One row of the Full-Time fixtures table, as text. */
export interface PageRow {
  cellCount: number;
  type: string;
  dateSpans: string[];
  home: string[];
  away: string[];
  venue: string;
}

export interface FixturesPage {
  status: number;
  tableCount: number;
  rows: PageRow[];
  teamNameFound: boolean;
}

export interface Plan {
  team: Team;
  fixtureCount: number;
  spondCount: number;
  blocked: string | null;
  added: Fixture[];
  modified: { fixture: Fixture; spond: Spond }[];
  removed: Spond[];
}

export type Operation =
  | { kind: "create"; label: string; body: object }
  | { kind: "update"; label: string; id: string; body: object }
  | { kind: "delete"; label: string; id: string };

export type RowKind = "added" | "modified" | "removed" | "blocked" | "none";
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
