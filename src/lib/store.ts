"use client";

import { useSyncExternalStore } from "react";

/**
 * Small client state: the target being set up.
 * Kept in localStorage so a refresh does not lose the choice. Nothing
 * sensitive is stored here — no codes, no claim data, no signatures.
 */

export interface AppState {
  /** The target being set up, before it is saved to the wallet's fund. */
  skinId: number | null;
  region: string | null;
}

const KEY = "skinfund.app";
const INITIAL: AppState = { skinId: null, region: null };

let state: AppState = INITIAL;
let loaded = false;
const listeners = new Set<() => void>();

function load() {
  if (loaded || typeof window === "undefined") return;
  loaded = true;
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const saved = JSON.parse(raw) as Partial<AppState>;
      state = { skinId: typeof saved.skinId === "number" ? saved.skinId : null, region: typeof saved.region === "string" ? saved.region : null };
    }
  } catch {
    // unreadable storage — start fresh
  }
}

export function setApp(patch: Partial<AppState>) {
  load();
  state = { ...state, ...patch };
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    // storage unavailable — the choice lasts for this page only
  }
  listeners.forEach((l) => l());
}

export function useApp(): AppState {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => {
      load();
      return state;
    },
    () => INITIAL,
  );
}

/** True once the browser has taken over from the server render. */
export function useHydrated(): boolean {
  return useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
}
