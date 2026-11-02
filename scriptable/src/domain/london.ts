import type { Instant } from "./types";

// London time is calculated here so that the phone's timezone can't affect the result.

export const MINUTE = 60_000;
export const HOUR = 60 * MINUTE;

// BST runs from 01:00 UTC on the last Sunday of March to 01:00 UTC on the last Sunday of October.
const lastSundayAt1amUtc = (year: number, month: number): Instant => {
  const lastDay = new Date(Date.UTC(year, month + 1, 0, 1));
  return lastDay.getTime() - lastDay.getUTCDay() * 24 * HOUR;
};

const londonOffset = (instant: Instant): number => {
  const year = new Date(instant).getUTCFullYear();
  return instant >= lastSundayAt1amUtc(year, 2) && instant < lastSundayAt1amUtc(year, 9) ? HOUR : 0;
};

/** Throws for times that don't exist or happen twice when the clocks change. */
export const londonToInstant = (year: number, month: number, day: number, hour: number, minute: number): Instant => {
  const wall = Date.UTC(year, month - 1, day, hour, minute);
  const matches = [wall, wall - HOUR].filter((instant) => instant + londonOffset(instant) === wall);
  if (matches.length !== 1) throw new Error(`Not a valid London time: ${day}/${month}/${year} ${hour}:${minute}`);
  return matches[0];
};

const londonWall = (instant: Instant): Date => new Date(instant + londonOffset(instant));

export const londonDateKey = (instant: Instant): string => londonWall(instant).toISOString().slice(0, 10);

export const formatInstant = (instant: Instant): string => new Date(instant).toISOString().replace(/\.000Z$/, "Z");

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const pad = (n: number): string => String(n).padStart(2, "0");

export const formatLondon = (instant: Instant): string => {
  const d = londonWall(instant);
  return `${DAYS[d.getUTCDay()]} ${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`;
};
