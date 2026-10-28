"use client";

import { useCallback, useMemo, useSyncExternalStore } from "react";

const STORAGE_KEY = "salaryflow:read-notifications";
const CHANGE_EVENT = "salaryflow:read-notifications-change";
const MAX_STORED = 500;

function parseReadIds(raw: string | null): Set<string> {
  if (!raw) return new Set();
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return new Set();
    return new Set(parsed.filter((id): id is string => typeof id === "string"));
  } catch {
    return new Set();
  }
}

function subscribe(callback: () => void) {
  window.addEventListener("storage", callback);
  window.addEventListener(CHANGE_EVENT, callback);
  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener(CHANGE_EVENT, callback);
  };
}

function getSnapshot() {
  try {
    return window.localStorage.getItem(STORAGE_KEY) ?? "";
  } catch {
    return "";
  }
}

function getServerSnapshot() {
  return "";
}

function writeReadIds(ids: Set<string>) {
  try {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(Array.from(ids).slice(-MAX_STORED))
    );
  } catch {
    // Storage may be unavailable (private mode); nothing else to do.
  }
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

/**
 * Tracks which derived notifications the browser has seen. Read state is
 * intentionally client-side: notifications are derived from live financial
 * records, so there is no per-user notification row to persist a flag on.
 */
export function useReadNotifications(ids: string[]) {
  const raw = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const readIds = useMemo(() => parseReadIds(raw), [raw]);

  const markRead = useCallback((id: string) => {
    const current = parseReadIds(getSnapshot());
    if (current.has(id)) return;
    current.add(id);
    writeReadIds(current);
  }, []);

  const markAllRead = useCallback(() => {
    const current = parseReadIds(getSnapshot());
    ids.forEach((id) => current.add(id));
    writeReadIds(current);
  }, [ids]);

  const unreadCount = useMemo(
    () => ids.filter((id) => !readIds.has(id)).length,
    [ids, readIds]
  );

  return { readIds, unreadCount, markRead, markAllRead };
}
