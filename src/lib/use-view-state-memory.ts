"use client";

import { useEffect, useRef } from "react";

interface StoredViewState<T> {
  value: T;
  scrollY: number;
}

export function useViewStateMemory<T extends Record<string, unknown>>(
  key: string,
  value: T,
  onRestore: (value: Partial<T>) => void,
  ready: boolean,
) {
  const valueRef = useRef(value);
  const restoreRef = useRef(onRestore);
  const restoredRef = useRef(false);
  const scrollYRef = useRef(0);

  useEffect(() => {
    valueRef.current = value;
    restoreRef.current = onRestore;
  }, [onRestore, value]);

  useEffect(() => {
    try {
      const raw = window.sessionStorage.getItem(key);
      if (raw) {
        const stored = JSON.parse(raw) as Partial<StoredViewState<T>>;
        if (stored.value && typeof stored.value === "object") {
          restoreRef.current(stored.value);
        }
        if (typeof stored.scrollY === "number" && stored.scrollY > 0) {
          scrollYRef.current = stored.scrollY;
        }
      }
    } catch {
      window.sessionStorage.removeItem(key);
    }
    restoredRef.current = true;
  }, [key]);

  useEffect(() => {
    if (!ready || !restoredRef.current || scrollYRef.current <= 0) return;
    const timer = window.setTimeout(() => {
      window.scrollTo({ top: scrollYRef.current, behavior: "instant" });
      scrollYRef.current = 0;
    }, 120);
    return () => window.clearTimeout(timer);
  }, [ready]);

  useEffect(() => {
    if (!restoredRef.current) return;
    window.sessionStorage.setItem(
      key,
      JSON.stringify({ value, scrollY: window.scrollY } satisfies StoredViewState<T>),
    );
  }, [key, value]);

  useEffect(() => {
    const saveCurrentView = () => {
      window.sessionStorage.setItem(
        key,
        JSON.stringify({
          value: valueRef.current,
          scrollY: window.scrollY,
        } satisfies StoredViewState<T>),
      );
    };
    window.addEventListener("pagehide", saveCurrentView);
    return () => {
      saveCurrentView();
      window.removeEventListener("pagehide", saveCurrentView);
    };
  }, [key]);
}
