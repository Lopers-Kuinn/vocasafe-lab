"use client";

import { useSyncExternalStore } from "react";
import { Cloud, CloudOff, CloudUpload, Loader2, RefreshCw } from "lucide-react";
import {
  getFieldSyncSnapshot,
  getServerFieldSyncSnapshot,
  retryFieldOutbox,
  subscribeFieldSync,
} from "@/lib/field-sync";

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
  const sync = useSyncExternalStore(
    subscribeFieldSync,
    getFieldSyncSnapshot,
    getServerFieldSyncSnapshot,
  );

  const tone = !online
    ? "border-amber-300 bg-amber-50 text-amber-900"
    : sync.failed > 0
      ? "border-red-200 bg-red-50 text-red-800"
      : sync.pending > 0 || sync.syncing
        ? "border-sky-200 bg-sky-50 text-sky-800"
        : "border-emerald-200 bg-emerald-50 text-emerald-800";

  const label = !online
    ? sync.pending > 0
      ? `Offline · ${sync.pending} menunggu sinkronisasi`
      : "Offline · draft tersimpan di perangkat"
    : sync.syncing
      ? "Menyinkronkan data lapangan..."
      : sync.failed > 0
        ? `${sync.failed} data belum berhasil disinkronkan`
        : sync.pending > 0
          ? `${sync.pending} data menunggu sinkronisasi`
          : "Perangkat online";
  const compactLabel = !online
    ? sync.pending > 0
      ? `${sync.pending} antrean offline`
      : "Perangkat offline"
    : sync.syncing
      ? "Sinkronisasi..."
      : sync.failed > 0
        ? `${sync.failed} gagal`
        : sync.pending > 0
          ? `${sync.pending} antrean`
          : "Perangkat online";

  return (
    <div
      role="status"
      title={sync.lastError ?? undefined}
      className={`inline-flex items-center gap-2 rounded-full border font-semibold ${tone} ${compact ? "px-2.5 py-1 text-[10px]" : "px-3 py-2 text-xs"}`}
    >
      {!online ? (
        <CloudOff className="h-3.5 w-3.5 shrink-0" />
      ) : sync.syncing ? (
        <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin" />
      ) : sync.pending > 0 ? (
        <CloudUpload className="h-3.5 w-3.5 shrink-0" />
      ) : (
        <Cloud className="h-3.5 w-3.5 shrink-0" />
      )}
      <span className="whitespace-nowrap">{compact ? compactLabel : label}</span>
      {online && sync.pending > 0 && !sync.syncing && (
        <button
          type="button"
          onClick={() => void retryFieldOutbox()}
          className={`inline-flex items-center gap-1 rounded-full bg-white/80 font-bold ${compact ? "min-h-10 min-w-10 justify-center px-2" : "min-h-11 px-3"}`}
          aria-label="Coba sinkronkan data lapangan sekarang"
        >
          <RefreshCw className="h-3 w-3" />
          {!compact && "Coba lagi"}
        </button>
      )}
    </div>
  );
}
