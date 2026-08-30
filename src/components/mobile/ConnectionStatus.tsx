"use client";

import { useSyncExternalStore } from "react";
import { Cloud, CloudOff } from "lucide-react";

function subscribeToConnection(onStoreChange: () => void) {
  window.addEventListener("online", onStoreChange);
  window.addEventListener("offline", onStoreChange);
  return () => {
    window.removeEventListener("online", onStoreChange);
    window.removeEventListener("offline", onStoreChange);
  };
}

const getConnectionSnapshot = () => navigator.onLine;
const getServerConnectionSnapshot = () => true;

export default function ConnectionStatus({ compact = false }: { compact?: boolean }) {
  const online = useSyncExternalStore(
    subscribeToConnection,
    getConnectionSnapshot,
    getServerConnectionSnapshot,
  );

  return (
    <span
      role="status"
      className={`inline-flex items-center gap-2 rounded-full border font-semibold ${
        online
          ? "border-emerald-200 bg-emerald-50 text-emerald-800"
          : "border-amber-300 bg-amber-50 text-amber-900"
      } ${compact ? "px-2.5 py-1 text-[10px]" : "px-3 py-2 text-xs"}`}
    >
      {online ? <Cloud className="h-3.5 w-3.5" /> : <CloudOff className="h-3.5 w-3.5" />}
      {online ? "Online" : "Offline · draft tetap tersimpan"}
    </span>
  );
}
