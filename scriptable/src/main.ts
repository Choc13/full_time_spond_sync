import { forgetPassword, loadCredentials } from "./adapters/credentials";
import { webViewFixturesPage } from "./adapters/fixturesPage";
import { scriptableHttp } from "./adapters/http";
import { chooseTeam, confirmApply, showMessage, showPreview } from "./adapters/ui";
import { runApp } from "./app";

export const run = async (): Promise<void> => {
  try {
    await runApp({ now: () => Date.now(), http: scriptableHttp, readFixturesPage: webViewFixturesPage, loadCredentials, forgetPassword, chooseTeam, showPreview, confirmApply, showMessage });
  } catch (error) {
    await showMessage("Sync failed. Spond wasn't changed.", (error as Error).message);
  }
  Script.complete();
};
