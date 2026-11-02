import { readFileSync } from "node:fs";
import { JSDOM } from "jsdom";
import { describe, expect, it } from "vitest";
import rustOutputFile from "./golden/rust-output.json";
import scenarioFile from "./golden/scenario.json";
import teamsFile from "../../src/teams.json";

// Runs the built bundle against fakes of Scriptable's APIs, to check the real install artefact.
const firstTeam = teamsFile.teams[0];
const adapt = <T>(value: T): T =>
  JSON.parse(JSON.stringify(value).replaceAll(scenarioFile.team_name, firstTeam.full_time.name).replaceAll(scenarioFile.sub_group_id, firstTeam.spond.sub_group_id)) as T;
const scenario = adapt(scenarioFile);
const rustOutput = adapt(rustOutputFile);
const NOW = Date.UTC(2026, 10, 2);

type Mode = "apply" | "closePreview" | "declineConfirm" | "blockPage" | "badLogin" | "failWrite";
interface Call {
  method: string;
  url: string;
  body?: unknown;
  auth?: string;
}

const runBundle = async (mode: Mode) => {
  const bundle = JSON.parse(readFileSync("dist/FA-Spond-Sync.scriptable", "utf8"));
  const calls: Call[] = [];
  const alerts: { title?: string; message?: string }[] = [];
  const keychain = new Map<string, string>();
  let completed = false;
  let previewRows = 0;

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
      if (url.includes("fulltime.thefa.com")) return reply(200, mode === "blockPage" ? "<html>Just a moment...</html>" : scenario.html);
      if (url.endsWith("/auth2/login")) return mode === "badLogin" ? reply(401, "no") : reply(200, JSON.stringify({ accessToken: { token: "TOKEN" } }));
      if (url.includes("/group/")) return reply(200, JSON.stringify(scenario.group));
      if (method === "GET") return reply(200, JSON.stringify(scenario.sponds));
      if (mode === "failWrite" && url.endsWith("/sponds/S6")) return reply(500, "boom");
      if (method === "DELETE") {
        this.response = { statusCode: 200 };
        throw new Error("empty body");
      }
      return reply(200, "{}");
    }
  }
  class Alert {
    title?: string;
    message?: string;
    constructor() {
      alerts.push(this);
    }
    addAction() {}
    addDestructiveAction() {}
    addCancelAction() {}
    addTextField() {}
    addSecureTextField() {}
    textFieldValue(i: number) {
      return i === 0 ? "coach@example.com" : "secret";
    }
    async presentAlert() {
      return this.title === "Update Spond?" && mode === "declineConfirm" ? -1 : 0;
    }
    async presentSheet() {
      return 0;
    }
  }
  const Keychain = {
    contains: (k: string) => keychain.has(k),
    get: (k: string) => keychain.get(k),
    set: (k: string, v: string) => keychain.set(k, v),
    remove: (k: string) => keychain.delete(k),
  };
  class WebView {
    async loadHTML() {}
    async evaluateJavaScript(code: string) {
      return new JSDOM("<!doctype html>", { runScripts: "outside-only" }).window.eval(code);
    }
  }
  class UITableRow {
    onSelect?: () => void;
    addText() {
      return {};
    }
    addButton() {
      return { centerAligned() {} };
    }
  }
  class UITable {
    rows: UITableRow[] = [];
    addRow(row: UITableRow) {
      this.rows.push(row);
    }
    async present() {
      previewRows = this.rows.length;
      if (mode !== "closePreview") this.rows.find((r) => r.onSelect)?.onSelect?.();
    }
  }
  const FixedDate = class extends Date {
    static now() {
      return NOW;
    }
  };
  const globals = {
    Request, Alert, Keychain, WebView, UITable, UITableRow, Date: FixedDate,
    Color: { green: () => 0, orange: () => 0, red: () => 0 },
    Font: { semiboldSystemFont: () => 0, systemFont: () => 0 },
    Script: { complete: () => { completed = true; } },
  };
  const AsyncFunction = Object.getPrototypeOf(async () => {}).constructor;
  await new AsyncFunction(...Object.keys(globals), bundle.script)(...Object.values(globals));
  const writes = calls.filter((c) => c.method !== "GET" && !c.url.endsWith("/auth2/login"));
  return { calls, writes, alerts, keychain, completed, previewRows, bundle };
};

describe("installable bundle", () => {
  it("has the fields Scriptable needs", async () => {
    const { bundle } = await runBundle("closePreview");
    expect(bundle).toMatchObject({ name: "FA Spond Sync", always_run_in_app: true, icon: { color: "green", glyph: "futbol" } });
  });

  it("applies exactly what the Rust client would", async () => {
    const r = await runBundle("apply");
    expect(r.completed).toBe(true);
    expect(r.writes.filter((c) => c.url.endsWith("/sponds")).map((c) => c.body)).toEqual(rustOutput.creates);
    expect(r.writes.filter((c) => /\/sponds\/S\d+$/.test(c.url)).map((c) => c.body)).toEqual(rustOutput.updates);
    expect(r.writes.filter((c) => c.method === "DELETE").map((c) => c.url)).toEqual(rustOutput.removed.map((id) => `https://api.spond.com/core/v1/sponds/${id}?quiet=true`));
    expect(r.writes.every((c) => c.auth === "Bearer TOKEN")).toBe(true);
    expect(r.alerts.at(-1)?.title).toBe("Spond updated");
  });

  it("changes nothing if the preview is closed", async () => {
    const r = await runBundle("closePreview");
    expect(r.previewRows).toBeGreaterThan(1);
    expect(r.writes).toEqual([]);
  });

  it("changes nothing if the confirmation is declined", async () => {
    expect((await runBundle("declineConfirm")).writes).toEqual([]);
  });

  it("changes nothing on a block page", async () => {
    const r = await runBundle("blockPage");
    expect(r.writes).toEqual([]);
    expect(r.alerts.at(-1)?.title).toMatch(/Sync failed/);
  });

  it("forgets the password when the login is rejected", async () => {
    const r = await runBundle("badLogin");
    expect(r.writes).toEqual([]);
    expect(r.keychain.has("ftss.spond.password")).toBe(false);
    expect(r.keychain.has("ftss.spond.email")).toBe(true);
  });

  it("stops and reports progress when a write fails", async () => {
    const r = await runBundle("failWrite");
    expect(r.alerts.at(-1)?.title).toBe("Stopped on an error");
    expect(r.alerts.at(-1)?.message).toMatch(/5 of 9 done/);
    expect(r.writes.filter((c) => c.method === "DELETE")).toEqual([]);
  });

  it("never sends the password anywhere but the login", async () => {
    const r = await runBundle("apply");
    const others = r.calls.filter((c) => !c.url.endsWith("/auth2/login"));
    expect(JSON.stringify(others)).not.toContain("secret");
  });
});
