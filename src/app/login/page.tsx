"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { signInWithEmailPassword, signOut } from "@/lib/auth";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

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
      const loginError = signInError ?? "Login gagal. Periksa email dan password.";
      setError(
        signOutError
          ? `${loginError} Gagal membersihkan sesi: ${signOutError}`
          : loginError,
      );
      setLoading(false);
      return;
    }

    router.push("/dashboard");
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-emerald-50 to-teal-50 px-4">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center">
          <div className="flex items-center justify-center gap-2 mb-2">
            <img
              src="/logo.png"
              alt="VocaSafe Lab Logo"
              className="h-9 w-auto object-contain"
            />
            <h1 className="text-2xl font-bold text-slate-900">VocaSafe Lab</h1>
          </div>
          <p className="text-slate-500">Masuk dengan akun Supabase Auth</p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm space-y-4"
        >
          <div>
            <label
              htmlFor="email"
              className="block text-sm font-medium text-slate-700 mb-1"
            >
              Email
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              required
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm placeholder:text-slate-400 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none"
              placeholder="admin@example.com"
            />
          </div>

          <div>
            <label
              htmlFor="password"
              className="block text-sm font-medium text-slate-700 mb-1"
            >
              Password
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              required
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm placeholder:text-slate-400 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none"
              placeholder="Masukkan password"
            />
          </div>

          {error && (
            <div className="rounded-md bg-red-50 p-3 text-sm text-red-700">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60 transition-colors"
          >
            {loading ? "Memeriksa akun..." : "Masuk"}
          </button>

          <p className="text-xs text-slate-500 leading-relaxed">
            Akun dibuat oleh admin. Jika login berhasil tetapi profil belum ada
            di tabel user_profiles, aplikasi akan menolak akses dan meminta Anda
            menghubungi admin.
          </p>
          <p className="text-xs text-slate-400 leading-relaxed">
            Untuk development lokal, isi NEXT_PUBLIC_SUPABASE_URL dan
            NEXT_PUBLIC_SUPABASE_ANON_KEY di .env.local. Jangan commit file .env
            yang berisi secret.
          </p>
        </form>
      </div>
    </div>
  );
}
