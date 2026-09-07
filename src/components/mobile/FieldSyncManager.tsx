"use client";

import { useEffect } from "react";
import { processFieldOutbox, refreshFieldSyncSnapshot } from "@/lib/field-sync";

export default function FieldSyncManager() {
  useEffect(() => {
    let cancelled = false;
    let idleCallbackId: number | null = null;
    let fallbackTimerId: number | null = null;

    const processWhenAvailable = (force = false) => {
      if (
        cancelled ||
        document.visibilityState !== "visible" ||
        !navigator.onLine
      ) {
        return;
      }
      void processFieldOutbox(force);
    };

    const initialize = () => {
      if (cancelled) return;
      void refreshFieldSyncSnapshot().then(() => processWhenAvailable());
    };

    if (typeof window.requestIdleCallback === "function") {
      idleCallbackId = window.requestIdleCallback(initialize, { timeout: 2_000 });
    } else {
      fallbackTimerId = window.setTimeout(initialize, 1_200);
    }

    const handleOnline = () => processWhenAvailable(true);
    const handleVisibilityChange = () => processWhenAvailable();
    window.addEventListener("online", handleOnline);
    document.addEventListener("visibilitychange", handleVisibilityChange);
    const interval = window.setInterval(() => processWhenAvailable(), 60_000);

    return () => {
      cancelled = true;
      if (idleCallbackId !== null) window.cancelIdleCallback(idleCallbackId);
      if (fallbackTimerId !== null) window.clearTimeout(fallbackTimerId);
      window.removeEventListener("online", handleOnline);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.clearInterval(interval);
    };
  }, []);

  return null;
}
