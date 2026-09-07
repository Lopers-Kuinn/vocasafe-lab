"use client";

const LAST_ACTIVITY_KEY = "vocasafe_last_activity_at";

export const SESSION_IDLE_LIMIT_MS = 30 * 60 * 1000;
export const SESSION_IDLE_WARNING_MS = 60 * 1000;

export function getLastSessionActivity(): number | null {
  if (typeof window === "undefined") return null;

  const value = window.localStorage.getItem(LAST_ACTIVITY_KEY);
  if (!value) return null;

  const timestamp = Number(value);
  return Number.isFinite(timestamp) && timestamp > 0 ? timestamp : null;
}

export function markSessionActivity(timestamp = Date.now()): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(LAST_ACTIVITY_KEY, String(timestamp));
}

export function clearSessionActivity(): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(LAST_ACTIVITY_KEY);
}

export function isSessionActivityStorageKey(key: string | null): boolean {
  return key === LAST_ACTIVITY_KEY;
}
