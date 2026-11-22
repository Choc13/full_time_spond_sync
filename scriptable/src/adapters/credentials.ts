import type { Credentials } from "../app";

const KEY_EMAIL = "ftss.spond.email";
const KEY_PASSWORD = "ftss.spond.password";

const askForCredentials = async (): Promise<Credentials | null> => {
  const alert = new Alert();
  alert.title = "Spond login";
  alert.message = "Use a Spond admin account for your team. Saved in the iOS Keychain on this phone only.";
  alert.addTextField("Email", Keychain.contains(KEY_EMAIL) ? Keychain.get(KEY_EMAIL) : "");
  alert.addSecureTextField("Password", "");
  alert.addAction("Save");
  alert.addCancelAction("Cancel");
  if ((await alert.presentAlert()) === -1) return null;
  const email = alert.textFieldValue(0).trim();
  const password = alert.textFieldValue(1);
  if (!email || !password) return null;
  Keychain.set(KEY_EMAIL, email);
  Keychain.set(KEY_PASSWORD, password);
  return { email, password };
};

export const loadCredentials = async (): Promise<Credentials | null> =>
  Keychain.contains(KEY_EMAIL) && Keychain.contains(KEY_PASSWORD) ? { email: Keychain.get(KEY_EMAIL), password: Keychain.get(KEY_PASSWORD) } : askForCredentials();

export const forgetPassword = (): void => {
  if (Keychain.contains(KEY_PASSWORD)) Keychain.remove(KEY_PASSWORD);
};
