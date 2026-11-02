import type { HttpResponse } from "../app";
import type { FixturesPage, PageRow, Team } from "../domain/types";

// The subset of the DOM used below. The DOM library can't be enabled in tsconfig because
// its Request type clashes with Scriptable's.
interface PageElement {
  innerHTML: string;
  querySelectorAll(selector: string): Iterable<PageElement>;
}
interface PageDocument extends PageElement {
  createTreeWalker(root: PageElement, whatToShow: number): { nextNode(): unknown; currentNode: { nodeValue: string } };
}
interface PageGlobals {
  DOMParser: new () => { parseFromString(html: string, type: string): PageDocument };
  NodeFilter: { SHOW_TEXT: number };
}

/**
 * Runs inside the WebView, sent as source text, so it can only use browser globals.
 * DOMParser doesn't execute the page's scripts.
 */
export function extractFixturesPage(html: string, teamName: string): Omit<FixturesPage, "status"> {
  const page = globalThis as unknown as PageGlobals;
  const doc = new page.DOMParser().parseFromString(html, "text/html");
  const textNodes = (element: PageElement): string[] => {
    const walker = doc.createTreeWalker(element, page.NodeFilter.SHOW_TEXT);
    const nodes: string[] = [];
    while (walker.nextNode()) nodes.push(walker.currentNode.nodeValue.trim());
    return nodes;
  };
  const teamTexts = (cell: PageElement): string[] => [...cell.querySelectorAll("a")].flatMap(textNodes);
  const tables = [...doc.querySelectorAll("div.fixtures-table table")];
  const rows: PageRow[] = tables.length === 1
    ? [...tables[0].querySelectorAll("tbody tr")].map((tr) => {
        const cells = [...tr.querySelectorAll("td")];
        if (cells.length !== 8) return { cellCount: cells.length, type: "", dateSpans: [], home: [], away: [], venue: "" };
        return {
          cellCount: 8,
          type: cells[0].innerHTML,
          dateSpans: [...cells[1].querySelectorAll("span")].map((s) => s.innerHTML),
          home: teamTexts(cells[2]),
          away: teamTexts(cells[6]),
          venue: cells[7].innerHTML,
        };
      })
    : [];
  return { tableCount: tables.length, rows, teamNameFound: html.toLowerCase().includes(teamName.toLowerCase()) };
}

export const webViewFixturesPage = async (response: HttpResponse, team: Team): Promise<FixturesPage> => {
  const webView = new WebView();
  await webView.loadHTML("<!doctype html><html></html>");
  const call = `JSON.stringify((${extractFixturesPage.toString()})(${JSON.stringify(response.text)}, ${JSON.stringify(team.fullTimeName)}))`;
  return { status: response.status, ...JSON.parse(await webView.evaluateJavaScript(call)) };
};
