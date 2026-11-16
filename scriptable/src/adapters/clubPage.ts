import type { HttpResponse } from "../app";
import type { ClubPage, ClubPageRow } from "../domain/types";

// The subset of the DOM used below. The DOM library can't be enabled in tsconfig because
// its Request type clashes with Scriptable's.
interface PageElement {
  textContent: string | null;
  getAttribute(name: string): string | null;
  querySelector(selector: string): PageElement | null;
  querySelectorAll(selector: string): Iterable<PageElement>;
}
interface PageGlobals {
  DOMParser: new () => { parseFromString(html: string, type: string): PageElement };
}

/**
 * Runs inside the WebView, sent as source text, so it can only use browser globals.
 * DOMParser doesn't execute the page's scripts.
 */
export function extractClubPage(html: string): Omit<ClubPage, "status"> {
  const doc = new (globalThis as unknown as PageGlobals).DOMParser().parseFromString(html, "text/html");
  const text = (element: PageElement | null): string => (element?.textContent ?? "").replace(/\s+/g, " ").trim();
  const teams = [...doc.querySelectorAll("#form1_selectedTeam option")]
    .filter((o) => o.getAttribute("value"))
    .map((o) => ({ id: Number(o.getAttribute("value")), name: text(o) }));
  const ageGroup = text(doc.querySelector("#form1_selectedFixtureGroupAgeGroup option[selected]"));
  const tables = [...doc.querySelectorAll("div.fixtures-table table")];
  const rows: ClubPageRow[] = tables.length === 1
    ? [...tables[0].querySelectorAll("tbody tr")].map((tr) => {
        const cells = [...tr.querySelectorAll("td")];
        const row = { cellCount: cells.length, text: text(tr), type: "", dateSpans: [] as string[], home: "", away: "", venue: "" };
        if (cells.length !== 10) return row;
        return { ...row, type: text(cells[0]), dateSpans: [...cells[1].querySelectorAll("span")].map(text), home: text(cells[2]), away: text(cells[6]), venue: text(cells[7]) };
      })
    : [];
  return { teams, ageGroup, tableCount: tables.length, rows };
}

export const webViewClubPage = async (response: HttpResponse): Promise<ClubPage> => {
  const webView = new WebView();
  await webView.loadHTML("<!doctype html><html></html>");
  const call = `JSON.stringify((${extractClubPage.toString()})(${JSON.stringify(response.text)}))`;
  return { status: response.status, ...JSON.parse(await webView.evaluateJavaScript(call)) };
};
