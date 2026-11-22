import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { exportSetup, writeSettings } from "../src/domain/settings";
import { clubPageHtml, expected, group, NOW, runInWebView, setup, sponds, unmarkedSponds } from "./helpers";

// Runs the built .scriptable file against fakes of Scriptable's APIs, to check the real install artefact.

interface Call {
  method: string;
  url: string;
  body?: unknown;
  auth?: string;
}
interface Dialog {
  title: string;
  message: string;
  options: string[];
}
/** Answers each dialog: an option's text for a sheet, a string for a text field, true/false to confirm, or null to cancel. */
type Answer = (dialog: Dialog) => string | boolean | null;

interface Options {
  answer: Answer;
  settings?: unknown;
  clipboard?: string | null;
  fullTimeHtml?: string;
  failWrite?: string;
  loginStatus?: number;
  /** The team's upcoming Spond events, if not the scenario's. */
  teamSponds?: unknown[];
}

const runBundle = async (options: Options) => {
  const bundle = JSON.parse(readFileSync("dist/FA-Spond-Sync.scriptable", "utf8"));
  const calls: Call[] = [];
  const dialogs: Dialog[] = [];
  const files = new Map<string, string>();
  const keychain = new Map<string, string>();
  let clipboard = options.clipboard ?? null;
  let previewRows: string[] = [];
  let completed = false;
  if (options.settings) files.set("/docs/fa-spond-sync-settings.json", JSON.stringify(options.settings));

  class Request {
    method = "GET";
    headers: Record<string, string> = {};
    body?: string;
    response?: { statusCode: number };
    timeoutInterval = 0;
    constructor(public url: string) {}
    async loadString() {
      const { url, method } = this;
      calls.push({ method, url, body: this.body && JSON.parse(this.body), auth: this.headers.Authorization });
      const reply = (statusCode: number, text: string) => {
        this.response = { statusCode };
        return text;
      };
      if (url.startsWith("https://fulltime.thefa.com/fixtures.html?")) return reply(200, options.fullTimeHtml ?? clubPageHtml());
      if (url.endsWith("/auth2/login")) return options.loginStatus ? reply(options.loginStatus, "no") : reply(200, JSON.stringify({ accessToken: { token: "TOKEN" } }));
      if (url.endsWith("/groups/")) return reply(200, JSON.stringify([{ ...group, name: "Twyford Comets" }, { id: "OTHER", name: "Other club", subGroups: [], members: [], roles: [] }]));
      if (url.endsWith(`/group/${group.id}`)) return reply(200, JSON.stringify(group));
      if (method === "GET" && url.includes("/sponds?")) return reply(200, JSON.stringify(url.includes("subGroupId=") ? (options.teamSponds ?? sponds) : [...sponds, { ...sponds[0], id: "OLD", location: { feature: "Cintra Park", address: "Cintra Park, Reading, RG2 7ES", latitude: "51.442006", longitude: "-0.958364" } }]));
      if (options.failWrite && url.endsWith(options.failWrite)) return reply(500, "boom");
      if (method === "DELETE") {
        this.response = { statusCode: 200 };
        throw new Error("empty body");
      }
      return reply(200, "{}");
    }
  }
  class Alert {
    title = "";
    message = "";
    actions: string[] = [];
    fields: string[] = [];
    addAction(a: string) {
      this.actions.push(a);
    }
    addDestructiveAction(a: string) {
      this.actions.push(a);
    }
    addCancelAction() {}
    addTextField(_placeholder: string, value: string) {
      this.fields.push(value);
    }
    addSecureTextField() {
      this.fields.push("");
    }
    textFieldValue(i: number) {
      return this.fields[i];
    }
    private respond(): number {
      const dialog = { title: this.title, message: this.message, options: this.actions };
      dialogs.push(dialog);
      if (this.title === "Spond login") {
        this.fields = ["coach@example.com", "secret"];
        return 0;
      }
      if (this.actions.length === 0) return -1;
      const answer = options.answer(dialog);
      if (answer === null || answer === false) return -1;
      if (typeof answer === "string" && this.fields.length) {
        this.fields[0] = answer;
        return 0;
      }
      if (answer === true) return 0;
      const index = this.actions.indexOf(answer as string);
      if (index === -1) throw new Error(`No option "${answer}" in "${this.title}": ${this.actions.join(" | ")}`);
      return index;
    }
    async presentAlert() {
      return this.respond();
    }
    async presentSheet() {
      return this.respond();
    }
  }
  const fm = {
    documentsDirectory: () => "/docs",
    joinPath: (a: string, b: string) => `${a}/${b}`,
    fileExists: (p: string) => files.has(p),
    readString: (p: string) => files.get(p),
    writeString: (p: string, s: string) => files.set(p, s),
  };
  class UITableRow {
    onSelect?: () => void;
    text = "";
    addText(title: string) {
      this.text = title;
      return {};
    }
    addButton(title: string) {
      this.text = title;
      return { centerAligned() {} };
    }
  }
  class UITable {
    rows: UITableRow[] = [];
    addRow(row: UITableRow) {
      this.rows.push(row);
    }
    async present() {
      previewRows = this.rows.map((r) => r.text);
      const apply = this.rows.find((r) => r.onSelect);
      if (apply && options.answer({ title: "Preview", message: "", options: previewRows })) apply.onSelect?.();
    }
  }
  const FixedDate = class extends Date {
    static now() {
      return NOW;
    }
  };
  const globals = {
    Request, Alert, UITable, UITableRow, Date: FixedDate,
    Keychain: { contains: (k: string) => keychain.has(k), get: (k: string) => keychain.get(k), set: (k: string, v: string) => keychain.set(k, v), remove: (k: string) => keychain.delete(k) },
    WebView: class { async loadHTML() {} async evaluateJavaScript(code: string) { return runInWebView(code); } },
    FileManager: { local: () => fm },
    Pasteboard: { pasteString: () => clipboard, copyString: (s: string) => { clipboard = s; } },
    Color: { green: () => 0, orange: () => 0, red: () => 0, gray: () => 0 },
    Font: { semiboldSystemFont: () => 0, systemFont: () => 0 },
    Script: { complete: () => { completed = true; } },
  };
  const AsyncFunction = Object.getPrototypeOf(async () => {}).constructor;
  await new AsyncFunction(...Object.keys(globals), bundle.script)(...Object.values(globals));
  const writes = calls.filter((c) => c.method !== "GET" && !c.url.endsWith("/auth2/login"));
  const saved = files.has("/docs/fa-spond-sync-settings.json") ? JSON.parse(files.get("/docs/fa-spond-sync-settings.json") as string) : null;
  return { calls, writes, dialogs, keychain, completed, previewRows, bundle, saved, clipboard, last: dialogs.at(-1) };
};

const savedSettings = { version: 1, setups: [setup] };

/** Picks the setup, then the given action, then answers the rest with `rest`. */
const choose = (action: string, rest: Answer = () => true): Answer => {
  let menus = 0;
  return (d) => {
    if (d.title === "FA Spond Sync") return menus++ === 0 ? setup.name : null;
    if (d.title === setup.name) return action;
    return rest(d);
  };
};

describe("installable bundle", () => {
  it("has the fields Scriptable needs", async () => {
    const { bundle } = await runBundle({ answer: () => null });
    expect(bundle).toMatchObject({ name: "FA Spond Sync", always_run_in_app: true, icon: { color: "green", glyph: "futbol" } });
  });

  it("offers setup or import on first run", async () => {
    const r = await runBundle({ answer: () => null });
    expect(r.dialogs[0].options).toEqual(["Set up an age group", "Import a shared setup"]);
    expect(r.completed).toBe(true);
  });

  it("applies exactly what the Rust client would", async () => {
    const r = await runBundle({ settings: savedSettings, answer: choose("Sync all teams (1)") });
    expect(r.writes.filter((c) => c.url.endsWith("/sponds")).map((c) => c.body)).toEqual(expected.creates);
    expect(r.writes.filter((c) => /\/sponds\/S\d+$/.test(c.url)).map((c) => c.body)).toEqual(expected.updates);
    expect(r.writes.filter((c) => c.method === "DELETE").map((c) => c.url)).toEqual(expected.removed.map((id) => `https://api.spond.com/core/v1/sponds/${id}?quiet=true`));
    expect(r.writes.every((c) => c.auth === "Bearer TOKEN")).toBe(true);
    expect(r.last?.title).toBe("Spond updated");
    expect(r.calls.filter((c) => c.url.includes("fulltime"))).toHaveLength(1);
  });

  it("changes nothing if the preview is closed or the confirmation declined", async () => {
    const closed = await runBundle({ settings: savedSettings, answer: choose("Sync Meteors", (d) => d.title !== "Preview") });
    expect(closed.previewRows.length).toBeGreaterThan(1);
    expect(closed.writes).toEqual([]);
    const declined = await runBundle({ settings: savedSettings, answer: choose("Sync Meteors", (d) => d.title !== "Update Spond?") });
    expect(declined.writes).toEqual([]);
  });

  it("changes nothing on a block page", async () => {
    const r = await runBundle({ settings: savedSettings, fullTimeHtml: "<html>Just a moment...</html>", answer: choose("Sync Meteors") });
    expect(r.writes).toEqual([]);
    expect(r.last?.title).toBe("Nothing was changed");
  });

  it("asks once for each new venue and saves the answer", async () => {
    const withoutCintra = { version: 1, setups: [{ ...setup, venues: setup.venues.filter((v) => v.fullTimeName !== "Cintra Park") }] };
    const r = await runBundle({
      settings: withoutCintra,
      answer: choose("Sync Meteors", (d) => (d.title === "Which Spond location?" ? d.options.find((o) => o.startsWith("Cintra Park")) ?? null : true)),
    });
    expect(r.dialogs.filter((d) => d.title === "Which Spond location?")).toHaveLength(1);
    expect(r.saved.setups[0].venues.find((v: { fullTimeName: string }) => v.fullTimeName === "Cintra Park").location.feature).toBe("Cintra Park");
    expect(r.writes.filter((c) => c.url.endsWith("/sponds")).map((c) => c.body)).toEqual(expected.creates);
  });

  it("changes nothing if a new venue isn't matched", async () => {
    const withoutCintra = { version: 1, setups: [{ ...setup, venues: setup.venues.filter((v) => v.fullTimeName !== "Cintra Park") }] };
    const r = await runBundle({ settings: withoutCintra, answer: choose("Sync Meteors", (d) => (d.title === "Which Spond location?" ? null : true)) });
    expect(r.writes).toEqual([]);
    expect(r.last?.title).toBe("Nothing was changed");
  });

  it("sets up an age group from a Full-Time link", async () => {
    const link = "https://fulltime.thefa.com/fixtures.html?selectedSeason=669507446&selectedFixtureGroupAgeGroup=13&selectedClub=649312641&itemsPerPage=25";
    let menus = 0;
    const r = await runBundle({
      clipboard: link,
      answer: (d) => {
        if (d.title === "FA Spond Sync") return menus++ === 0 ? "Set up an age group" : null;
        if (d.title === "Full-Time fixtures link") return link;
        if (d.title === "Which Spond group?") return "Twyford Comets";
        if (d.title === "Twyford Comets FC U10 Galaxy") return "Don't sync this team";
        if (d.title === "Twyford Comets FC U10 Meteors") return d.options[0];
        if (d.title === "Name this age group") return "U10s";
        return true;
      },
    });
    const meteors = group.subGroups.find((sg) => sg.id === setup.teams[0].subGroupId);
    expect(r.saved.setups).toEqual([
      { name: "U10s", fullTime: setup.fullTime, spondGroupId: group.id, teams: [{ label: meteors?.name, fullTimeId: 14943433, fullTimeName: "Twyford Comets FC U10 Meteors", subGroupId: setup.teams[0].subGroupId }], venues: [], ignoredOpponents: [] },
    ]);
    expect(r.writes).toEqual([]);
  });

  it("shares a setup without the login, and imports it", async () => {
    const shared = await runBundle({ settings: savedSettings, answer: choose("Share this setup", () => null) });
    expect(shared.clipboard).toBe(exportSetup(setup));
    expect(shared.clipboard).not.toContain("secret");
    let menus = 0;
    const imported = await runBundle({ clipboard: shared.clipboard, answer: (d) => (d.title === "FA Spond Sync" ? (menus++ === 0 ? "Import a shared setup" : null) : true) });
    expect(imported.saved).toEqual(JSON.parse(writeSettings({ version: 1, setups: [setup] })));
  });

  it("skips ignored events", async () => {
    const r = await runBundle({ settings: { version: 1, setups: [{ ...setup, ignoredOpponents: ["juliet"] }] }, answer: choose("Sync Meteors") });
    expect(r.writes.filter((c) => c.method === "DELETE")).toEqual([]);
  });

  it("forgets the password when the login is rejected", async () => {
    const r = await runBundle({ settings: savedSettings, loginStatus: 401, answer: choose("Sync Meteors") });
    expect(r.writes).toEqual([]);
    expect(r.keychain.has("ftss.spond.password")).toBe(false);
    expect(r.keychain.has("ftss.spond.email")).toBe(true);
  });

  it("stops and reports progress when a write fails", async () => {
    const r = await runBundle({ settings: savedSettings, failWrite: "/sponds/S6", answer: choose("Sync Meteors") });
    expect(r.last?.title).toBe("Stopped on an error");
    expect(r.last?.message).toMatch(/5 of 9 done/);
    expect(r.writes.filter((c) => c.method === "DELETE")).toEqual([]);
  });

  it("never sends the password anywhere but the login", async () => {
    const r = await runBundle({ settings: savedSettings, answer: choose("Sync Meteors") });
    expect(JSON.stringify(r.calls.filter((c) => !c.url.endsWith("/auth2/login")))).not.toContain("secret");
  });

  it("leaves events added by hand alone", async () => {
    const tournament = { ...sponds[0], id: "TOURNAMENT", heading: "Meteors - Summer tournament", description: "Entered by hand", startTimestamp: "2027-06-12T08:00:00Z", endTimestamp: "2027-06-12T15:00:00Z" };
    const r = await runBundle({ settings: savedSettings, teamSponds: [...sponds, tournament], answer: choose("Sync all teams (1)") });
    expect(r.writes.some((c) => c.url.includes("TOURNAMENT"))).toBe(false);
    expect(r.writes.filter((c) => c.method === "DELETE").map((c) => c.url)).toEqual(expected.removed.map((id) => `https://api.spond.com/core/v1/sponds/${id}?quiet=true`));
    expect(r.previewRows.at(-1)).toMatch(/^Keep: .*Delta/);
  });
});
