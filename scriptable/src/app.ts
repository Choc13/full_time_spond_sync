import { GROUP_ID, IGNORED_OPPONENTS } from "./config";
import { describePlan, summariseOperations } from "./domain/describe";
import { parseFixturesPage } from "./domain/fullTime";
import { operationsFor, planForTeam } from "./domain/plan";
import type { FixturesPage, Group, Instant, Operation, Plan, PreviewSection, Spond, Team } from "./domain/types";

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
  readFixturesPage: (response: HttpResponse, team: Team) => Promise<FixturesPage>;
  loadCredentials: () => Promise<Credentials | null>;
  forgetPassword: () => void;
  chooseTeam: () => Promise<Team | null>;
  /** Resolves to true only if the person asked to apply the changes. */
  showPreview: (sections: PreviewSection[], operations: Operation[]) => Promise<boolean>;
  confirmApply: (operations: Operation[]) => Promise<boolean>;
  showMessage: (title: string, message: string) => Promise<void>;
}

const SPOND_API = "https://api.spond.com/core/v1";

const fixturesUrl = (team: Team): string => `https://fulltime.thefa.com/displayTeam.html?divisionseason=${team.seasonId}&teamID=${team.teamId}`;

const spondsUrl = (subGroupId: string, now: Instant): string => {
  const query = {
    addProfileInfo: false,
    excludeAvailability: true,
    excludeRepeating: true,
    groupId: GROUP_ID,
    includeComments: false,
    includeHidden: true,
    match: true,
    max: 100,
    order: "asc",
    minStartTimestamp: new Date(now).toISOString(),
    scheduled: false,
    subGroupId,
  };
  return `${SPOND_API}/sponds?${Object.entries(query).map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join("&")}`;
};

const expectOk = (response: HttpResponse, action: string): HttpResponse => {
  if (response.status < 200 || response.status >= 300) throw new Error(`${action} failed with HTTP ${response.status}: ${response.text.slice(0, 200)}`);
  return response;
};

const authHeaders = (token: string): Record<string, string> => ({ Authorization: `Bearer ${token}`, "Content-Type": "application/json" });

const signIn = async (ports: Ports): Promise<string | null> => {
  const credentials = await ports.loadCredentials();
  if (!credentials) return null;
  const response = await ports.http("POST", `${SPOND_API}/auth2/login`, { headers: { "Content-Type": "application/json" }, body: JSON.stringify(credentials) });
  if (response.status === 400 || response.status === 401 || response.status === 403) {
    ports.forgetPassword();
    throw new Error(`Spond rejected the login (HTTP ${response.status}). You'll be asked for your password next time.`);
  }
  return JSON.parse(expectOk(response, "Spond login").text).accessToken.token as string;
};

const getJson = async <T>(ports: Ports, url: string, token: string, action: string): Promise<T> =>
  JSON.parse(expectOk(await ports.http("GET", url, { headers: authHeaders(token) }), action).text) as T;

const isIgnored = (spond: Spond): boolean => Boolean(spond.matchInfo) && IGNORED_OPPONENTS.includes((spond.matchInfo as { opponentName: string }).opponentName.trim());

const buildPlan = async (ports: Ports, token: string, team: Team, now: Instant): Promise<Plan> => {
  const page = await ports.readFixturesPage(await ports.http("GET", fixturesUrl(team)), team);
  const fixtures = parseFixturesPage(page, team, now);
  const sponds = await getJson<Spond[]>(ports, spondsUrl(team.subGroupId, now), token, `Loading ${team.name} from Spond`);
  return planForTeam(team, fixtures, sponds.filter((s) => !isIgnored(s)));
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
export const runApp = async (ports: Ports): Promise<void> => {
  const team = await ports.chooseTeam();
  if (!team) return;
  const token = await signIn(ports);
  if (!token) return;

  const group = await getJson<Group>(ports, `${SPOND_API}/group/${GROUP_ID}`, token, "Loading the Spond group");
  const plan = await buildPlan(ports, token, team, ports.now());
  const operations = operationsFor(plan, group);

  if (!(await ports.showPreview([describePlan(plan)], operations))) return;
  if (!(await ports.confirmApply(operations))) return;

  const result = await applyOperations(ports, token, operations);
  if (result.error) {
    await ports.showMessage("Stopped on an error", `${result.done.length} of ${operations.length} done.\n\n${result.error}\n\nRun it again to pick up the rest.`);
  } else {
    await ports.showMessage("Spond updated", summariseOperations(result.done));
  }
};
