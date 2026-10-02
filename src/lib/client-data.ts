"use client";

import { useSyncExternalStore } from "react";
import type { CatalogueMeta, Skin } from "@/core/types";
import type { PotView, StatusView } from "./api-types";

/** A fetch-once resource readable with useSyncExternalStore (no effects, no state). */
function resource<T>(url: string) {
  type Snapshot = { data: T | null; error: boolean };
  let snapshot: Snapshot = { data: null, error: false };
  let started = false;
  const listeners = new Set<() => void>();
  const EMPTY: Snapshot = { data: null, error: false };

  function start() {
    if (started) return;
    started = true;
    fetch(url)
      .then((response) => (response.ok ? (response.json() as Promise<T>) : Promise.reject(new Error(String(response.status)))))
      .then((data) => (snapshot = { data, error: false }))
      .catch(() => (snapshot = { data: null, error: true }))
      .finally(() => listeners.forEach((l) => l()));
  }

  return function useResource(): Snapshot {
    return useSyncExternalStore(
      (listener) => {
        start();
        listeners.add(listener);
        return () => listeners.delete(listener);
      },
      () => snapshot,
      () => EMPTY,
    );
  };
}

export const useCatalogue = resource<{ meta: CatalogueMeta; skins: Skin[] }>("/api/catalogue");
export const useStatus = resource<StatusView>("/api/status");
export const usePot = resource<PotView>("/api/pot");
