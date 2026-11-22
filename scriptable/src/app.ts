import { describePlan, summariseOperations } from "./domain/describe";
import { parseClubFixtures } from "./domain/fullTime";
import { isIgnored, knownLocations, operationsFor, placeFixtures, planForTeam, unknownVenues } from "./domain/plan";
import {
  addVenue, clubFixturesUrl, exportSetup, findVenue, importSetup, parseFullTimeLink, rankSubGroups, removeSetup, setIgnoredOpponents, suggestSetupName, upsertSetup,
} from "./domain/settings";
import type { Settings, Setup } from "./domain/settings";
import type { ClubPage, Group, Instant, Operation, Plan, PreviewSection, Spond, Team } from "./domain/types";

export interface HttpResponse {
  status: number;
  text: string;
}
export interface Credentials {
  email: string;
  password: string;
}

/** Everything the app needs from the outside world. */
export interface Ports {
  now: () => Instant;
  http: (method: string, url: string, options?: { headers?: Record<string, string>; body?: string }) => Promise<HttpResponse>;
  readClubPage: (response: HttpResponse) => Promise<ClubPage>;
  loadCredentials: () => Promise<Credentials | null>;
  forgetPassword: () => void;
  loadSettings: () => Settings;
  saveSettings: (settings: Settings) => void;
  readClipboard: () => string | null;
  writeClipboard: (text: string) => void;
  /** Resolves to the chosen option's index, or null if cancelled. */
  pick: (title: string, message: string, options: string[]) => Promise<number | null>;
  /** Resolves to the entered text, or null if cancelled. */
  askText: (title: string, message: string, initial?: string) => Promise<string | null>;
  confirm: (title: string, message: string, action: string, destructive: boolean) => Promise<boolean>;
  /** Resolves to true only if the person asked to apply the changes. */
  showPreview: (sections: PreviewSection[], operations: Operation[]) => Promise<boolean>;
  showMessage: (title: string, message: string) => Promise<void>;
}

const SPOND_API = "https://api.spond.com/core/v1";
const DAY = 24 * 3600_000;

/** Shown to the person as-is: something they can act on, not a crash. */
export class Stop extends Error {}

// --- Spond

const expectOk = (response: HttpResponse, action: string): HttpResponse => {
  if (response.status < 200 || response.status >= 300) throw new Error(`${action} failed with HTTP ${response.status}: ${response.text.slice(0, 200)}`);
  return response;
};

const authHeaders = (token: string): Record<string, string> => ({ Authorization: `Bearer ${token}`, "Content-Type": "application/json" });

const query = (params: Record<string, string | number | boolean>): string =>
  Object.entries(params).map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join("&");

const spondsUrl = (groupId: string, subGroupId: string | null, from: Instant): string =>
  `${SPOND_API}/sponds?${query({
    addProfileInfo: false,
    excludeAvailability: true,
    excludeRepeating: true,
    groupId,
    includeComments: false,
    includeHidden: true,
    match: true,
    max: 100,
    order: "asc",
    minStartTimestamp: new Date(from).toISOString(),
    scheduled: false,
    ...(subGroupId ? { subGroupId } : {}),
  })}`;

interface SpondSession {
  get: <T>(url: string, action: string) => Promise<T>;
  token: string;
}

const signIn = async (ports: Ports): Promise<SpondSession> => {
  const credentials = await ports.loadCredentials();
  if (!credentials) throw new Stop("A Spond login is needed.");
  const response = await ports.http("POST", `${SPOND_API}/auth2/login`, { headers: { "Content-Type": "application/json" }, body: JSON.stringify(credentials) });
  if (response.status === 400 || response.status === 401 || response.status === 403) {
    ports.forgetPassword();
    throw new Stop(`Spond rejected the login (HTTP ${response.status}). You'll be asked for your password next time.`);
  }
  const token = JSON.parse(expectOk(response, "Spond login").text).accessToken.token as string;
  return {
    token,
    get: async <T>(url: string, action: string) => JSON.parse(expectOk(await ports.http("GET", url, { headers: authHeaders(token) }), action).text) as T,
  };
};

// --- Setting up an age group

const looksLikeFullTimeLink = (text: string | null): text is string => Boolean(text && /^https:\/\/fulltime\.thefa\.com\//i.test(text.trim()));

const readClub = async (ports: Ports, setupSource: Setup["fullTime"]): Promise<ClubPage> => {
  const page = await ports.readClubPage(await ports.http("GET", clubFixturesUrl(setupSource)));
  if (page.status !== 200) throw new Error(`Full-Time returned HTTP ${page.status}`);
  if (page.teams.length === 0) throw new Stop("Couldn't find the club's teams on that Full-Time page. Check the link shows your club's fixtures for one age group.");
  return page;
};

const addAgeGroup = async (ports: Ports): Promise<Setup | null> => {
  const clipboard = ports.readClipboard();
  const link = await ports.askText(
    "Full-Time fixtures link",
    "On Full-Time, open Fixtures, choose your club and age group, then copy the page's link and paste it here.",
    looksLikeFullTimeLink(clipboard) ? clipboard.trim() : "",
  );
  if (!link) return null;
  let source: Setup["fullTime"];
  try {
    source = parseFullTimeLink(link);
  } catch (error) {
    throw new Stop((error as Error).message);
  }
  const page = await readClub(ports, source);

  const spond = await signIn(ports);
  const groups = await spond.get<Group[]>(`${SPOND_API}/groups/`, "Loading your Spond groups");
  if (groups.length === 0) throw new Stop("Your Spond account isn't in any groups.");
  const groupIndex = groups.length === 1 ? 0 : await ports.pick("Which Spond group?", "", groups.map((g) => g.name ?? g.id));
  if (groupIndex === null) return null;
  const group = groups[groupIndex];

  const teams: Team[] = [];
  for (const ftTeam of page.teams) {
    const ranked = rankSubGroups(ftTeam.name, group.subGroups);
    const choice = await ports.pick(`${ftTeam.name}`, "Which Spond sub-group is this team?", [...ranked.map((sg) => sg.name), "Don't sync this team"]);
    if (choice === null) return null;
    if (choice < ranked.length) teams.push({ label: ranked[choice].name, fullTimeId: ftTeam.id, fullTimeName: ftTeam.name, subGroupId: ranked[choice].id });
  }
  if (teams.length === 0) throw new Stop("No teams were chosen, so nothing was saved.");

  const name = await ports.askText("Name this age group", "", suggestSetupName(teams.map((t) => t.fullTimeName), page.ageGroup));
  if (!name) return null;
  return { name: name.trim(), fullTime: source, spondGroupId: group.id, teams, venues: [], ignoredOpponents: [] };
};

const saveSetup = async (ports: Ports, settings: Settings, setup: Setup): Promise<Settings> => {
  if (settings.setups.some((s) => s.name === setup.name) && !(await ports.confirm("Replace setup?", `You already have "${setup.name}". Replace it?`, "Replace", true))) return settings;
  const updated = upsertSetup(settings, setup);
  ports.saveSettings(updated);
  return updated;
};

const importShared = async (ports: Ports): Promise<Setup | null> => {
  const clipboard = ports.readClipboard();
  const text = clipboard && clipboard.includes("fa-spond-sync/setup") ? clipboard : await ports.askText("Import a setup", "Paste the setup another coach shared with you.", "");
  if (!text) return null;
  try {
    return importSetup(text);
  } catch (error) {
    throw new Stop((error as Error).message);
  }
};

// --- Syncing

/** Asks which Spond location each new Full-Time venue is. Saves each answer straight away. */
const matchVenues = async (ports: Ports, settings: Settings, setup: Setup, venues: string[], candidates: Spond[]): Promise<{ settings: Settings; setup: Setup }> => {
  const locations = knownLocations(candidates);
  if (locations.length === 0) throw new Stop(`Full-Time uses a venue the app hasn't seen: "${venues[0]}". Create one event in Spond at that venue, then sync again so you can pick it.`);
  let current = { settings, setup };
  for (const venue of venues) {
    const choice = await ports.pick("Which Spond location?", `Full-Time venue: ${venue}\n\nThis is saved, so you're only asked once.`, locations.map((l) => `${l.feature} (${l.address})`));
    if (choice === null) throw new Stop("Sync cancelled. Nothing was changed.");
    const setupWithVenue = addVenue(current.setup, venue, locations[choice]);
    current = { settings: upsertSetup(current.settings, setupWithVenue), setup: setupWithVenue };
    ports.saveSettings(current.settings);
  }
  return current;
};

const runOperation = (ports: Ports, token: string, operation: Operation): Promise<HttpResponse> => {
  const headers = authHeaders(token);
  switch (operation.kind) {
    case "create":
      return ports.http("POST", `${SPOND_API}/sponds`, { headers, body: JSON.stringify(operation.body) });
    case "update":
      return ports.http("POST", `${SPOND_API}/sponds/${operation.id}`, { headers, body: JSON.stringify(operation.body) });
    case "delete":
      return ports.http("DELETE", `${SPOND_API}/sponds/${operation.id}?quiet=true`, { headers });
  }
};

/** Stops at the first failure. Running again picks up whatever is left. */
const applyOperations = async (ports: Ports, token: string, operations: Operation[]) => {
  const done: Operation[] = [];
  for (const operation of operations) {
    try {
      expectOk(await runOperation(ports, token, operation), operation.label);
      done.push(operation);
    } catch (error) {
      return { done, error: (error as Error).message };
    }
  }
  return { done, error: null };
};

/** What is approved in the preview is exactly what is applied: nothing is re-diffed. */
const sync = async (ports: Ports, settings: Settings, initialSetup: Setup, teams: Team[]): Promise<void> => {
  const now = ports.now();
  const spond = await signIn(ports);
  const group = await spond.get<Group>(`${SPOND_API}/group/${initialSetup.spondGroupId}`, "Loading the Spond group");
  const page = await readClub(ports, initialSetup.fullTime);
  const fixturesByTeam = parseClubFixtures(page, teams, now);
  const spondsByTeam = new Map<Team, Spond[]>();
  for (const team of teams) spondsByTeam.set(team, await spond.get<Spond[]>(spondsUrl(initialSetup.spondGroupId, team.subGroupId, now), `Loading ${team.label} from Spond`));

  let setup = initialSetup;
  const allFixtures = [...fixturesByTeam.values()].flat();
  const newVenues = unknownVenues(allFixtures, (venue) => findVenue(setup, venue));
  if (newVenues.length > 0) {
    const recent = await spond.get<Spond[]>(spondsUrl(setup.spondGroupId, null, now - 180 * DAY), "Loading Spond locations");
    ({ setup } = await matchVenues(ports, settings, setup, newVenues, [...recent, ...[...spondsByTeam.values()].flat()]));
  }

  const plans: Plan[] = teams.map((team) =>
    planForTeam(
      team,
      placeFixtures(fixturesByTeam.get(team) ?? [], (venue) => findVenue(setup, venue)),
      (spondsByTeam.get(team) ?? []).filter((s) => !isIgnored(s, setup.ignoredOpponents)),
    ),
  );
  const operations = plans.flatMap((plan) => operationsFor(plan, group));

  if (!(await ports.showPreview(plans.map(describePlan), operations))) return;
  const deletes = operations.some((o) => o.kind === "delete");
  if (!(await ports.confirm("Update Spond?", summariseOperations(operations), "Apply", deletes))) return;

  const result = await applyOperations(ports, spond.token, operations);
  if (result.error) {
    await ports.showMessage("Stopped on an error", `${result.done.length} of ${operations.length} done.\n\n${result.error}\n\nRun it again to pick up the rest.`);
  } else {
    await ports.showMessage("Spond updated", summariseOperations(result.done));
  }
};

// --- Menus

/** Returns true when the app should close. */
const setupMenu = async (ports: Ports, settings: Settings, setup: Setup): Promise<{ settings: Settings; done: boolean }> => {
  const teamOptions = setup.teams.map((t) => `Sync ${t.label}`);
  const options = [`Sync all teams (${setup.teams.length})`, ...teamOptions, "Ignored events", "Share this setup", "Remove this setup"];
  const choice = await ports.pick(setup.name, "Shows the changes before anything is applied.", options);
  if (choice === null) return { settings, done: false };
  if (choice === 0) {
    await sync(ports, settings, setup, setup.teams);
    return { settings, done: true };
  }
  if (choice <= setup.teams.length) {
    await sync(ports, settings, setup, [setup.teams[choice - 1]]);
    return { settings, done: true };
  }
  const action = options[choice];
  if (action === "Ignored events") {
    const text = await ports.askText("Ignored events", "Spond events with these opponent names are never changed, even on a Full-Time fixture's date. Events you add by hand are already kept, so most coaches can leave this empty. Separate names with commas.", setup.ignoredOpponents.join(", "));
    if (text === null) return { settings, done: false };
    const updated = upsertSetup(settings, setIgnoredOpponents(setup, text));
    ports.saveSettings(updated);
    return { settings: updated, done: false };
  }
  if (action === "Share this setup") {
    ports.writeClipboard(exportSetup(setup));
    await ports.showMessage("Copied", "Send it to another coach. In their app, they choose Import a shared setup. It doesn't include your Spond login.");
    return { settings, done: false };
  }
  if (await ports.confirm("Remove setup?", `Remove "${setup.name}" from this phone? Spond and Full-Time aren't changed.`, "Remove", true)) {
    const updated = removeSetup(settings, setup.name);
    ports.saveSettings(updated);
    return { settings: updated, done: false };
  }
  return { settings, done: false };
};

export const runApp = async (ports: Ports): Promise<void> => {
  let settings = ports.loadSettings();
  for (;;) {
    const names = settings.setups.map((s) => s.name);
    const options = [...names, "Set up an age group", "Import a shared setup"];
    const message = names.length ? "" : "Start by setting up the age group you coach, or import a setup another coach shared.";
    const choice = await ports.pick("FA Spond Sync", message, options);
    if (choice === null) return;
    if (choice < names.length) {
      const result = await setupMenu(ports, settings, settings.setups[choice]);
      settings = result.settings;
      if (result.done) return;
      continue;
    }
    const setup = options[choice] === "Set up an age group" ? await addAgeGroup(ports) : await importShared(ports);
    if (!setup) continue;
    settings = await saveSetup(ports, settings, setup);
    await ports.showMessage("Saved", `${setup.name}: ${setup.teams.map((t) => t.label).join(", ")}.\n\nThe first sync asks which Spond location each Full-Time venue is.`);
  }
};
