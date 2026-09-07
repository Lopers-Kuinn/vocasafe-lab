"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, Bell, CheckCheck, Clock3, Loader2, X } from "lucide-react";
import {
  fetchOperationalNotifications,
  markOperationalNotificationsRead,
  type OperationalNotification,
} from "@/lib/notifications";
import { useDialogFocus } from "@/lib/use-dialog-focus";

const priorityTone = {
  normal: "border-slate-200 bg-white text-slate-700",
  high: "border-amber-200 bg-amber-50 text-amber-900",
  critical: "border-red-200 bg-red-50 text-red-900",
} as const;

function relativeTime(value: string): string {
  const seconds = Math.round((new Date(value).getTime() - Date.now()) / 1000);
  const formatter = new Intl.RelativeTimeFormat("id-ID", { numeric: "auto" });
  if (Math.abs(seconds) < 60) return formatter.format(seconds, "second");
  const minutes = Math.round(seconds / 60);
  if (Math.abs(minutes) < 60) return formatter.format(minutes, "minute");
  const hours = Math.round(minutes / 60);
  if (Math.abs(hours) < 24) return formatter.format(hours, "hour");
  return formatter.format(Math.round(hours / 24), "day");
}

function dueLabel(notification: OperationalNotification): string | null {
  if (!notification.dueAt) return null;
  const due = new Date(notification.dueAt).getTime();
  if (!Number.isFinite(due)) return null;
  return due < Date.now()
    ? `Terlambat ${relativeTime(notification.dueAt).replace("lalu", "").trim()}`
    : `Tenggat ${relativeTime(notification.dueAt)}`;
}

export default function NotificationCenter() {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<OperationalNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [unavailable, setUnavailable] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const mountedRef = useRef(true);
  const requestInFlightRef = useRef(false);

  const load = useCallback(async (quiet = false) => {
    if (requestInFlightRef.current) return;
    requestInFlightRef.current = true;
    if (!quiet) setLoading(true);
    try {
      const result = await fetchOperationalNotifications();
      if (!mountedRef.current) return;
      setNotifications(result.notifications);
      setUnavailable(result.unavailable);
      setError(result.error ?? "");
      setLoading(false);
    } finally {
      requestInFlightRef.current = false;
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    const loadWhenVisible = () => {
      if (document.visibilityState === "visible" && navigator.onLine) {
        void load(true);
      }
    };
    const timer = window.setTimeout(loadWhenVisible, 0);
    const interval = window.setInterval(loadWhenVisible, 60_000);
    document.addEventListener("visibilitychange", loadWhenVisible);
    return () => {
      mountedRef.current = false;
      window.clearTimeout(timer);
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", loadWhenVisible);
    };
  }, [load]);

  const closeDialog = useCallback(() => setOpen(false), []);
  useDialogFocus({ open, dialogRef, initialFocusRef: closeRef, onClose: closeDialog });

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  const unreadCount = useMemo(
    () => notifications.filter((notification) => !notification.readAt).length,
    [notifications],
  );

  async function markAllRead() {
    const result = await markOperationalNotificationsRead();
    if (result.error) {
      setError(result.error);
      return;
    }
    const readAt = new Date().toISOString();
    setNotifications((current) =>
      current.map((notification) => ({ ...notification, readAt: notification.readAt ?? readAt })),
    );
  }

  async function markOneRead(id: string) {
    setNotifications((current) =>
      current.map((notification) =>
        notification.id === id
          ? { ...notification, readAt: notification.readAt ?? new Date().toISOString() }
          : notification,
      ),
    );
    await markOperationalNotificationsRead(id);
  }

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => {
          setOpen(true);
          void load(true);
        }}
        aria-label={unreadCount > 0 ? `Buka notifikasi, ${unreadCount} belum dibaca` : "Buka notifikasi"}
        className="relative grid h-12 w-12 place-items-center rounded-2xl border border-emerald-950/[0.08] bg-white/75 text-slate-600 shadow-sm transition hover:-translate-y-0.5 hover:text-emerald-700"
      >
        <Bell className="h-4.5 w-4.5" />
        {unreadCount > 0 && (
          <span className="absolute -right-1 -top-1 grid min-h-5 min-w-5 place-items-center rounded-full bg-red-600 px-1 text-[10px] font-black text-white ring-2 ring-[#f8fbf8]">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div ref={dialogRef} tabIndex={-1} className="fixed inset-0 z-[110]" role="dialog" aria-modal="true" aria-labelledby="notification-title">
          <button
            type="button"
            tabIndex={-1}
            aria-label="Tutup pusat notifikasi"
            onClick={() => setOpen(false)}
            className="absolute inset-0 bg-slate-950/45 backdrop-blur-[2px]"
          />
          <section className="absolute inset-x-2 bottom-2 flex max-h-[min(82dvh,720px)] flex-col overflow-hidden rounded-[28px] bg-[#f8fbf8] shadow-2xl sm:inset-x-auto sm:bottom-auto sm:right-4 sm:top-20 sm:w-[min(430px,calc(100vw-2rem))]">
            <header className="flex items-center justify-between gap-3 border-b border-slate-200 bg-white px-4 py-4">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.16em] text-emerald-700">Respons operasional</p>
                <h2 id="notification-title" className="mt-1 text-lg font-black text-slate-950">Notifikasi</h2>
              </div>
              <button
                ref={closeRef}
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Tutup notifikasi"
                className="grid h-12 w-12 place-items-center rounded-2xl border border-slate-200 bg-white text-slate-600"
              >
                <X className="h-5 w-5" />
              </button>
            </header>

            <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-4 py-3">
              <p className="text-xs font-semibold text-slate-500">{unreadCount} belum dibaca</p>
              {unreadCount > 0 && !unavailable && (
                <button type="button" onClick={() => void markAllRead()} className="inline-flex min-h-12 items-center gap-2 rounded-xl px-3 text-xs font-bold text-emerald-700 hover:bg-emerald-50">
                  <CheckCheck className="h-4 w-4" /> Tandai semua
                </button>
              )}
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto p-3 pb-[calc(1rem+env(safe-area-inset-bottom))]">
              {loading ? (
                <div className="flex min-h-40 items-center justify-center text-sm text-slate-500"><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Memuat notifikasi...</div>
              ) : unavailable ? (
                <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-5 text-center text-sm text-slate-600">Pusat notifikasi siap digunakan setelah migration Operational Response diterapkan.</div>
              ) : error ? (
                <div role="alert" className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700"><AlertTriangle className="mb-2 h-5 w-5" />{error}</div>
              ) : notifications.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-6 text-center"><Bell className="mx-auto h-8 w-8 text-slate-300" /><p className="mt-2 text-sm text-slate-500">Belum ada notifikasi operasional.</p></div>
              ) : (
                <ol className="space-y-2">
                  {notifications.map((notification) => {
                    const due = dueLabel(notification);
                    return (
                      <li key={notification.id}>
                        <Link
                          href={notification.href}
                          onClick={() => {
                            void markOneRead(notification.id);
                            setOpen(false);
                          }}
                          className={`block rounded-2xl border p-4 transition hover:-translate-y-0.5 hover:shadow-sm ${priorityTone[notification.priority]} ${notification.readAt ? "opacity-70" : "ring-1 ring-current/10"}`}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <p className="min-w-0 break-words text-sm font-black">{notification.title}</p>
                            {!notification.readAt && <span className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full bg-current" aria-label="Belum dibaca" />}
                          </div>
                          <p className="mt-1 break-words text-xs leading-5 opacity-80">{notification.body}</p>
                          <div className="mt-3 flex flex-wrap items-center gap-2 text-[10px] font-bold uppercase tracking-wide opacity-70">
                            <span>{relativeTime(notification.createdAt)}</span>
                            {due && <span className="inline-flex items-center gap-1"><Clock3 className="h-3 w-3" /> {due}</span>}
                          </div>
                        </Link>
                      </li>
                    );
                  })}
                </ol>
              )}
            </div>
          </section>
        </div>
      )}
    </>
  );
}
