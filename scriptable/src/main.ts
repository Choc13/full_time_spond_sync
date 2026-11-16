import { forgetPassword, loadCredentials } from "./adapters/credentials";
import { webViewClubPage } from "./adapters/clubPage";
import { scriptableHttp } from "./adapters/http";
import { loadSettings, readClipboard, saveSettings, writeClipboard } from "./adapters/storage";
import { askText, confirm, pick, showMessage, showPreview } from "./adapters/ui";
import { runApp, Stop } from "./app";

export const run = async (): Promise<void> => {
  try {
    await runApp({
      now: () => Date.now(),
      http: scriptableHttp,
      readClubPage: webViewClubPage,
      loadCredentials,
      forgetPassword,
      loadSettings,
      saveSettings,
      readClipboard,
      writeClipboard,
      pick,
      askText,
      confirm,
      showPreview,
      showMessage,
    });
  } catch (error) {
    if (error instanceof Stop) await showMessage("Nothing was changed", error.message);
    else await showMessage("Sync failed. Spond wasn't changed.", (error as Error).message);
  }
  Script.complete();
};
