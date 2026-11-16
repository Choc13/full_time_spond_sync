import { EMPTY_SETTINGS, readSettings, writeSettings } from "../domain/settings";
import type { Settings } from "../domain/settings";

// Settings live in Scriptable's own documents folder on this phone, next to nothing else.
const FILE_NAME = "fa-spond-sync-settings.json";

const settingsPath = (): string => {
  const fm = FileManager.local();
  return fm.joinPath(fm.documentsDirectory(), FILE_NAME);
};

export const loadSettings = (): Settings => {
  const fm = FileManager.local();
  const path = settingsPath();
  if (!fm.fileExists(path)) return EMPTY_SETTINGS;
  try {
    return readSettings(fm.readString(path));
  } catch (error) {
    throw new Error(`Your saved settings couldn't be read (${(error as Error).message}). They're in ${FILE_NAME} in Scriptable's folder.`);
  }
};

export const saveSettings = (settings: Settings): void => {
  FileManager.local().writeString(settingsPath(), writeSettings(settings));
};

export const readClipboard = (): string | null => Pasteboard.pasteString();
export const writeClipboard = (text: string): void => Pasteboard.copyString(text);
