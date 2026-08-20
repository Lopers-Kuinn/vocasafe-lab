"use client";

import { useEffect, useState } from "react";
import {
  AlertCircle,
  ClipboardCheck,
  Download,
  FileText,
  Loader2,
  Package,
  Printer,
} from "lucide-react";
import AppShell from "@/components/AppShell";
import {
  fetchSupabaseSummary,
  type SupabaseSummary,
} from "@/lib/summary";
import type { ReportStatus, RiskLevel } from "@/types";

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

function csvCell(value: string | number | null): string {
  const normalized = value === null ? "" : String(value);
  return `"${normalized.replace(/"/g, '""')}"`;
}

function exportCsv(summary: SupabaseSummary): void {
  const headers = [
    "Jenis Data",
    "Nomor",
    "Judul/Template",
    "Aset",
    "Lokasi",
    "Status",
    "Kategori Risiko",
    "Skor Risiko",
    "Tanggal",
    "Catatan",
  ];

  const reportRows = summary.reports.map((report) => [
    "Laporan",
    report.reportNumber,
    report.title,
    report.asset ? `${report.asset.code} - ${report.asset.name}` : "",
    report.location,
    statusLabels[report.status],
    riskLabels[report.riskCategory],
    report.riskScore,
    new Date(report.reportedAt).toISOString(),
    report.description,
  ]);

  const checklistRows = summary.checklistResults.map((checklist) => [
    "Checklist",
    "",
    checklist.template?.title ?? "Checklist K3",
    checklist.asset
      ? `${checklist.asset.code} - ${checklist.asset.name}`
      : "",
    checklist.asset?.location ?? "",
    checklist.hasRiskFinding ? "Ada temuan" : "Tidak ada temuan",
    checklist.riskCategory ? riskLabels[checklist.riskCategory] : "",
    checklist.riskScore,
    new Date(checklist.completedAt).toISOString(),
    checklist.overallNote,
  ]);

  const csv =
    "\uFEFF" +
    [headers, ...reportRows, ...checklistRows]
      .map((row) => row.map(csvCell).join(","))
      .join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = "vocasafe-audit-report.csv";
  anchor.click();
  URL.revokeObjectURL(url);
}

export default function AuditPage() {
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
        <div className="flex min-h-64 items-center justify-center">
          <Loader2 className="mr-2 h-5 w-5 animate-spin text-emerald-600" />
          <span className="text-sm text-slate-500">Memuat laporan audit...</span>
        </div>
      </AppShell>
    );
  }

  const totalHighOrCritical =
    summary.reportRisk.tinggi +
    summary.reportRisk.kritis +
    summary.checklistHighOrCritical;

  return (
    <AppShell>
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
          <div>
            <div className="flex items-center gap-2">
              <FileText className="h-6 w-6 text-emerald-600" />
              <h1 className="text-2xl font-bold text-slate-900">
                Laporan Audit K3 Digital
              </h1>
            </div>
            <p className="mt-1 text-sm text-slate-500">
              Rekap aset, laporan bahaya, dan checklist dari Supabase.
            </p>
          </div>
          <div className="grid w-full gap-2 min-[430px]:flex min-[430px]:w-auto min-[430px]:flex-wrap">
            <button
              type="button"
              onClick={() => exportCsv(summary)}
              className="inline-flex min-h-10 w-full items-center justify-center gap-1 rounded-md bg-emerald-600 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-700 min-[430px]:w-auto"
            >
              <Download className="h-4 w-4" /> Export CSV
            </button>
            <button
              type="button"
              onClick={() => window.print()}
              className="inline-flex min-h-10 w-full items-center justify-center gap-1 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 min-[430px]:w-auto"
            >
              <Printer className="h-4 w-4" /> Print / Save as PDF
            </button>
          </div>
        </div>

        {errors.length > 0 && (
          <div
            role="alert"
            className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800"
          >
            <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
            <div>
              <p className="font-medium">Sebagian data audit tidak dapat dimuat.</p>
              <ul className="mt-1 list-disc pl-5">
                {errors.map((error) => (
                  <li key={error}>{error}</li>
                ))}
              </ul>
            </div>
          </div>
        )}

        <div className="hidden print:block">
          <h1 className="text-2xl font-bold">Laporan Audit K3 Digital</h1>
          <p className="mt-1 text-sm">
            Dibuat pada {new Date().toLocaleString("id-ID")}
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {[
            { label: "Total Aset", value: summary.assets.length, icon: Package },
            {
              label: "Total Laporan",
              value: summary.reports.length,
              icon: FileText,
            },
            {
              label: "Total Checklist",
              value: summary.checklistResults.length,
              icon: ClipboardCheck,
            },
            {
              label: "Risiko Tinggi/Kritis",
              value: totalHighOrCritical,
              icon: AlertCircle,
            },
          ].map(({ label, value, icon: Icon }) => (
            <div
              key={label}
              className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm"
            >
              <div className="flex items-center gap-3">
                <div className="rounded-full bg-emerald-100 p-2 text-emerald-600">
                  <Icon className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-sm text-slate-500">{label}</p>
                  <p className="text-2xl font-bold text-slate-900">{value}</p>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="font-semibold text-slate-900">
              Laporan Berdasarkan Risiko
            </h2>
            <div className="mt-4 space-y-2">
              {(Object.entries(summary.reportRisk) as [RiskLevel, number][]).map(
                ([risk, count]) => (
                  <div key={risk} className="flex justify-between text-sm">
                    <span className="text-slate-600">{riskLabels[risk]}</span>
                    <span className="font-semibold text-slate-900">{count}</span>
                  </div>
                ),
              )}
            </div>
          </section>

          <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="font-semibold text-slate-900">
              Laporan Berdasarkan Status
            </h2>
            <div className="mt-4 space-y-2">
              {(Object.entries(summary.reportStatus) as [ReportStatus, number][]).map(
                ([status, count]) => (
                  <div key={status} className="flex justify-between text-sm">
                    <span className="text-slate-600">{statusLabels[status]}</span>
                    <span className="font-semibold text-slate-900">{count}</span>
                  </div>
                ),
              )}
            </div>
          </section>

          <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="font-semibold text-slate-900">
              Checklist Berdasarkan Risiko
            </h2>
            <div className="mt-4 space-y-2">
              {(Object.entries(summary.checklistRisk) as [RiskLevel, number][]).map(
                ([risk, count]) => (
                  <div key={risk} className="flex justify-between text-sm">
                    <span className="text-slate-600">{riskLabels[risk]}</span>
                    <span className="font-semibold text-slate-900">{count}</span>
                  </div>
                ),
              )}
              <div className="flex justify-between border-t border-slate-100 pt-2 text-sm">
                <span className="text-slate-600">Tanpa temuan</span>
                <span className="font-semibold text-slate-900">
                  {summary.checklistWithoutRisk}
                </span>
              </div>
            </div>
          </section>

          <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="font-semibold text-slate-900">Status Aset</h2>
            <div className="mt-4 space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-600">Layak</span>
                <span className="font-semibold">{summary.assetStatus.layak}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600">Perlu Dicek</span>
                <span className="font-semibold">
                  {summary.assetStatus.perlu_dicek}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600">Tidak Layak</span>
                <span className="font-semibold">
                  {summary.assetStatus.tidak_layak}
                </span>
              </div>
            </div>
          </section>
        </div>

        <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="font-semibold text-slate-900">Laporan Terbaru</h2>
          {summary.latestReports.length === 0 ? (
            <p className="mt-3 text-sm text-slate-500">Belum ada laporan.</p>
          ) : (
            <div className="mt-3 space-y-3">
              {summary.latestReports.map((report) => (
                <article
                  key={report.id}
                  className="rounded-md border border-slate-100 p-3"
                >
                  <div className="flex flex-wrap justify-between gap-2">
                    <div>
                      <p className="text-sm font-medium text-slate-900">
                        {report.title}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        {report.asset?.code ?? "Tanpa aset"} &middot;{" "}
                        {new Date(report.reportedAt).toLocaleDateString("id-ID")}
                      </p>
                    </div>
                    <span className="text-xs font-medium text-slate-600">
                      {riskLabels[report.riskCategory]} ({report.riskScore}) &middot;{" "}
                      {statusLabels[report.status]}
                    </span>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>

        <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="font-semibold text-slate-900">Checklist Terbaru</h2>
          {summary.latestChecklistResults.length === 0 ? (
            <p className="mt-3 text-sm text-slate-500">
              Belum ada checklist atau akses dibatasi RLS.
            </p>
          ) : (
            <div className="mt-3 space-y-3">
              {summary.latestChecklistResults.map((checklist) => (
                <article
                  key={checklist.id}
                  className="rounded-md border border-slate-100 p-3"
                >
                  <div className="flex flex-wrap justify-between gap-2">
                    <div>
                      <p className="text-sm font-medium text-slate-900">
                        {checklist.template?.title ?? "Checklist K3"}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        {checklist.asset?.code ?? "Tanpa aset"} &middot;{" "}
                        {new Date(checklist.completedAt).toLocaleDateString("id-ID")}
                      </p>
                    </div>
                    <span className="text-xs font-medium text-slate-600">
                      {checklist.riskCategory
                        ? `${riskLabels[checklist.riskCategory]} (${checklist.riskScore})`
                        : "Tanpa temuan"}
                    </span>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>

        <p className="text-xs text-slate-400 print:text-black">
          Data audit mengikuti policy RLS untuk role yang sedang login.
        </p>
      </div>
    </AppShell>
  );
}
