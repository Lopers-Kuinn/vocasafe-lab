"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Activity,
  AlertCircle,
  AlertTriangle,
  ArrowUpRight,
  BarChart3,
  CheckCircle2,
  ClipboardCheck,
  FileWarning,
  Loader2,
  Package,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import AppShell from "@/components/AppShell";
import { fetchSupabaseSummary, type SupabaseSummary } from "@/lib/summary";
import type { ReportStatus, RiskLevel } from "@/types";

const riskColors: Record<RiskLevel, string> = {
  rendah: "bg-emerald-100 text-emerald-800",
  sedang: "bg-yellow-100 text-yellow-800",
  tinggi: "bg-orange-100 text-orange-800",
  kritis: "bg-red-100 text-red-800",
};

const riskLabels: Record<RiskLevel, string> = {
  rendah: "Rendah",
  sedang: "Sedang",
  tinggi: "Tinggi",
  kritis: "Kritis",
};

const statusLabels: Record<ReportStatus, string> = {
  baru: "Baru",
  diverifikasi: "Diverifikasi",
  dalam_penanganan: "Dalam Penanganan",
  selesai: "Selesai",
  ditolak: "Ditolak",
};

const statusBars: Record<ReportStatus, string> = {
  baru: "bg-sky-400",
  diverifikasi: "bg-teal-500",
  dalam_penanganan: "bg-amber-400",
  selesai: "bg-emerald-500",
  ditolak: "bg-red-400",
};

export default function DashboardPage() {
  const [summary, setSummary] = useState<SupabaseSummary | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    void fetchSupabaseSummary().then((result) => {
      if (!active) return;
      setSummary(result.summary);
      setErrors(result.errors);
      setLoading(false);
    });

    return () => {
      active = false;
    };
  }, []);

  if (loading || !summary) {
    return (
      <AppShell>
        <div className="flex min-h-[60vh] items-center justify-center">
          <div className="premium-surface flex items-center gap-3 rounded-3xl px-6 py-4 text-sm font-medium text-emerald-950">
            <Loader2 className="h-5 w-5 animate-spin text-emerald-600" />
            Memuat tinjauan keselamatan...
          </div>
        </div>
      </AppShell>
    );
  }

  const stats = [
    {
      label: "Total Aset",
      value: summary.assets.length,
      icon: Package,
      accent: "from-emerald-500 to-teal-700",
      surface: "bg-emerald-50 text-emerald-700",
      note: `${summary.assetStatus.layak} berstatus layak`,
    },
    {
      label: "Total Laporan",
      value: summary.reports.length,
      icon: FileWarning,
      accent: "from-sky-500 to-indigo-600",
      surface: "bg-sky-50 text-sky-700",
      note: `${summary.openReports} belum selesai`,
    },
    {
      label: "Total Checklist",
      value: summary.checklistResults.length,
      icon: ClipboardCheck,
      accent: "from-teal-500 to-cyan-600",
      surface: "bg-teal-50 text-teal-700",
      note: "Inspeksi terdokumentasi",
    },
    {
      label: "Temuan Tinggi/Kritis",
      value: summary.reportRisk.tinggi + summary.reportRisk.kritis + summary.checklistHighOrCritical,
      icon: AlertTriangle,
      accent: "from-orange-500 to-red-600",
      surface: "bg-red-50 text-red-700",
      note: "Perlu prioritas tindak lanjut",
    },
  ];

  const totalReportRisk = Object.values(summary.reportRisk).reduce((total, value) => total + value, 0);

  return (
    <AppShell>
      <div className="space-y-5 sm:space-y-6">
        <section className="fade-up relative overflow-hidden rounded-[32px] bg-[#102c23] p-5 text-white shadow-[0_28px_70px_rgba(16,44,35,0.18)] sm:p-7 lg:p-8">
          <div className="pointer-events-none absolute -right-16 -top-28 h-80 w-80 rounded-full bg-emerald-400/20 blur-3xl" />
          <div className="pointer-events-none absolute bottom-[-11rem] right-[26%] h-80 w-80 rounded-full bg-violet-400/15 blur-3xl" />
          <div className="relative grid gap-8 lg:grid-cols-[1fr_0.78fr] lg:items-center">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.07] px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.16em] text-emerald-200 backdrop-blur-lg">
                <Sparkles className="h-3.5 w-3.5" />
                Monitoring K3 aktif
              </div>
              <h1 className="mt-5 max-w-2xl text-3xl font-semibold leading-tight tracking-[-0.045em] sm:text-4xl">
                Tinjauan keselamatan laboratorium
              </h1>
              <p className="mt-3 max-w-xl text-sm leading-6 text-emerald-50/65">
                Status aset, laporan bahaya, dan inspeksi terbaru dirangkum dari data Supabase sesuai akses Anda.
              </p>
              <div className="mt-6 flex flex-wrap gap-3">
                <Link
                  href="/reports"
                  className="group inline-flex items-center gap-2 rounded-2xl bg-white px-4 py-2.5 text-xs font-bold text-[#102c23] shadow-lg transition hover:-translate-y-0.5"
                >
                  Tinjau laporan
                  <ArrowUpRight className="h-4 w-4 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
                </Link>
                <Link
                  href="/assets"
                  className="inline-flex items-center rounded-2xl border border-white/12 bg-white/[0.06] px-4 py-2.5 text-xs font-bold text-white backdrop-blur-lg transition hover:bg-white/10"
                >
                  Lihat kondisi aset
                </Link>
              </div>
            </div>

            <div className="relative mx-auto h-52 w-full max-w-md sm:h-56">
              <div className="absolute left-[13%] top-[12%] h-36 w-[72%] rounded-[32px] border border-white/10 bg-gradient-to-br from-white/12 to-white/[0.03] shadow-[0_28px_60px_rgba(0,0,0,0.18)] backdrop-blur-xl [transform:perspective(800px)_rotateX(56deg)_rotateZ(-8deg)]" />
              <div className="absolute left-[26%] top-[18%] grid h-32 w-32 place-items-center rounded-[32px] border border-emerald-200/20 bg-gradient-to-br from-emerald-300/25 to-cyan-300/5 shadow-[0_24px_55px_rgba(16,185,129,0.16)] backdrop-blur-xl sm:left-[31%]">
                <ShieldCheck className="h-14 w-14 text-emerald-200" strokeWidth={1.35} />
              </div>
              <div className="premium-surface absolute bottom-0 left-0 rounded-2xl p-3 text-[#102c23] shadow-xl">
                <p className="text-[9px] font-bold uppercase tracking-[0.12em] text-emerald-700">Aset layak</p>
                <p className="mt-1 text-2xl font-semibold tracking-[-0.04em]">{summary.assetStatus.layak}</p>
              </div>
              <div className="premium-surface absolute right-0 top-0 rounded-2xl p-3 text-[#102c23] shadow-xl [transform:rotate(2deg)]">
                <p className="text-[9px] font-bold uppercase tracking-[0.12em] text-red-600">Risiko kritis</p>
                <p className="mt-1 text-2xl font-semibold tracking-[-0.04em]">{summary.reportRisk.kritis}</p>
              </div>
            </div>
          </div>
        </section>

        {errors.length > 0 && (
          <div role="alert" className="soft-card flex items-start gap-3 rounded-3xl border-amber-200/70 bg-amber-50/90 p-4 text-sm text-amber-900">
            <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
            <div>
              <p className="font-semibold">Sebagian data tidak dapat dimuat.</p>
              <ul className="mt-1 list-disc pl-5 text-amber-800">
                {errors.map((error) => <li key={error}>{error}</li>)}
              </ul>
            </div>
          </div>
        )}

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {stats.map(({ label, value, icon: Icon, accent, surface, note }, index) => (
            <article key={label} className="soft-card lift-card relative overflow-hidden rounded-[26px] p-4 sm:p-5" style={{ animationDelay: `${index * 70}ms` }}>
              <div className={`absolute inset-x-0 top-0 h-1 bg-gradient-to-r ${accent}`} />
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-semibold text-slate-500">{label}</p>
                  <p className="mt-2 text-3xl font-semibold tracking-[-0.05em] text-slate-950">{value}</p>
                </div>
                <span className={`grid h-11 w-11 place-items-center rounded-2xl ${surface}`}>
                  <Icon className="h-5 w-5" />
                </span>
              </div>
              <p className="mt-4 text-[11px] leading-4 text-slate-400">{note}</p>
            </article>
          ))}
        </div>

        <div className="grid gap-5 xl:grid-cols-[0.9fr_1.1fr]">
          <section className="soft-card min-w-0 overflow-hidden rounded-[28px] p-4 sm:p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-emerald-700">Kelayakan</p>
                <h2 className="mt-1 text-lg font-bold tracking-[-0.025em] text-slate-950">Status aset</h2>
              </div>
              <span className="grid h-10 w-10 place-items-center rounded-2xl bg-emerald-50 text-emerald-700">
                <Package className="h-4 w-4" />
              </span>
            </div>

            <div className="mt-6 space-y-3">
              {[
                { label: "Layak", value: summary.assetStatus.layak, color: "bg-emerald-500", tone: "text-emerald-700" },
                { label: "Perlu dicek", value: summary.assetStatus.perlu_dicek, color: "bg-amber-400", tone: "text-amber-700" },
                { label: "Tidak layak", value: summary.assetStatus.tidak_layak, color: "bg-red-500", tone: "text-red-700" },
              ].map((item) => {
                const totalAssets = Math.max(summary.assets.length, 1);
                return (
                  <div key={item.label} className="rounded-2xl bg-slate-50/80 p-3.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className={`font-semibold ${item.tone}`}>{item.label}</span>
                      <span className="font-bold text-slate-800">{item.value}</span>
                    </div>
                    <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-slate-200/70">
                    <div className={`motion-bar-x h-full rounded-full ${item.color}`} style={{ width: `${(item.value / totalAssets) * 100}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          <section className="soft-card rounded-[28px] p-5 sm:p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-violet-700">Analisis laporan</p>
                <h2 className="mt-1 text-lg font-bold tracking-[-0.025em] text-slate-950">Distribusi risiko</h2>
              </div>
              <span className="grid h-10 w-10 place-items-center rounded-2xl bg-violet-50 text-violet-700">
                <BarChart3 className="h-4 w-4" />
              </span>
            </div>

            <div className="mt-6 grid grid-cols-1 gap-3 min-[360px]:grid-cols-2 sm:grid-cols-4">
              {(Object.entries(summary.reportRisk) as [RiskLevel, number][]).map(([risk, count]) => {
                const percent = totalReportRisk > 0 ? Math.round((count / totalReportRisk) * 100) : 0;
                return (
                  <div key={risk} className={`lift-card rounded-2xl p-3.5 ${riskColors[risk]}`}>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[10px] font-bold uppercase tracking-[0.1em]">{riskLabels[risk]}</span>
                      <span className="text-[10px] font-medium opacity-60">{percent}%</span>
                    </div>
                    <p className="mt-4 text-3xl font-semibold tracking-[-0.05em]">{count}</p>
                  </div>
                );
              })}
            </div>
          </section>
        </div>

        <section className="soft-card rounded-[28px] p-5 sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-sky-700">Alur penanganan</p>
              <h2 className="mt-1 text-lg font-bold tracking-[-0.025em] text-slate-950">Status laporan</h2>
            </div>
            <span className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-600">
              {summary.openReports} belum selesai
            </span>
          </div>
          <div className="mt-5 grid grid-cols-1 gap-3 min-[360px]:grid-cols-2 sm:grid-cols-5">
            {(Object.entries(summary.reportStatus) as [ReportStatus, number][]).map(([status, count]) => (
              <div key={status} className="lift-card relative overflow-hidden rounded-2xl border border-slate-100 bg-white p-3.5">
                <span className={`absolute inset-y-0 left-0 w-1 ${statusBars[status]}`} />
                <p className="text-2xl font-semibold tracking-[-0.04em] text-slate-900">{count}</p>
                <p className="mt-1 text-[10px] font-medium leading-4 text-slate-500">{statusLabels[status]}</p>
              </div>
            ))}
          </div>
        </section>

        <div className="grid gap-5 xl:grid-cols-2">
          <section className="soft-card rounded-[28px] p-5 sm:p-6">
            <div className="mb-5 flex items-center justify-between">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-red-600">Pemantauan</p>
                <h2 className="mt-1 text-lg font-bold tracking-[-0.025em] text-slate-950">Laporan terbaru</h2>
              </div>
              <Link href="/reports" className="grid h-10 w-10 place-items-center rounded-2xl bg-slate-100 text-slate-600 transition hover:bg-[#102c23] hover:text-white" aria-label="Lihat semua laporan">
                <ArrowUpRight className="h-4 w-4" />
              </Link>
            </div>
            {summary.latestReports.length === 0 ? (
              <p className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-500">Belum ada laporan.</p>
            ) : (
              <div className="space-y-2.5">
                {summary.latestReports.map((report) => (
                  <Link key={report.id} href={`/reports/${report.id}`} className="group flex min-w-0 flex-col items-stretch gap-3 rounded-2xl border border-transparent bg-slate-50/80 p-3.5 transition hover:border-emerald-100 hover:bg-white hover:shadow-sm min-[430px]:flex-row min-[430px]:items-center min-[430px]:justify-between">
                    <div className="flex min-w-0 items-start gap-3">
                      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-white text-slate-500 shadow-sm group-hover:text-emerald-700">
                        <FileWarning className="h-4 w-4" />
                      </span>
                      <div className="min-w-0">
                        <p className="break-words text-sm font-semibold leading-5 text-slate-900 min-[430px]:truncate">{report.title}</p>
                        <p className="mt-0.5 break-words text-[11px] leading-4 text-slate-500 min-[430px]:truncate">{report.asset?.code ?? "Tanpa aset"} &middot; {report.location}</p>
                      </div>
                    </div>
                    <span className={`w-fit max-w-full shrink-0 break-words rounded-full px-2.5 py-1 text-[10px] font-bold ${riskColors[report.riskCategory]}`}>
                      {riskLabels[report.riskCategory]}
                    </span>
                  </Link>
                ))}
              </div>
            )}
          </section>

          <section className="soft-card min-w-0 overflow-hidden rounded-[28px] p-4 sm:p-6">
            <div className="mb-5 flex items-center justify-between">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-teal-700">Inspeksi</p>
                <h2 className="mt-1 text-lg font-bold tracking-[-0.025em] text-slate-950">Checklist terbaru</h2>
              </div>
              <span className="grid h-10 w-10 place-items-center rounded-2xl bg-teal-50 text-teal-700">
                <Activity className="h-4 w-4" />
              </span>
            </div>
            {summary.latestChecklistResults.length === 0 ? (
              <p className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-500">Belum ada hasil checklist atau akses dibatasi RLS.</p>
            ) : (
              <div className="space-y-2.5">
                {summary.latestChecklistResults.map((checklist) => (
                  <div key={checklist.id} className="flex min-w-0 flex-col items-stretch gap-3 rounded-2xl bg-slate-50/80 p-3.5 min-[430px]:flex-row min-[430px]:items-center min-[430px]:justify-between">
                    <div className="flex min-w-0 items-start gap-3">
                      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-white text-emerald-700 shadow-sm">
                        <CheckCircle2 className="h-4 w-4" />
                      </span>
                      <div className="min-w-0">
                        <p className="break-words text-sm font-semibold leading-5 text-slate-900 min-[430px]:truncate">{checklist.template?.title ?? "Checklist K3"}</p>
                        <p className="mt-0.5 break-words text-[11px] leading-4 text-slate-500 min-[430px]:truncate">{checklist.asset?.code ?? "Tanpa aset"} &middot; {new Date(checklist.completedAt).toLocaleDateString("id-ID")}</p>
                      </div>
                    </div>
                    <span className={`w-fit max-w-full shrink-0 break-words rounded-full px-2.5 py-1 text-[10px] font-bold ${checklist.riskCategory ? riskColors[checklist.riskCategory] : "bg-emerald-100 text-emerald-800"}`}>
                      {checklist.riskCategory ? `${riskLabels[checklist.riskCategory]} (${checklist.riskScore})` : "Tanpa temuan"}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>

        <p className="px-1 text-[10px] leading-4 text-slate-400">
          Ringkasan checklist mengikuti policy RLS untuk role yang sedang login.
        </p>
      </div>
    </AppShell>
  );
}
