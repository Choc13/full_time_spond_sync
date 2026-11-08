# full_time_spond_sync

Syncs fixtures from the FA Full Time website to Spond.

## Prerequisites

- Rust (via [rustup](https://rustup.rs))
- Python 3 with `curl_cffi`: `pip install curl_cffi`
- [just](https://just.systems) (`brew install just`)

## Building

```
just build
```

## Usage

```
./target/release/full_time_spond_sync -e <email> -p <password> --teams <team> diff
./target/release/full_time_spond_sync -e <email> -p <password> --teams <team> sync
```

## iPhone app

`scriptable/` is a TypeScript version of the sync that runs on an iPhone in the free [Scriptable](https://scriptable.app) app. It shows the changes first, then applies exactly what you approved.

### Installing

1. Install Scriptable from the App Store.
2. On your iPhone, download [FA-Spond-Sync.scriptable](https://github.com/Choc13/full_time_spond_sync/releases/download/scriptable-latest/FA-Spond-Sync.scriptable).
3. Open the file, choose Scriptable, then tap **Add to My Scripts**.
4. Run **FA Spond Sync**, pick your team and enter your Spond login. You need admin access to your team in Spond. The login is saved in the iOS Keychain on your phone only.

To add a shortcut, open the script's settings in Scriptable and choose **Add to Home Screen**.

### Adding a team

Add it to `src/teams.json`, which the CLI and the app share. A new venue also needs adding to `scriptable/src/domain/venues.ts` and `parseVenue` in `scriptable/src/domain/fullTime.ts`. Merging to `master` publishes a new build to the download link.

### Developing

```
cd scriptable
npm ci
npm run typecheck
npm test
```

`npm test` also builds `dist/FA-Spond-Sync.scriptable`. The tests in `test/golden` check the app's requests against output captured from the Rust client.
