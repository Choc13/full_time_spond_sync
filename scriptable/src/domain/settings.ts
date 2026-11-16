import type { Location, Team } from "./types";

// Everything a coach sets up lives in these settings, stored on their phone.
// A setup is one age group at one club, so a coach can sync all its teams together.

export interface FullTimeSource {
  seasonId: number;
  ageGroupId: number;
  clubId: number;
}

export interface VenueMapping {
  /** The venue exactly as Full-Time names it. */
  fullTimeName: string;
  location: Location;
}

export interface Setup {
  name: string;
  fullTime: FullTimeSource;
  spondGroupId: string;
  teams: Team[];
  venues: VenueMapping[];
  /** Spond events managed by hand, matched by opponent name, that the sync must never touch. */
  ignoredOpponents: string[];
}

export interface Settings {
  version: 1;
  setups: Setup[];
}

export const EMPTY_SETTINGS: Settings = { version: 1, setups: [] };

// --- Validation. Settings and shared setups come from files and other people, so check every field.

type Json = unknown;

const fail = (path: string, expected: string): never => {
  throw new Error(`${path} should be ${expected}`);
};
const asObject = (v: Json, path: string): Record<string, Json> =>
  typeof v === "object" && v !== null && !Array.isArray(v) ? (v as Record<string, Json>) : fail(path, "an object");
const asArray = (v: Json, path: string): Json[] => (Array.isArray(v) ? v : fail(path, "a list"));
const asString = (v: Json, path: string): string => (typeof v === "string" && v.trim() !== "" ? v : fail(path, "text"));
const asId = (v: Json, path: string): number => (typeof v === "number" && Number.isSafeInteger(v) && v > 0 ? v : fail(path, "a whole number"));
const asCoordinate = (v: Json, path: string): string | number =>
  (typeof v === "number" && Number.isFinite(v)) || (typeof v === "string" && Number.isFinite(Number(v)) && v.trim() !== "") ? (v as string | number) : fail(path, "a coordinate");

const readLocation = (v: Json, path: string): Location => {
  const o = asObject(v, path);
  return {
    feature: asString(o.feature, `${path}.feature`),
    address: asString(o.address, `${path}.address`),
    latitude: asCoordinate(o.latitude, `${path}.latitude`),
    longitude: asCoordinate(o.longitude, `${path}.longitude`),
  };
};

const readTeam = (v: Json, path: string): Team => {
  const o = asObject(v, path);
  return {
    label: asString(o.label, `${path}.label`),
    fullTimeId: asId(o.fullTimeId, `${path}.fullTimeId`),
    fullTimeName: asString(o.fullTimeName, `${path}.fullTimeName`),
    subGroupId: asString(o.subGroupId, `${path}.subGroupId`),
  };
};

export const readSetup = (v: Json, path = "setup"): Setup => {
  const o = asObject(v, path);
  const ft = asObject(o.fullTime, `${path}.fullTime`);
  const teams = asArray(o.teams, `${path}.teams`).map((t, i) => readTeam(t, `${path}.teams[${i}]`));
  if (teams.length === 0) fail(`${path}.teams`, "a list with at least one team");
  return {
    name: asString(o.name, `${path}.name`),
    fullTime: {
      seasonId: asId(ft.seasonId, `${path}.fullTime.seasonId`),
      ageGroupId: asId(ft.ageGroupId, `${path}.fullTime.ageGroupId`),
      clubId: asId(ft.clubId, `${path}.fullTime.clubId`),
    },
    spondGroupId: asString(o.spondGroupId, `${path}.spondGroupId`),
    teams,
    venues: asArray(o.venues ?? [], `${path}.venues`).map((m, i) => {
      const mapping = asObject(m, `${path}.venues[${i}]`);
      return { fullTimeName: asString(mapping.fullTimeName, `${path}.venues[${i}].fullTimeName`), location: readLocation(mapping.location, `${path}.venues[${i}].location`) };
    }),
    ignoredOpponents: asArray(o.ignoredOpponents ?? [], `${path}.ignoredOpponents`).map((s, i) => asString(s, `${path}.ignoredOpponents[${i}]`)),
  };
};

export const readSettings = (text: string): Settings => {
  const o = asObject(JSON.parse(text), "settings");
  if (o.version !== 1) throw new Error("These settings are from a newer version of the app. Update it from the download link.");
  return { version: 1, setups: asArray(o.setups, "settings.setups").map((s, i) => readSetup(s, `settings.setups[${i}]`)) };
};

export const writeSettings = (settings: Settings): string => JSON.stringify(settings, null, 2);

// --- Sharing a setup between coaches. No login details are ever part of it.

const SHARE_FORMAT = "fa-spond-sync/setup";

export const exportSetup = (setup: Setup): string => JSON.stringify({ format: SHARE_FORMAT, version: 1, setup });

export const importSetup = (text: string): Setup => {
  let parsed: Json;
  try {
    parsed = JSON.parse(text.trim());
  } catch {
    throw new Error("That isn't a shared setup. Copy the whole text the other coach sent and try again.");
  }
  const o = asObject(parsed, "shared setup");
  if (o.format !== SHARE_FORMAT) throw new Error("That isn't a shared setup. Copy the whole text the other coach sent and try again.");
  if (o.version !== 1) throw new Error("That setup is from a newer version of the app. Update it from the download link.");
  return readSetup(o.setup);
};

// --- Changing settings. All pure: each returns new settings.

export const upsertSetup = (settings: Settings, setup: Setup): Settings => ({
  ...settings,
  setups: [...settings.setups.filter((s) => s.name !== setup.name), setup].sort((a, b) => a.name.localeCompare(b.name)),
});

export const removeSetup = (settings: Settings, name: string): Settings => ({ ...settings, setups: settings.setups.filter((s) => s.name !== name) });

export const venueKey = (fullTimeName: string): string => fullTimeName.replace(/\s+/g, " ").trim().toLowerCase();

export const findVenue = (setup: Setup, fullTimeName: string): Location | null =>
  setup.venues.find((v) => venueKey(v.fullTimeName) === venueKey(fullTimeName))?.location ?? null;

export const addVenue = (setup: Setup, fullTimeName: string, location: Location): Setup => ({
  ...setup,
  venues: [...setup.venues.filter((v) => venueKey(v.fullTimeName) !== venueKey(fullTimeName)), { fullTimeName: fullTimeName.trim(), location }],
});

export const setIgnoredOpponents = (setup: Setup, text: string): Setup => ({
  ...setup,
  ignoredOpponents: [...new Set(text.split(/[,\n]/).map((s) => s.trim()).filter(Boolean))],
});

// --- Full-Time links

/** Reads the season, age group and club from a link to a club's fixtures on Full-Time. */
export const parseFullTimeLink = (link: string): FullTimeSource => {
  const match = /^https:\/\/fulltime\.thefa\.com\/[^?#]*\?([^#]*)/i.exec(link.trim());
  if (!match) throw new Error("That isn't a Full-Time link. It should start with https://fulltime.thefa.com/");
  const params = new Map(match[1].split("&").map((pair) => {
    const [key, value = ""] = pair.split("=");
    return [decodeURIComponent(key), decodeURIComponent(value)] as [string, string];
  }));
  const id = (key: string, what: string): number => {
    const value = Number(params.get(key));
    if (!Number.isSafeInteger(value) || value <= 0) throw new Error(`The link doesn't say which ${what} to use. On Full-Time, choose the ${what} under Fixtures, then copy the link again.`);
    return value;
  };
  return { seasonId: id("selectedSeason", "season"), ageGroupId: id("selectedFixtureGroupAgeGroup", "age group"), clubId: id("selectedClub", "club") };
};

export const ITEMS_PER_PAGE = 100;

/** Every fixture for the club's teams in the age group, whatever division each is in. */
export const clubFixturesUrl = (source: FullTimeSource): string =>
  "https://fulltime.thefa.com/fixtures.html?" +
  [
    ["selectedSeason", source.seasonId],
    ["selectedFixtureGroupAgeGroup", source.ageGroupId],
    ["selectedFixtureGroupKey", ""],
    ["selectedDateCode", "all"],
    ["selectedClub", source.clubId],
    ["selectedTeam", ""],
    ["selectedRelatedFixtureOption", 3],
    ["selectedFixtureDateStatus", ""],
    ["selectedFixtureStatus", ""],
    ["previousSelectedFixtureGroupAgeGroup", source.ageGroupId],
    ["previousSelectedFixtureGroupKey", ""],
    ["previousSelectedClub", ""],
    ["itemsPerPage", ITEMS_PER_PAGE],
  ].map(([k, v]) => `${k}=${v}`).join("&");

/** Suggests a setup name from the teams' shared prefix, e.g. "Twyford Comets FC U10". */
export const suggestSetupName = (teamNames: string[], ageGroup: string): string => {
  const words = teamNames.map((n) => n.split(/\s+/));
  const common: string[] = [];
  for (let i = 0; words.length > 0 && words.every((w) => i < w.length - 1 && w[i] === words[0][i]); i++) common.push(words[0][i]);
  return common.length ? common.join(" ") : ageGroup || "My teams";
};

/** Orders Spond sub-groups so the likeliest match for a Full-Time team comes first. */
export const rankSubGroups = <T extends { name: string }>(teamName: string, subGroups: T[]): T[] => {
  const teamWords = new Set(teamName.toLowerCase().split(/\W+/).filter((w) => w.length > 2));
  const score = (sg: T): number => sg.name.toLowerCase().split(/\W+/).filter((w) => teamWords.has(w)).length;
  return [...subGroups].sort((a, b) => score(b) - score(a) || a.name.localeCompare(b.name));
};
