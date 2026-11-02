import teamsFile from "../../src/teams.json";
import type { Team } from "./domain/types";

// src/teams.json is shared with the Rust CLI, so a team only needs adding once.
export const TEAMS: Team[] = teamsFile.teams.map((t) => ({
  name: t.name,
  fullTimeName: t.full_time.name,
  teamId: t.full_time.id,
  seasonId: t.full_time.season_id,
  subGroupId: t.spond.sub_group_id,
}));

/** Same group as src/main.rs. */
export const GROUP_ID = "12BC6CAB8503463C8845B14A6CBC8D4A";

/** Spond events that are managed by hand and must never be treated as fixtures. */
export const IGNORED_OPPONENTS = ["BYFL Summer Tournament", "Binfield Tournament", "Wargrave Tournament", "Tilehurst Panthers T", "Cold Ash Tourny"];
