"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, useCallback } from "react";
import {
  Shield,
  LayoutDashboard,
  QrCode,
  Package,
  FileWarning,
  ClipboardCheck,
  FileText,
  LogOut,
  Menu,
  X,
  ShieldAlert,
  Loader2,
} from "lucide-react";
import {
  clearCachedCurrentUser,
  getCurrentUserProfile,
  signOut,
  getRoleLabel,
} from "@/lib/auth";
import { canAccessRoute } from "@/lib/role-access";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import type { AppUser } from "@/types";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/scan", label: "Scan QR", icon: QrCode },
  { href: "/assets", label: "Aset", icon: Package },
  { href: "/reports", label: "Laporan", icon: FileWarning },
  { href: "/checklists", label: "Checklist", icon: ClipboardCheck },
  { href: "/audit", label: "Audit", icon: FileText },
];

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState("");
  const [logoutError, setLogoutError] = useState("");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [accessDenied, setAccessDenied] = useState(false);

  const loadProfile = useCallback(async () => {
    setLoading(true);
    const { user: profile, error } = await getCurrentUserProfile();

    if (!profile || error) {
      setUser(null);
      setAuthError(error ?? "Sesi Supabase tidak tersedia. Silakan login kembali.");
      setLoading(false);
      router.replace("/login");
      return;
    }

    setAuthError("");
    setUser(profile);

    if (!canAccessRoute(profile.role, pathname)) {
      setAccessDenied(true);
    } else {
      setAccessDenied(false);
    }

    setLoading(false);
  }, [pathname, router]);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  useEffect(() => {
    let refreshTimer: ReturnType<typeof setTimeout> | null = null;

    try {
      const supabase = createSupabaseBrowserClient();
      const {
        data: { subscription },
      } = supabase.auth.onAuthStateChange((event, session) => {
        if (event === "INITIAL_SESSION") return;

        if (event === "SIGNED_OUT" || !session) {
          clearCachedCurrentUser();
          setUser(null);
          setAccessDenied(false);
          setLoading(false);
          router.replace("/login");
          return;
        }

        if (refreshTimer) clearTimeout(refreshTimer);
        refreshTimer = setTimeout(() => {
          void loadProfile();
        }, 0);
      });

      return () => {
        if (refreshTimer) clearTimeout(refreshTimer);
        subscription.unsubscribe();
      };
    } catch (error) {
      setAuthError(
        error instanceof Error
          ? error.message
          : "Supabase belum dikonfigurasi. Periksa environment aplikasi.",
      );
    }
  }, [loadProfile, router]);

  async function handleLogout() {
    setLogoutError("");
    const { error } = await signOut();

    if (error) {
      setLogoutError(`Logout gagal: ${error}`);
      return;
    }

    router.replace("/login");
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
      </div>
    );
  }

  if (!user) {
    return authError ? (
      <div className="flex min-h-screen items-center justify-center p-6">
        <div className="max-w-lg rounded-lg border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900">
          <p className="font-semibold">Autentikasi belum siap.</p>
          <p className="mt-1">{authError}</p>
        </div>
      </div>
    ) : null;
  }

  // Filter nav items based on user role
  const visibleNavItems = navItems.filter(({ href }) =>
    canAccessRoute(user.role, href)
  );
  const logoutErrorAlert = logoutError ? (
    <div
      role="alert"
      className="border-b border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700"
    >
      {logoutError}
    </div>
  ) : null;

  // Show access denied page
  if (accessDenied) {
    return (
      <div className="flex min-h-screen flex-col">
        <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-slate-200 bg-white px-4 shadow-sm">
          <div className="flex items-center gap-2">
            <img
              src="/logo.png"
              alt="VocaSafe Lab Logo"
              className="h-7 w-auto object-contain"
            />
            <span className="font-bold text-slate-900 hidden sm:inline">VocaSafe Lab</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm text-slate-600">
              {user.fullName} ({getRoleLabel(user.role)})
            </span>
            <button
              onClick={handleLogout}
              className="flex items-center gap-1 text-sm text-slate-500 hover:text-red-600 transition-colors"
            >
              <LogOut className="h-4 w-4" />
              <span className="hidden sm:inline">Keluar</span>
            </button>
          </div>
        </header>
        {logoutErrorAlert}
        <div className="flex flex-1 items-center justify-center p-6">
          <div className="text-center space-y-4">
            <ShieldAlert className="mx-auto h-12 w-12 text-red-400" />
            <h1 className="text-xl font-bold text-slate-900">Akses Tidak Diizinkan</h1>
            <p className="text-sm text-slate-500 max-w-sm">
              Role <strong>{getRoleLabel(user.role)}</strong> tidak memiliki akses ke halaman ini.
            </p>
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-1 rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 transition-colors"
            >
              Kembali ke Dashboard
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col">
      {/* Top bar */}
      <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-slate-200 bg-white px-4 shadow-sm">
        <div className="flex items-center gap-2">
          <button
            className="lg:hidden p-1"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          >
            {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
          <img
            src="/logo.png"
            alt="VocaSafe Lab Logo"
            className="h-7 w-auto object-contain"
          />
          <span className="font-bold text-slate-900 hidden sm:inline">VocaSafe Lab</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm text-slate-600">
            {user.fullName} ({getRoleLabel(user.role)})
          </span>
          <button
            onClick={handleLogout}
            className="flex items-center gap-1 text-sm text-slate-500 hover:text-red-600 transition-colors"
          >
            <LogOut className="h-4 w-4" />
            <span className="hidden sm:inline">Keluar</span>
          </button>
        </div>
      </header>
      {logoutErrorAlert}

      <div className="flex flex-1">
        {/* Sidebar desktop */}
        <aside className="hidden lg:flex w-56 flex-col border-r border-slate-200 bg-white py-4">
          <nav className="flex flex-col gap-1 px-2">
            {visibleNavItems.map(({ href, label, icon: Icon }) => {
              const active = pathname === href || pathname.startsWith(href + "/");
              return (
                <Link
                  key={href}
                  href={href}
                  className={`flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                    active
                      ? "bg-emerald-50 text-emerald-700"
                      : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {label}
                </Link>
              );
            })}
          </nav>
        </aside>

        {/* Mobile menu */}
        {mobileMenuOpen && (
          <div className="fixed inset-0 z-20 lg:hidden">
            <div
              className="absolute inset-0 bg-black/20"
              onClick={() => setMobileMenuOpen(false)}
            />
            <aside className="relative w-56 bg-white h-full shadow-lg py-4">
              <nav className="flex flex-col gap-1 px-2">
                {visibleNavItems.map(({ href, label, icon: Icon }) => {
                  const active = pathname === href || pathname.startsWith(href + "/");
                  return (
                    <Link
                      key={href}
                      href={href}
                      onClick={() => setMobileMenuOpen(false)}
                      className={`flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                        active
                          ? "bg-emerald-50 text-emerald-700"
                          : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                      }`}
                    >
                      <Icon className="h-4 w-4" />
                      {label}
                    </Link>
                  );
                })}
              </nav>
            </aside>
          </div>
        )}

        {/* Main content */}
        <main className="flex-1 overflow-auto p-4 md:p-6">{children}</main>
      </div>
    </div>
  );
}
