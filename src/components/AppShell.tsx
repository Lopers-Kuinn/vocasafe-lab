"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ClipboardCheck,
  Clock3,
  FileText,
  FileWarning,
  LayoutDashboard,
  Loader2,
  LogOut,
  Menu,
  Package,
  QrCode,
  Settings2,
  ShieldAlert,
  Sparkles,
  X,
} from "lucide-react";
import ConnectionStatus from "@/components/mobile/ConnectionStatus";
import FieldSyncManager from "@/components/mobile/FieldSyncManager";
import NotificationCenter from "@/components/mobile/NotificationCenter";
import {
  clearCachedCurrentUser,
  getCurrentUser,
  getCurrentUserProfile,
  getRoleLabel,
  signOut,
} from "@/lib/auth";
import ScrollAmbientBackground from "@/components/layout/ScrollAmbientBackground";
import { canAccessRoute } from "@/lib/role-access";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import {
  clearSessionActivity,
  getLastSessionActivity,
  isSessionActivityStorageKey,
  markSessionActivity,
  SESSION_IDLE_LIMIT_MS,
  SESSION_IDLE_WARNING_MS,
} from "@/lib/session-activity";
import { useDialogFocus } from "@/lib/use-dialog-focus";
import type { AppUser } from "@/types";

const navItems = [
  { href: "/dashboard", label: "Dashboard", mobileLabel: "Beranda", icon: LayoutDashboard },
  { href: "/scan", label: "Scan QR", mobileLabel: "Scan", icon: QrCode },
  { href: "/assets", label: "Aset", mobileLabel: "Aset", icon: Package },
  { href: "/reports", label: "Laporan", mobileLabel: "Laporan", icon: FileWarning },
  { href: "/checklists", label: "Checklist", mobileLabel: "Checklist", icon: ClipboardCheck },
  { href: "/audit", label: "Audit", mobileLabel: "Audit", icon: FileText },
  { href: "/admin", label: "Administrasi", mobileLabel: "Admin", icon: Settings2 },
];

const mobilePrimaryHrefs = ["/dashboard", "/assets", "/scan", "/reports"] as const;

function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <Link href="/dashboard" className="flex min-w-0 items-center gap-2.5 overflow-hidden sm:gap-3">
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl border border-emerald-100 bg-white shadow-[0_10px_24px_rgba(8,119,90,0.13)]">
        <Image
          src="/logo.png"
          alt=""
          width={32}
          height={32}
          className="h-8 w-8 object-contain"
          priority
        />
      </span>
      {!compact && (
        <span className="hidden min-w-0 min-[350px]:block">
          <span className="block truncate text-[15px] font-bold tracking-[-0.02em] text-[#102c23]">
            VocaSafe Lab
          </span>
          <span className="block truncate text-[10px] font-semibold uppercase tracking-[0.18em] text-emerald-700/60">
            Keselamatan Terpadu
          </span>
        </span>
      )}
    </Link>
  );
}

function userInitials(fullName: string) {
  return fullName
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState<AppUser | null>(() => getCurrentUser());
  const hadCachedProfile = useRef(user !== null);
  const [loading, setLoading] = useState(user === null);
  const [authError, setAuthError] = useState("");
  const [logoutError, setLogoutError] = useState("");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [inactivitySeconds, setInactivitySeconds] = useState(0);
  const inactivityLogoutStarted = useRef(false);
  const logoutReason = useRef<"inactive" | null>(null);
  const lastActivityWrite = useRef(0);
  const mobileMenuDialogRef = useRef<HTMLDivElement>(null);
  const mobileMenuCloseRef = useRef<HTMLButtonElement>(null);
  const closeMobileMenu = useCallback(() => setMobileMenuOpen(false), []);
  useDialogFocus({
    open: mobileMenuOpen,
    dialogRef: mobileMenuDialogRef,
    initialFocusRef: mobileMenuCloseRef,
    onClose: closeMobileMenu,
  });

  useEffect(() => {
    if (!mobileMenuOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [mobileMenuOpen]);

  const handleInactivityLogout = useCallback(async () => {
    if (inactivityLogoutStarted.current) return;

    inactivityLogoutStarted.current = true;
    logoutReason.current = "inactive";
    const { error } = await signOut();

    if (error) {
      inactivityLogoutStarted.current = false;
      logoutReason.current = null;
      setLogoutError(`Logout otomatis gagal: ${error}`);
      return;
    }

    clearSessionActivity();
    setInactivitySeconds(0);
    router.replace("/login?reason=inactive");
  }, [router]);

  const loadProfile = useCallback(async (
    forceRefresh = false,
    background = false,
  ) => {
    if (!background) setLoading(true);
    const { user: profile, error } = await getCurrentUserProfile({ forceRefresh });

    if (!profile || error) {
      if (background) return;
      setUser(null);
      setAuthError(error ?? "Sesi Anda telah berakhir. Silakan masuk kembali.");
      setLoading(false);
      router.replace("/login");
      return;
    }

    setAuthError("");
    setUser(profile);
    setLoading(false);
  }, [router]);

  useEffect(() => {
    const hasCachedProfile = hadCachedProfile.current;
    const timer = setTimeout(
      () => void loadProfile(hasCachedProfile, hasCachedProfile),
      0,
    );
    return () => clearTimeout(timer);
  }, [loadProfile]);

  useEffect(() => {
    let refreshTimer: ReturnType<typeof setTimeout> | null = null;

    try {
      const supabase = createSupabaseBrowserClient();
      const {
        data: { subscription },
      } = supabase.auth.onAuthStateChange((event, session) => {
        if (event === "INITIAL_SESSION" || event === "TOKEN_REFRESHED") return;

        if (event === "SIGNED_OUT" || !session) {
          clearCachedCurrentUser();
          clearSessionActivity();
          setUser(null);
          setLoading(false);
          router.replace(logoutReason.current === "inactive" ? "/login?reason=inactive" : "/login");
          return;
        }

        if (refreshTimer) clearTimeout(refreshTimer);
        refreshTimer = setTimeout(() => {
          void loadProfile(true, true);
        }, 0);
      });

      return () => {
        if (refreshTimer) clearTimeout(refreshTimer);
        subscription.unsubscribe();
      };
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Layanan sedang tidak tersedia. Silakan coba kembali.";
      queueMicrotask(() => setAuthError(message));
    }
  }, [loadProfile, router]);

  useEffect(() => {
    if (!user) return;

    const initialActivity = getLastSessionActivity();
    if (initialActivity === null) {
      const now = Date.now();
      markSessionActivity(now);
      lastActivityWrite.current = now;
    }

    function updateWarning(now = Date.now()) {
      const lastActivity = getLastSessionActivity();
      if (lastActivity === null) {
        markSessionActivity(now);
        lastActivityWrite.current = now;
        return;
      }

      const elapsed = now - lastActivity;
      if (elapsed >= SESSION_IDLE_LIMIT_MS) {
        void handleInactivityLogout();
        return;
      }

      const remaining = SESSION_IDLE_LIMIT_MS - elapsed;
      const nextSeconds =
        remaining <= SESSION_IDLE_WARNING_MS ? Math.max(1, Math.ceil(remaining / 1000)) : 0;
      setInactivitySeconds((current) => (current === nextSeconds ? current : nextSeconds));
    }

    function recordActivity() {
      const now = Date.now();
      if (now - lastActivityWrite.current < 15_000) return;
      lastActivityWrite.current = now;
      markSessionActivity(now);
      setInactivitySeconds((current) => (current === 0 ? current : 0));
    }

    function handleVisibilityChange() {
      if (document.visibilityState === "visible") updateWarning();
    }

    function handleWindowFocus() {
      updateWarning();
    }

    function handleStorage(event: StorageEvent) {
      if (isSessionActivityStorageKey(event.key)) updateWarning();
    }

    const interval = window.setInterval(updateWarning, 1000);
    window.addEventListener("pointerdown", recordActivity, { passive: true });
    window.addEventListener("keydown", recordActivity);
    window.addEventListener("touchstart", recordActivity, { passive: true });
    window.addEventListener("scroll", recordActivity, { passive: true });
    window.addEventListener("focus", handleWindowFocus);
    window.addEventListener("storage", handleStorage);
    document.addEventListener("visibilitychange", handleVisibilityChange);
    updateWarning();

    return () => {
      window.clearInterval(interval);
      window.removeEventListener("pointerdown", recordActivity);
      window.removeEventListener("keydown", recordActivity);
      window.removeEventListener("touchstart", recordActivity);
      window.removeEventListener("scroll", recordActivity);
      window.removeEventListener("focus", handleWindowFocus);
      window.removeEventListener("storage", handleStorage);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [handleInactivityLogout, user]);

  async function handleLogout() {
    setLogoutError("");
    logoutReason.current = null;
    const { error } = await signOut();

    if (error) {
      setLogoutError(`Logout gagal: ${error}`);
      return;
    }

    clearSessionActivity();
    router.replace("/login");
  }

  function handleContinueSession() {
    const now = Date.now();
    markSessionActivity(now);
    lastActivityWrite.current = now;
    setInactivitySeconds(0);
  }

  const accessDenied = user ? !canAccessRoute(user.role, pathname) : false;

  if (loading) {
    return (
      <div className="relative flex min-h-screen items-center justify-center overflow-hidden">
        <ScrollAmbientBackground />
        <div className="premium-surface relative flex items-center gap-3 rounded-3xl px-6 py-4 text-sm font-medium text-emerald-950">
          <Loader2 className="h-5 w-5 animate-spin text-emerald-600" />
          Menyiapkan ruang kerja aman...
        </div>
      </div>
    );
  }

  if (!user) {
    return authError ? (
      <div className="flex min-h-screen items-center justify-center p-6">
        <div className="premium-surface max-w-lg rounded-[28px] border border-amber-200/70 p-6 text-sm text-amber-950">
          <p className="font-semibold">Autentikasi belum siap.</p>
          <p className="mt-1 text-amber-800">{authError}</p>
        </div>
      </div>
    ) : null;
  }

  const visibleNavItems = navItems.filter(({ href }) => canAccessRoute(user.role, href));
  const mobilePrimaryRouteHrefs: readonly string[] =
    user.role === "kepala_lab"
      ? ["/dashboard", "/assets", "/reports", "/audit"]
      : mobilePrimaryHrefs;
  const mobilePrimaryItems = mobilePrimaryRouteHrefs
    .map((href) => visibleNavItems.find((item) => item.href === href))
    .filter((item): item is (typeof navItems)[number] => Boolean(item));
  const mobileMoreItems = visibleNavItems.filter(
    ({ href }) => !mobilePrimaryRouteHrefs.includes(href),
  );
  const mobileMoreActive = mobileMoreItems.some(
    ({ href }) => pathname === href || pathname.startsWith(`${href}/`),
  );
  const logoutErrorAlert = logoutError ? (
    <div
      role="alert"
      className="border-b border-red-200 bg-red-50 px-4 py-2 text-center text-sm text-red-700"
    >
      {logoutError}
    </div>
  ) : null;

  if (accessDenied) {
    return (
      <div className="relative flex min-h-screen flex-col overflow-hidden">
        <ScrollAmbientBackground />
        <header className="premium-surface relative z-10 mx-3 mt-3 flex h-16 items-center justify-between rounded-2xl px-4 sm:mx-5 sm:px-6">
          <Brand />
          <button
            type="button"
            onClick={handleLogout}
            className="rounded-xl px-3 py-2 text-sm font-semibold text-slate-500 transition hover:bg-red-50 hover:text-red-600"
          >
            Keluar
          </button>
        </header>
        {logoutErrorAlert}
        <main className="relative z-10 flex flex-1 items-center justify-center p-6">
          <div className="premium-surface max-w-md rounded-[32px] p-8 text-center">
            <span className="mx-auto grid h-16 w-16 place-items-center rounded-3xl bg-red-50 text-red-500 shadow-inner">
              <ShieldAlert className="h-8 w-8" />
            </span>
            <h1 className="mt-5 text-2xl font-bold tracking-[-0.03em] text-slate-950">
              Akses tidak diizinkan
            </h1>
            <p className="mt-2 text-sm leading-6 text-slate-500">
              Role <strong>{getRoleLabel(user.role)}</strong> tidak memiliki akses ke halaman ini.
            </p>
            <Link
              href="/dashboard"
              className="mt-6 inline-flex rounded-2xl bg-[#08775a] px-5 py-3 text-sm font-semibold text-white shadow-[0_12px_28px_rgba(8,119,90,0.24)] transition hover:-translate-y-0.5 hover:bg-[#06664d]"
            >
              Kembali ke Dashboard
            </Link>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="relative min-h-dvh w-full max-w-full overflow-x-clip">
      <a
        href="#main-content"
        className="fixed left-3 top-3 z-[200] -translate-y-24 rounded-xl bg-slate-950 px-4 py-3 text-sm font-bold text-white shadow-xl transition focus:translate-y-0"
      >
        Lewati ke konten utama
      </a>
      <ScrollAmbientBackground />
      <FieldSyncManager />

      <header className="sticky top-0 z-40 border-b border-emerald-950/[0.06] bg-[#f8fbf8]/80 backdrop-blur-xl">
        <div className="mx-auto flex h-[72px] w-full max-w-[1600px] items-center justify-between gap-2 px-3 sm:px-6">
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <Brand />
          </div>

          <div className="flex shrink-0 items-center gap-2 sm:gap-3">
            <div className="hidden items-center gap-2 rounded-2xl border border-emerald-950/[0.08] bg-white/75 py-1.5 pl-2 pr-3 shadow-sm sm:flex">
              <span className="grid h-8 w-8 place-items-center rounded-xl bg-gradient-to-br from-emerald-500 to-teal-700 text-xs font-bold text-white">
                {userInitials(user.fullName)}
              </span>
              <span className="max-w-44 leading-tight">
                <span className="block truncate text-xs font-semibold text-slate-800">{user.fullName}</span>
                <span className="block truncate text-[10px] text-slate-500">{getRoleLabel(user.role)}</span>
              </span>
            </div>
            <div className="hidden md:block"><ConnectionStatus compact /></div>
            <NotificationCenter />
            <button
              type="button"
              onClick={handleLogout}
              aria-label="Keluar dari aplikasi"
              className="grid h-12 w-12 place-items-center rounded-2xl border border-emerald-950/[0.08] bg-white/75 text-slate-500 shadow-sm transition hover:-translate-y-0.5 hover:border-red-200 hover:text-red-600"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </header>
      {logoutErrorAlert}

      <div className="relative z-10 mx-auto flex w-full max-w-[1600px] items-start">
        <aside className="sticky top-[88px] hidden h-[calc(100vh-104px)] w-[260px] shrink-0 flex-col px-4 pb-4 lg:flex">
          <div className="premium-surface flex h-full flex-col rounded-[28px] p-3">
            <div className="mb-3 rounded-2xl bg-gradient-to-br from-[#0a5f49] to-[#0b8f6b] p-4 text-white shadow-[0_18px_36px_rgba(8,119,90,0.22)]">
              <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-emerald-100">
                <Sparkles className="h-3.5 w-3.5" />
                Ruang kerja aktif
              </div>
              <p className="mt-2 text-sm font-semibold">Keselamatan dimulai dari data yang jelas.</p>
            </div>

            <nav className="flex flex-col gap-1.5">
              {visibleNavItems.map(({ href, label, icon: Icon }) => {
                const active = pathname === href || pathname.startsWith(`${href}/`);
                return (
                  <Link
                    key={href}
                    href={href}
                    className={`group flex items-center gap-3 rounded-2xl px-3 py-2.5 text-sm font-semibold transition-all ${
                      active
                        ? "bg-[#102c23] text-white shadow-[0_12px_24px_rgba(16,44,35,0.16)]"
                        : "text-slate-600 hover:bg-emerald-50/80 hover:text-emerald-900"
                    }`}
                  >
                    <span
                      className={`grid h-8 w-8 place-items-center rounded-xl transition ${
                        active
                          ? "bg-white/12 text-emerald-200"
                          : "bg-slate-100 text-slate-500 group-hover:bg-white group-hover:text-emerald-700"
                      }`}
                    >
                      <Icon className="h-4 w-4" />
                    </span>
                    {label}
                  </Link>
                );
              })}
            </nav>

          </div>
        </aside>

        <main id="main-content" tabIndex={-1} className="min-w-0 max-w-full flex-1 overflow-x-clip px-4 py-5 pb-[calc(7rem+env(safe-area-inset-bottom))] sm:px-6 sm:py-7 lg:px-6 lg:pb-10 xl:px-8">
          <div key={pathname} className="page-enter min-w-0 max-w-full">
            {children}
          </div>
        </main>
      </div>

      {inactivitySeconds > 0 && (
        <div
          role="alert"
          className="premium-surface fixed inset-x-3 bottom-[calc(7rem+env(safe-area-inset-bottom))] z-[70] flex min-w-0 flex-col gap-3 rounded-2xl border border-amber-200/80 p-4 text-amber-950 shadow-2xl min-[430px]:left-auto min-[430px]:right-4 min-[430px]:max-w-sm lg:bottom-4"
        >
          <div className="flex min-w-0 items-start gap-3">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-amber-100 text-amber-700">
              <Clock3 className="h-4 w-4" />
            </span>
            <div className="min-w-0">
              <p className="text-sm font-semibold">Sesi akan segera berakhir</p>
              <p className="mt-1 text-xs leading-5 text-amber-800">
                Tidak ada aktivitas. Logout otomatis dalam {inactivitySeconds} detik.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleContinueSession}
            className="min-h-12 w-full rounded-xl bg-amber-900 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-950"
          >
            Tetap masuk
          </button>
        </div>
      )}

      {mobileMenuOpen && (
        <div ref={mobileMenuDialogRef} tabIndex={-1} className="fixed inset-0 z-[80] lg:hidden" role="dialog" aria-modal="true" aria-label="Menu lainnya">
          <button
            type="button"
            tabIndex={-1}
            aria-label="Tutup menu lainnya"
            onClick={() => setMobileMenuOpen(false)}
            className="absolute inset-0 bg-slate-950/45 backdrop-blur-[2px]"
          />
          <section className="premium-surface absolute inset-x-2 bottom-2 max-h-[min(76dvh,640px)] overflow-y-auto rounded-[30px] p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] shadow-2xl">
            <div className="flex items-center justify-between gap-3 px-1 pb-3">
              <div className="flex min-w-0 items-center gap-3">
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-700 text-sm font-bold text-white">
                  {userInitials(user.fullName)}
                </span>
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold text-slate-950">{user.fullName}</p>
                  <p className="truncate text-xs text-slate-500">{getRoleLabel(user.role)}</p>
                </div>
              </div>
              <button
                ref={mobileMenuCloseRef}
                type="button"
                onClick={() => setMobileMenuOpen(false)}
                aria-label="Tutup menu"
                className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl border border-slate-200 bg-white text-slate-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="mb-3 px-1">
              <ConnectionStatus />
            </div>

            <div className="grid gap-2 min-[390px]:grid-cols-2">
              {mobileMoreItems.map(({ href, label, icon: Icon }) => {
                const active = pathname === href || pathname.startsWith(`${href}/`);
                return (
                  <Link
                    key={href}
                    href={href}
                    onClick={() => setMobileMenuOpen(false)}
                    className={`flex min-h-14 items-center gap-3 rounded-2xl border px-4 py-3 text-sm font-semibold transition active:scale-[0.98] ${
                      active
                        ? "border-emerald-900 bg-[#102c23] text-white"
                        : "border-slate-200 bg-white text-slate-700"
                    }`}
                  >
                    <Icon className="h-5 w-5 shrink-0" />
                    {label}
                  </Link>
                );
              })}
            </div>

            <button
              type="button"
              onClick={() => {
                setMobileMenuOpen(false);
                void handleLogout();
              }}
              className="mt-3 flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl border border-red-200 bg-red-50 px-4 text-sm font-bold text-red-700 active:scale-[0.99]"
            >
              <LogOut className="h-4 w-4" />
              Keluar dari aplikasi
            </button>
          </section>
        </div>
      )}

      <nav
        aria-label="Navigasi utama mobile"
        className="premium-surface fixed inset-x-2 bottom-2 z-40 grid min-w-0 grid-cols-5 gap-1 rounded-[24px] px-2 pt-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))] shadow-[0_18px_50px_rgba(16,44,35,0.2)] lg:hidden"
      >
        {mobilePrimaryItems.map(({ href, mobileLabel, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(`${href}/`);
          const isScan = href === "/scan";
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? "page" : undefined}
              className={`relative flex min-h-12 min-w-0 flex-col items-center justify-center gap-1 rounded-2xl px-1 py-2 text-center text-[10px] font-semibold leading-tight transition active:scale-95 ${
                active
                  ? "bg-[#102c23] text-white shadow-[0_8px_20px_rgba(16,44,35,0.18)]"
                  : "text-slate-500 hover:bg-emerald-50 hover:text-emerald-800"
              } ${isScan ? "-mt-5 min-h-16 border-4 border-[#f8fbf8] bg-emerald-700 text-white shadow-[0_12px_28px_rgba(8,119,90,0.3)]" : ""}`}
            >
              <Icon className={`${isScan ? "h-6 w-6" : "h-5 w-5"} shrink-0`} />
              <span className="max-w-full leading-none">{mobileLabel}</span>
            </Link>
          );
        })}
        <button
          type="button"
          onClick={() => setMobileMenuOpen(true)}
          aria-expanded={mobileMenuOpen}
          className={`flex min-h-12 min-w-0 flex-col items-center justify-center gap-1 rounded-2xl px-1 py-2 text-center text-[10px] font-semibold leading-tight transition active:scale-95 ${
            mobileMoreActive
              ? "bg-[#102c23] text-white shadow-[0_8px_20px_rgba(16,44,35,0.18)]"
              : "text-slate-500 hover:bg-emerald-50 hover:text-emerald-800"
          }`}
        >
          <Menu className="h-5 w-5" />
          <span className="leading-none">Lainnya</span>
        </button>
      </nav>
    </div>
  );
}
