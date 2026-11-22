`rust-output.json` is what the original Rust diff and request builders produced for `scenario.json`.
The scenario's fixtures page is in Full-Time's older team-page format; `test/helpers.ts` rewrites it
as the club fixtures page the app now reads. `venues.json` maps each Full-Time venue in the scenario
to the Spond location the Rust client used for it.
