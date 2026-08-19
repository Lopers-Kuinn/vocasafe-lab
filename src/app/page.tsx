"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";

export default function HomePage() {
  return (
    <div className="flex flex-col min-h-screen items-center justify-center bg-gradient-to-br from-emerald-50 to-teal-50">
      <main className="flex flex-col items-center gap-8 px-6 text-center">
        <div className="flex items-center gap-3">
          <img
            src="/logo.png"
            alt="VocaSafe Lab Logo"
            className="h-12 w-auto object-contain"
          />
          <h1 className="text-4xl font-bold text-slate-900">VocaSafe Lab</h1>
        </div>
        <p className="max-w-md text-lg text-slate-600">
          Sistem Audit K3 dan Manajemen Risiko Laboratorium Vokasi berbasis QR
          Code dan AI-Assisted Risk Scoring.
        </p>
        <Link
          href="/login"
          className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-6 py-3 text-white font-medium hover:bg-emerald-700 transition-colors"
        >
          Masuk ke Sistem
          <ArrowRight className="h-4 w-4" />
        </Link>
      </main>
    </div>
  );
}
