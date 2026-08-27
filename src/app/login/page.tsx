"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  BookOpenCheck,
  Building2,
  CheckCircle2,
  Eye,
  EyeOff,
  GraduationCap,
  Loader2,
  ShieldCheck,
  Sparkles,
  Wrench,
} from "lucide-react";
import ScrollAmbientBackground from "@/components/layout/ScrollAmbientBackground";
import { signInWithEmailPassword, signOut } from "@/lib/auth";
import { clearSessionActivity, markSessionActivity } from "@/lib/session-activity";
import type { UserRole } from "@/types";

const demoRoleOptions = [
  { role: "mahasiswa", label: "Mahasiswa", detail: "Lapor dan pantau", icon: GraduationCap },
  { role: "dosen", label: "Dosen", detail: "Inspeksi dan laporan", icon: BookOpenCheck },
  { role: "teknisi", label: "Teknisi", detail: "Tindak lanjut K3", icon: Wrench },
  { role: "kepala_lab", label: "Kepala Lab", detail: "Kendali laboratorium", icon: Building2 },
  { role: "admin", label: "Admin", detail: "Akses menyeluruh", icon: ShieldCheck },
] satisfies Array<{
  role: UserRole;
  label: string;
  detail: string;
  icon: typeof ShieldCheck;
}>;

const demoModeVisible =
  process.env.NODE_ENV !== "production" ||
  process.env.NEXT_PUBLIC_DEMO_MODE_ENABLED === "true";

function getSafeNextPath(): string {
  const requestedPath = new URLSearchParams(window.location.search).get("next");
  return requestedPath?.startsWith("/") && !requestedPath.startsWith("//")
    ? requestedPath
    : "/dashboard";
}

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [notice, setNotice] = useState("");
  const [demoLoadingRole, setDemoLoadingRole] = useState<UserRole | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const reason = new URLSearchParams(window.location.search).get("reason");
      if (reason === "inactive") {
        setNotice("Sesi berakhir karena tidak ada aktivitas selama 30 menit. Silakan masuk kembali.");
      }
    }, 0);

    return () => window.clearTimeout(timer);
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const { user, error: signInError } = await signInWithEmailPassword(
      email.trim(),
      password,
    );

    if (signInError || !user) {
      const { error: signOutError } = await signOut();
      clearSessionActivity();
      const loginError = signInError ?? "Login gagal. Periksa email dan password.";
      setError(
        signOutError
          ? `${loginError} Gagal membersihkan sesi: ${signOutError}`
          : loginError,
      );
      setLoading(false);
      return;
    }

    markSessionActivity();
    router.push(getSafeNextPath());
  }

  async function handleDemoLogin(role: UserRole) {
    if (demoLoadingRole || loading) return;

    setError("");
    setNotice("");
    setDemoLoadingRole(role);

    try {
      const response = await fetch("/api/auth/demo-login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role }),
      });
      const result = (await response.json()) as { error?: string };

      if (!response.ok) {
        setError(result.error ?? "Akun demo belum dapat digunakan.");
        setDemoLoadingRole(null);
        return;
      }

      clearSessionActivity();
      markSessionActivity();
      window.location.assign(getSafeNextPath());
    } catch {
      setError("Layanan akun demo sedang tidak tersedia. Silakan coba kembali.");
      setDemoLoadingRole(null);
    }
  }

  return (
    <div className="relative min-h-dvh w-full max-w-full overflow-hidden bg-[#f7faf7]">
      <ScrollAmbientBackground />

      <main className="relative z-10 mx-auto grid min-h-dvh w-full min-w-0 max-w-7xl items-center gap-10 px-4 py-5 sm:px-8 lg:grid-cols-[1.05fr_0.95fr] lg:gap-16 lg:py-10">
        <section className="hidden min-h-[680px] overflow-hidden rounded-[40px] bg-[#102c23] p-10 text-white shadow-[0_40px_100px_rgba(16,44,35,0.22)] lg:flex lg:flex-col">
          <Link href="/" className="flex items-center gap-3">
            <span className="grid h-12 w-12 place-items-center rounded-2xl bg-white shadow-lg">
              <Image src="/logo.png" alt="" width={40} height={40} className="h-10 w-10 object-contain" priority />
            </span>
            <span>
              <span className="block font-bold">VocaSafe Lab</span>
              <span className="block text-[10px] font-semibold uppercase tracking-[0.2em] text-emerald-200/70">Keselamatan Terpadu</span>
            </span>
          </Link>

          <div className="my-auto max-w-lg">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.07] px-3 py-1.5 text-xs text-emerald-100">
              <Sparkles className="h-3.5 w-3.5" />
              Ruang kerja keselamatan terpadu
            </div>
            <h1 className="mt-6 text-5xl font-semibold leading-[1.02] tracking-[-0.055em]">
              Keputusan K3 yang lebih cepat dan terukur.
            </h1>
            <p className="mt-5 max-w-md text-sm leading-7 text-emerald-50/65">
              Pantau aset, inspeksi, laporan bahaya, dan tindak lanjut risiko dari satu sistem yang dirancang untuk laboratorium vokasi.
            </p>

            <div className="mt-9 grid grid-cols-2 gap-3">
              <div className="float-slow rounded-3xl border border-white/10 bg-white/[0.07] p-4 backdrop-blur-lg">
                <ShieldCheck className="h-5 w-5 text-emerald-300" />
                <p className="mt-6 text-3xl font-semibold tracking-[-0.04em]">100%</p>
                <p className="mt-1 text-xs text-emerald-100/60">Jejak audit digital</p>
              </div>
              <div className="translate-y-5 rounded-3xl border border-white/10 bg-gradient-to-br from-emerald-400/20 to-violet-300/10 p-4 backdrop-blur-lg">
                <CheckCircle2 className="h-5 w-5 text-violet-200" />
                <p className="mt-6 text-3xl font-semibold tracking-[-0.04em]">24/7</p>
                <p className="mt-1 text-xs text-emerald-100/60">Pemantauan terpusat</p>
              </div>
            </div>
          </div>

          <p className="text-xs leading-5 text-emerald-100/45">
            Akses disesuaikan dengan peran dan laboratorium pengguna.
          </p>
        </section>

        <section className="fade-up mx-auto w-full min-w-0 max-w-md py-6">
          <Link href="/" className="mb-10 inline-flex items-center gap-2 text-xs font-semibold text-slate-500 transition hover:text-emerald-800 lg:hidden">
            <ArrowLeft className="h-4 w-4" />
            Kembali
          </Link>

          <div className="mb-8 flex items-center gap-3 lg:hidden">
            <span className="grid h-12 w-12 place-items-center rounded-2xl bg-white shadow-[0_12px_28px_rgba(8,119,90,0.14)]">
              <Image src="/logo.png" alt="" width={40} height={40} className="h-10 w-10 object-contain" priority />
            </span>
            <div>
              <p className="font-bold text-[#102c23]">VocaSafe Lab</p>
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-emerald-700/60">Keselamatan Terpadu</p>
            </div>
          </div>

          <p className="text-xs font-bold uppercase tracking-[0.18em] text-emerald-700">Selamat datang kembali</p>
          <h2 className="mt-3 text-3xl font-semibold leading-tight tracking-[-0.045em] text-[#102c23] min-[390px]:text-4xl">Masuk ke ruang kerja</h2>
          <p className="mt-3 text-sm leading-6 text-slate-500">Gunakan akun yang telah terdaftar untuk melanjutkan monitoring K3.</p>

          {demoModeVisible && (
            <section className="mt-7 min-w-0" aria-labelledby="demo-account-heading">
              <div className="flex items-end justify-between gap-3 px-1">
                <div>
                  <h3 id="demo-account-heading" className="text-sm font-bold text-slate-900">
                    Masuk dengan akun demo
                  </h3>
                  <p className="mt-1 text-xs text-slate-500">
                    Pilih peran untuk melihat tampilan dan hak aksesnya.
                  </p>
                </div>
                <span className="shrink-0 text-[10px] font-semibold text-emerald-700 sm:hidden">
                  Geser ke samping
                </span>
              </div>

              <div className="mt-3 flex snap-x snap-mandatory gap-3 overflow-x-auto pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                {demoRoleOptions.map(({ role, label, detail, icon: Icon }) => {
                  const isLoading = demoLoadingRole === role;
                  return (
                    <button
                      key={role}
                      type="button"
                      disabled={Boolean(demoLoadingRole) || loading}
                      onClick={() => void handleDemoLogin(role)}
                      className="group min-h-24 min-w-[148px] snap-start rounded-2xl border border-emerald-950/10 bg-white/80 p-3 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-emerald-300 hover:shadow-md disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <span className="flex items-center justify-between gap-3">
                        <span className="grid h-9 w-9 place-items-center rounded-xl bg-emerald-50 text-emerald-700 transition group-hover:bg-emerald-700 group-hover:text-white">
                          {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Icon className="h-4 w-4" />}
                        </span>
                        <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-emerald-700">
                          Demo
                        </span>
                      </span>
                      <span className="mt-3 block text-sm font-bold text-slate-900">{label}</span>
                      <span className="mt-0.5 block text-[11px] text-slate-500">{detail}</span>
                    </button>
                  );
                })}
              </div>
            </section>
          )}

          <form onSubmit={handleSubmit} className="premium-surface mt-8 min-w-0 max-w-full space-y-5 rounded-[28px] p-4 min-[390px]:p-5 sm:rounded-[32px] sm:p-7">
            <div>
              <label htmlFor="email" className="mb-2 block text-xs font-bold uppercase tracking-[0.12em] text-slate-600">
                Email
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                autoComplete="email"
                required
                className="h-13 w-full rounded-2xl border border-emerald-950/10 bg-white/80 px-4 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10"
                placeholder="nama@institusi.ac.id"
              />
            </div>

            <div>
              <label htmlFor="password" className="mb-2 block text-xs font-bold uppercase tracking-[0.12em] text-slate-600">
                Password
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  autoComplete="current-password"
                  required
                  className="h-13 w-full rounded-2xl border border-emerald-950/10 bg-white/80 px-4 pr-12 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10"
                  placeholder="Masukkan password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((visible) => !visible)}
                  aria-label={showPassword ? "Sembunyikan password" : "Tampilkan password"}
                  className="absolute inset-y-0 right-1 grid w-11 place-items-center text-slate-400 transition hover:text-emerald-700"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {error && (
              <div role="alert" className="rounded-2xl border border-red-100 bg-red-50 p-3.5 text-sm leading-5 text-red-700">
                {error}
              </div>
            )}

            {notice && !error && (
              <div role="status" className="rounded-2xl border border-amber-200 bg-amber-50 p-3.5 text-sm leading-5 text-amber-800">
                {notice}
              </div>
            )}

            <button
              type="submit"
              disabled={loading || Boolean(demoLoadingRole)}
              className="flex h-13 w-full items-center justify-center gap-2 rounded-2xl bg-[#102c23] px-4 text-sm font-semibold text-white shadow-[0_16px_32px_rgba(16,44,35,0.2)] transition hover:-translate-y-0.5 hover:bg-[#164535] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              {loading ? "Memeriksa akun..." : "Masuk ke VocaSafe"}
            </button>

            <p className="text-center text-[11px] leading-5 text-slate-400">
              Akun dan hak akses dikelola oleh administrator institusi.
            </p>
          </form>

          <p className="mt-5 text-center text-[10px] leading-4 text-slate-400">
            Gunakan akun yang telah terdaftar untuk masuk ke ruang kerja VocaSafe Lab.
          </p>
        </section>
      </main>
    </div>
  );
}
