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

`scriptable/` is a TypeScript version of the sync that runs on an iPhone in the free [Scriptable](https://scriptable.app) app. It shows the changes first, then applies exactly what you approved. Each phone keeps its own setup, so any coach at any club can use it without changing the code.

### Installing

1. Install Scriptable from the App Store.
2. On your iPhone, download [FA-Spond-Sync.scriptable](https://github.com/Choc13/full_time_spond_sync/releases/download/scriptable-latest/FA-Spond-Sync.scriptable).
3. Open the file, choose Scriptable, then tap **Add to My Scripts**.

To add a shortcut, open the script's settings in Scriptable and choose **Add to Home Screen**.

### Setting up an age group

1. On Full-Time, open **Fixtures**, choose your club and age group, and copy the page's link.
2. Run **FA Spond Sync**, choose **Set up an age group** and paste the link.
3. Log in to Spond with an account that can manage your teams. The login is saved in the iOS Keychain on your phone only.
4. For each of the club's teams in that age group, pick its Spond sub-group, or **Don't sync this team**.

The first sync asks which Spond location each Full-Time venue is, offering locations from your recent Spond events, and remembers the answers. If a venue has never been used in Spond, create one event there by hand first.

**Ignored events** lists opponent names whose Spond events the sync never changes, even on a Full-Time fixture's date. Most events added by hand don't need it (see below).

### Sharing a setup

Choose **Share this setup** to copy it, then send it to another coach. They choose **Import a shared setup** with it copied. It includes the teams, venues and ignored events, but never a login.

### Syncing

Pick an age group, then **Sync all teams** or a single team. The app reads every team's fixtures from the club's Full-Time fixtures page, so moving teams to new divisions needs no changes. It stops without changing anything if Full-Time returns an error or block page, if the page may be cut off, or if a team has no fixtures on Full-Time but upcoming synced events in Spond.

### Events added by hand

The sync only changes and deletes the events it made. It marks them with the line "Kept up to date from FA Full-Time by FA Spond Sync." in the event description. Any other match event, such as a summer tournament or a provisional date for a cup game, is shown as **Keep** in the preview and never deleted.

When Full-Time publishes a fixture on the same date as an event added by hand, the sync takes that event over: it updates the time, opponent and venue, gives it the usual heading, adds the marker and keeps everyone's replies. So a provisional cup date becomes the real fixture. To stop the sync touching an event it made, delete the marker line from its description in Spond.

The first sync after this change marks every existing event that matches a Full-Time fixture. Events from before the change that aren't on Full-Time are kept, so delete any old ones in Spond by hand.

### Developing

```
cd scriptable
npm ci
npm run typecheck
npm test
```

`npm test` also builds `dist/FA-Spond-Sync.scriptable`. The tests in `test/golden` check the app's requests against output captured from the Rust client. Merging to `master` publishes a new build to the download link.
