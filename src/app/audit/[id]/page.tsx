"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import {
  AlertCircle,
  ArrowLeft,
  BadgeCheck,
  CalendarDays,
  CheckCircle2,
  ClipboardSignature,
  FileCheck2,
  Fingerprint,
  Loader2,
  Printer,
  ShieldCheck,
} from "lucide-react";
import AppShell from "@/components/AppShell";
import { getCurrentUserProfile } from "@/lib/auth";
import {
  fetchAuditRunDetail,
  signOffAuditRun,
  type AuditFindingClassification,
  type AuditRunDetail,
} from "@/lib/audit";
import type { AppUser } from "@/types";

const classificationStyle: Record<AuditFindingClassification, string> = {
  observation: "bg-sky-100 text-sky-700",
  minor: "bg-amber-100 text-amber-700",
  major: "bg-orange-100 text-orange-700",
  critical: "bg-red-100 text-red-700",
};

const classificationLabels: Record<AuditFindingClassification, string> = {
  observation: "Observasi",
  minor: "Minor",
  major: "Mayor",
  critical: "Kritis",
};

const sourceTypeLabels: Record<string, string> = {
  report: "Laporan",
  checklist: "Checklist",
  asset: "Aset",
  certificate: "Sertifikat",
  corrective_action: "Tindakan korektif",
  system: "Sistem",
};

function readableStatus(value: string): string {
  const text = value.replaceAll("_", " ").trim();
  return text ? `${text.charAt(0).toUpperCase()}${text.slice(1)}` : "-";
}

function formatDate(value: string | null): string {
  if (!value) return "-";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "-" : date.toLocaleString("id-ID");
}

export default function AuditSnapshotPage() {
  const params = useParams<{ id: string }>();
  const [detail, setDetail] = useState<AuditRunDetail | null>(null);
  const [user, setUser] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    const [result, profile] = await Promise.all([
      fetchAuditRunDetail(params.id),
      getCurrentUserProfile(),
    ]);
    setDetail(result.detail);
    setUser(profile.user);
    setError(result.error ?? profile.error ?? "");
    setLoading(false);
  };

  useEffect(() => {
    let active = true;
    void Promise.all([
      fetchAuditRunDetail(params.id),
      getCurrentUserProfile(),
    ]).then(([result, profile]) => {
      if (!active) return;
      setDetail(result.detail);
      setUser(profile.user);
      setError(result.error ?? profile.error ?? "");
      setLoading(false);
    });
    return () => { active = false; };
  }, [params.id]);

  const submitSignoff = async (action: "review" | "approve") => {
    if (!detail) return;
    setSaving(true);
    setError("");
    const result = await signOffAuditRun(detail.id, action, note);
    setSaving(false);
    if (result) setError(result);
    else {
      setNote("");
      await load();
    }
  };

  if (loading) {
    return <AppShell><div className="flex min-h-[55vh] items-center justify-center"><Loader2 className="h-7 w-7 animate-spin text-emerald-600" /></div></AppShell>;
  }

  if (!detail) {
    return (
      <AppShell>
        <section className="mx-auto max-w-xl rounded-3xl border border-red-200 bg-red-50 p-6 text-center">
          <AlertCircle className="mx-auto h-8 w-8 text-red-600" /><h1 className="mt-3 text-xl font-black text-red-950">Arsip audit tidak tersedia</h1><p className="mt-2 text-sm text-red-800">{error || "Data tidak ditemukan atau Anda tidak memiliki akses."}</p><Link href="/audit" className="mt-5 inline-flex items-center gap-2 rounded-xl bg-red-700 px-4 py-2 text-sm font-bold text-white"><ArrowLeft className="h-4 w-4" /> Kembali ke audit</Link>
        </section>
      </AppShell>
    );
  }

  const canManage = user?.role === "admin" || user?.role === "kepala_lab";
  const isCreator = user?.id === detail.generatedById;
  const isReviewer = user?.id === detail.reviewedById;
  const canReview = canManage && detail.status === "draft" && !isCreator;
  const canApprove = canManage && detail.status === "reviewed" && !isCreator && !isReviewer;
  const metrics = detail.snapshot.metrics ?? {};

  return (
    <AppShell>
      <main className="min-w-0 space-y-5 pb-8">
        <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
          <Link href="/audit" className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-700"><ArrowLeft className="h-4 w-4" /> Kembali</Link>
          <button type="button" onClick={() => window.print()} className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-emerald-700 px-4 py-2 text-sm font-bold text-white"><Printer className="h-4 w-4" /> Cetak Audit</button>
        </div>

        <header className="rounded-[2rem] bg-slate-950 p-5 text-white shadow-xl sm:p-7 print:rounded-none print:bg-white print:p-0 print:text-black print:shadow-none">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0"><div className="flex items-center gap-2 text-emerald-300 print:text-black"><ShieldCheck className="h-5 w-5" /><span className="text-xs font-black uppercase tracking-[0.2em]">Arsip audit terlindungi</span></div><h1 className="mt-3 break-all text-2xl font-black sm:text-3xl">{detail.auditNumber}</h1><p className="mt-2 max-w-3xl text-sm leading-6 text-slate-300 print:text-black">{detail.scope}</p></div>
            <span className={`rounded-full px-3 py-1.5 text-xs font-black ${detail.status === "approved" ? "bg-emerald-400 text-emerald-950" : detail.status === "reviewed" ? "bg-sky-300 text-sky-950" : "bg-slate-700 text-white"}`}>{detail.status === "approved" ? "Disetujui" : detail.status === "reviewed" ? "Ditinjau" : "Draf"}</span>
          </div>
          <dl className="mt-6 grid gap-3 text-xs sm:grid-cols-2 xl:grid-cols-4">
            <div><dt className="text-slate-400 print:text-black">Laboratorium</dt><dd className="mt-1 font-bold">{detail.laboratoryName ?? "Seluruh lab terotorisasi"}</dd></div><div><dt className="text-slate-400 print:text-black">Periode</dt><dd className="mt-1 font-bold">{detail.periodStart ?? "Awal data"} — {detail.periodEnd ?? "Sekarang"}</dd></div><div><dt className="text-slate-400 print:text-black">Auditor/pembuat</dt><dd className="mt-1 font-bold">{detail.generatedByName ?? "Pengguna terotorisasi"}</dd></div><div><dt className="text-slate-400 print:text-black">Dibuat</dt><dd className="mt-1 font-bold">{formatDate(detail.generatedAt)}</dd></div>
          </dl>
        </header>

        {!detail.dataComplete && <div className="rounded-2xl border border-red-300 bg-red-50 p-4 text-sm font-bold text-red-800">Arsip audit ditandai tidak lengkap. Jangan gunakan sebagai keputusan final tanpa verifikasi sumber.</div>}
        {error && <div role="alert" className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">{error}</div>}

        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {[
            ["Total aset", metrics.totalAssets ?? 0], ["Total laporan", metrics.totalReports ?? 0],
            ["Total checklist", metrics.totalChecklists ?? 0], ["Risiko tinggi/kritis", metrics.highCriticalRisks ?? 0],
            ["Laporan terbuka", metrics.openReports ?? 0], ["Bahaya aktif", metrics.activeHazards ?? 0],
            ["Tindakan terlambat", metrics.overdueActions ?? 0], ["Inspeksi terlambat", metrics.overdueInspections ?? 0],
          ].map(([label, value]) => <article key={label} className="rounded-2xl border border-slate-200 bg-white p-4"><p className="text-xs font-semibold text-slate-500">{label}</p><p className="mt-1 text-2xl font-black text-slate-950">{value}</p></article>)}
        </section>

        <section className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-3xl border border-slate-200 bg-white p-5"><h2 className="font-black text-slate-950">Kriteria audit</h2><ul className="mt-4 space-y-2 text-sm text-slate-600">{detail.criteria.map((item) => <li key={item} className="flex gap-2"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />{item}</li>)}</ul></div>
          <div className="rounded-3xl border border-slate-200 bg-white p-5"><h2 className="font-black text-slate-950">Metodologi</h2><p className="mt-4 text-sm leading-6 text-slate-600">{detail.methodology}</p></div>
        </section>

        <section className="rounded-3xl border border-slate-200 bg-white p-5 sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-xs font-black uppercase tracking-[0.18em] text-red-600">Jejak bukti</p><h2 className="mt-1 text-xl font-black text-slate-950">Temuan tersimpan</h2></div><span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-700">{detail.findings.length} temuan</span></div>
          {detail.findings.length === 0 ? <p className="mt-5 rounded-2xl bg-emerald-50 p-4 text-sm text-emerald-800">Tidak ada temuan prioritas pada arsip ini.</p> : <div className="mt-5 grid gap-3 lg:grid-cols-2">{detail.findings.map((finding) => <article key={finding.id} className="min-w-0 rounded-2xl bg-slate-50 p-4"><span className={`inline-flex rounded-full px-2.5 py-1 text-[10px] font-black uppercase ${classificationStyle[finding.classification]}`}>{classificationLabels[finding.classification]}</span><h3 className="mt-2 break-words font-bold text-slate-950">{finding.title}</h3><p className="mt-2 text-sm leading-6 text-slate-600">{finding.description}</p><dl className="mt-3 grid gap-2 text-xs text-slate-500 sm:grid-cols-2"><div><dt className="font-bold text-slate-700">PIC</dt><dd>{finding.owner}</dd></div><div><dt className="font-bold text-slate-700">Tenggat</dt><dd>{formatDate(finding.dueAt)}</dd></div><div><dt className="font-bold text-slate-700">Status terkait</dt><dd>{readableStatus(finding.sourceStatus)}</dd></div><div><dt className="font-bold text-slate-700">Jenis temuan</dt><dd>{sourceTypeLabels[finding.sourceType] ?? "Lainnya"}</dd></div></dl>{finding.recommendation && <p className="mt-3 rounded-xl bg-white p-3 text-xs leading-5 text-slate-600">{finding.recommendation}</p>}</article>)}</div>}
        </section>

        <section className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-3xl border border-emerald-200 bg-emerald-50 p-5"><div className="flex items-center gap-2"><BadgeCheck className="h-5 w-5 text-emerald-700" /><h2 className="font-black text-emerald-950">Rekomendasi tersimpan</h2></div><ol className="mt-4 space-y-3 text-sm leading-6 text-emerald-950">{(detail.snapshot.recommendations ?? []).map((item, index) => <li key={item} className="flex gap-3"><span className="font-black">{index + 1}.</span>{item}</li>)}</ol></div>
          <details className="rounded-3xl border border-slate-200 bg-white p-5"><summary className="flex cursor-pointer items-center gap-2 font-black text-slate-950"><Fingerprint className="h-5 w-5 text-slate-700" />Detail integritas audit</summary><dl className="mt-4 space-y-3 text-sm"><div><dt className="text-xs font-semibold text-slate-500">Kode verifikasi</dt><dd className="mt-1 break-all font-mono text-xs text-slate-800">{detail.snapshotHash}</dd></div><div><dt className="text-xs font-semibold text-slate-500">Kelengkapan data</dt><dd className="mt-1 font-bold text-slate-800">{detail.dataComplete ? "Lengkap" : "Tidak lengkap"}</dd></div></dl></details>
        </section>

        <section className="rounded-3xl border border-slate-200 bg-white p-5 print:hidden sm:p-6">
          <div className="flex items-center gap-2"><ClipboardSignature className="h-5 w-5 text-emerald-700" /><h2 className="font-black text-slate-950">Peninjauan dan persetujuan</h2></div>
          <div className="mt-4 space-y-3">{detail.signoffs.map((signoff) => <article key={signoff.id} className="rounded-2xl bg-slate-50 p-4"><div className="flex flex-wrap justify-between gap-2"><p className="text-sm font-bold text-slate-900">{signoff.type === "review" ? "Peninjauan" : "Persetujuan"} · {signoff.signerName}</p><span className="text-xs text-slate-500">{formatDate(signoff.createdAt)}</span></div>{signoff.note && <p className="mt-2 text-xs leading-5 text-slate-600">{signoff.note}</p>}</article>)}{detail.signoffs.length === 0 && <p className="text-sm text-slate-500">Belum ada peninjauan atau persetujuan.</p>}</div>
          {(canReview || canApprove) && <div className="mt-5 border-t border-slate-100 pt-5"><label className="text-sm font-semibold text-slate-700">Catatan persetujuan<textarea value={note} onChange={(event) => setNote(event.target.value)} rows={2} className="mt-2 w-full rounded-xl border border-slate-200 p-3 text-sm outline-none focus:border-emerald-500" /></label><button type="button" disabled={saving} onClick={() => void submitSignoff(canReview ? "review" : "approve")} className="mt-3 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-emerald-700 px-4 py-2 text-sm font-bold text-white disabled:opacity-50"><FileCheck2 className="h-4 w-4" />{saving ? "Menyimpan..." : canReview ? "Konfirmasi Peninjauan" : "Setujui Audit"}</button></div>}
          {canManage && !canReview && !canApprove && detail.status !== "approved" && <p className="mt-4 rounded-xl bg-amber-50 p-3 text-xs text-amber-800">Pemisahan tugas aktif: pembuat tidak boleh meninjau audit sendiri, dan peninjau tidak boleh menjadi pemberi persetujuan.</p>}
        </section>

        <footer className="rounded-2xl border border-slate-200 bg-white p-4 text-xs text-slate-500"><div className="flex flex-wrap items-center justify-between gap-2"><span className="inline-flex items-center gap-1"><CalendarDays className="h-3.5 w-3.5" /> Dibuat {formatDate(detail.generatedAt)}</span><span className="inline-flex items-center gap-1"><FileCheck2 className="h-3.5 w-3.5" /> {detail.status === "approved" ? "Disetujui" : detail.status === "reviewed" ? "Ditinjau" : "Draf"}</span></div></footer>
      </main>
    </AppShell>
  );
}
