"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  BadgeCheck,
  BarChart3,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  ClipboardCheck,
  Database,
  Download,
  FileCheck2,
  FileText,
  Filter,
  History,
  Loader2,
  Package,
  Printer,
  RefreshCw,
  Save,
  ShieldAlert,
  ShieldCheck,
  Siren,
  TimerReset,
  TrendingUp,
  Wrench,
} from "lucide-react";
import AppShell from "@/components/AppShell";
import {
  buildAuditView,
  createAuditSnapshot,
  fetchAuditData,
  getDefaultAuditPeriod,
  resolveAuditPreset,
  type AuditData,
  type AuditFindingClassification,
  type AuditFilters,
  type AuditPeriodPreset,
  type AuditRunStatus,
  type AuditView,
} from "@/lib/audit";
import { HAZARD_CATEGORY_LABELS, REPORT_TYPE_LABELS } from "@/lib/reports";
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

const findingStyles: Record<AuditFindingClassification, string> = {
  observation: "border-sky-200 bg-sky-50 text-sky-700",
  minor: "border-amber-200 bg-amber-50 text-amber-700",
  major: "border-orange-200 bg-orange-50 text-orange-700",
  critical: "border-red-200 bg-red-50 text-red-700",
};

const findingLabels: Record<AuditFindingClassification, string> = {
  observation: "Observasi",
  minor: "Minor",
  major: "Mayor",
  critical: "Kritis",
};

const runStatusLabels: Record<AuditRunStatus, string> = {
  draft: "Draf",
  reviewed: "Ditinjau",
  approved: "Disetujui",
};

function formatDate(value: string | null): string {
  if (!value) return "-";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "-"
    : date.toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" });
}

function formatHours(value: number | null): string {
  if (value === null) return "Belum cukup data";
  if (value < 24) return `${value.toFixed(1)} jam`;
  return `${(value / 24).toFixed(1)} hari`;
}

function formatPercent(value: number | null): string {
  return value === null ? "Belum cukup data" : `${value}%`;
}

function csvCell(value: string | number | boolean | null | undefined): string {
  const normalized = value === null || value === undefined ? "" : String(value);
  return `"${normalized.replace(/"/g, '""')}"`;
}

function exportAuditCsv(
  view: AuditView,
  filters: AuditFilters,
  laboratoryName: string,
  generatedBy: string,
): void {
  const columns = [
    "jenis_data", "id_sumber", "tanggal", "laboratorium", "aset", "lokasi",
    "kategori", "skor_risiko", "status", "pic", "tenggat", "catatan",
  ];
  const rows: Array<Array<string | number | boolean | null>> = [];
  const assetsById = new Map(view.assets.map((asset) => [asset.id, asset]));
  for (const asset of view.assets) {
    rows.push([
      "aset", asset.id, asset.lastInspectionAt, asset.laboratory?.name ?? "",
      `${asset.code} - ${asset.name}`, asset.location ?? "", asset.category ?? asset.kind,
      null, `${asset.status} / ${asset.operationalState}`, "PIC aset", asset.nextInspectionAt,
      asset.isolationReason ?? asset.description ?? "",
    ]);
  }
  for (const report of view.reports) {
    rows.push([
      "laporan", report.reportNumber, report.reportedAt, report.laboratory?.name ?? "",
      report.asset ? `${report.asset.code} - ${report.asset.name}` : "", report.location,
      `${REPORT_TYPE_LABELS[report.reportType]} / ${HAZARD_CATEGORY_LABELS[report.hazardCategory]}`,
      report.riskScore, statusLabels[report.status],
      report.isConfidential ? "Identitas dilindungi" : "Pelapor terotorisasi",
      null, `${report.title}: ${report.description}`,
    ]);
  }
  for (const checklist of view.checklists) {
    rows.push([
      "checklist", checklist.id, checklist.completedAt, checklist.laboratory?.name ?? "",
      checklist.asset ? `${checklist.asset.code} - ${checklist.asset.name}` : "",
      checklist.asset?.location ?? "",
      checklist.riskCategory ? riskLabels[checklist.riskCategory] : "Tanpa temuan",
      checklist.riskScore, checklist.hasRiskFinding ? "Ada temuan" : "Tidak ada temuan",
      checklist.inspector?.fullName ?? "", null, checklist.overallNote,
    ]);
  }
  for (const action of view.correctiveActions) {
    const asset = assetsById.get(action.assetId);
    rows.push([
      "tindakan_korektif", action.id, action.createdAt,
      asset?.laboratory?.name ?? laboratoryName,
      asset ? `${asset.code} - ${asset.name}` : action.assetId,
      asset?.location ?? "",
      action.controlHierarchy, null, action.status, action.assigneeName ?? "Belum ditetapkan",
      action.dueAt,
      `${action.description}${action.completionNote ? ` | ${action.completionNote}` : ""}`,
    ]);
  }
  for (const order of view.workOrders) {
    const asset = assetsById.get(order.assetId);
    rows.push([
      "perintah_kerja", order.number, order.openedAt,
      asset?.laboratory?.name ?? laboratoryName,
      asset ? `${asset.code} - ${asset.name}` : order.assetId,
      asset?.location ?? "",
      order.maintenanceType, null, order.status, "", order.scheduledAt, order.title,
    ]);
  }
  for (const certificate of view.certificates) {
    const asset = assetsById.get(certificate.assetId);
    rows.push([
      "sertifikat", certificate.id, certificate.expiresAt,
      asset?.laboratory?.name ?? laboratoryName,
      asset ? `${asset.code} - ${asset.name}` : certificate.assetId,
      asset?.location ?? "", certificate.type, null,
      certificate.expiresAt && new Date(certificate.expiresAt).getTime() < Date.now() ? "kedaluwarsa" : "berlaku",
      "", certificate.expiresAt, certificate.number,
    ]);
  }
  for (const finding of view.priorityFindings) {
    rows.push([
      "temuan_audit", finding.sourceId, finding.dueAt, finding.laboratoryName,
      finding.assetLabel, "", findingLabels[finding.classification], finding.riskScore,
      finding.status, finding.owner, finding.dueAt,
      `${finding.title}: ${finding.description} | ${finding.recommendation}`,
    ]);
  }
  const metadata = [
    ["VOCASAFE LAB - LAPORAN AUDIT K3 DIGITAL"],
    ["Dibuat oleh", generatedBy],
    ["Laboratorium", laboratoryName],
    ["Periode mulai", filters.periodStart || "Semua data"],
    ["Periode akhir", filters.periodEnd || "Semua data"],
    ["Status integritas", view.dataQualityIssues.length === 0 ? "Lengkap" : `Perlu verifikasi (${view.dataQualityIssues.length} isu)`],
    ["Catatan cakupan", "Laporan dan checklist mengikuti periode; kondisi aset, tindakan terbuka, perintah kerja, sertifikat, dan temuan aktif menunjukkan keadaan terkini."],
    [],
  ];
  const csv = "\uFEFF" + [
    ...metadata.map((row) => row.map(csvCell).join(",")),
    columns.map(csvCell).join(","),
    ...rows.map((row) => row.map(csvCell).join(",")),
  ].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  const safeLab = laboratoryName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "semua-lab";
  anchor.href = url;
  anchor.download = `vocasafe-audit-${safeLab}-${filters.periodEnd || new Date().toISOString().slice(0, 10)}.csv`;
  anchor.click();
  URL.revokeObjectURL(url);
}

function MetricCard({
  label,
  value,
  note,
  icon: Icon,
  tone = "emerald",
}: {
  label: string;
  value: string | number;
  note: string;
  icon: typeof Package;
  tone?: "emerald" | "amber" | "orange" | "red" | "sky";
}) {
  const tones = {
    emerald: "bg-emerald-100 text-emerald-700",
    amber: "bg-amber-100 text-amber-700",
    orange: "bg-orange-100 text-orange-700",
    red: "bg-red-100 text-red-700",
    sky: "bg-sky-100 text-sky-700",
  };
  return (
    <article className="min-w-0 rounded-[1.35rem] border border-white/70 bg-white/90 p-4 shadow-[0_18px_55px_-38px_rgba(15,23,42,0.8)] backdrop-blur-sm">
      <div className="flex items-start gap-3">
        <span className={`rounded-2xl p-2.5 ${tones[tone]}`}><Icon className="h-5 w-5" /></span>
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">{label}</p>
          <p className="mt-1 break-words text-2xl font-black tracking-tight text-slate-950">{value}</p>
          <p className="mt-1 text-xs leading-5 text-slate-500">{note}</p>
        </div>
      </div>
    </article>
  );
}

function DistributionCard({
  title,
  entries,
}: {
  title: string;
  entries: Array<{ label: string; value: number; color: string }>;
}) {
  const total = Math.max(1, entries.reduce((sum, entry) => sum + entry.value, 0));
  return (
    <section className="min-w-0 rounded-[1.5rem] border border-slate-200/80 bg-white/90 p-5 shadow-sm">
      <h2 className="font-bold text-slate-950">{title}</h2>
      <div className="mt-5 space-y-4">
        {entries.map((entry) => (
          <div key={entry.label}>
            <div className="flex items-center justify-between gap-3 text-sm">
              <span className="text-slate-600">{entry.label}</span>
              <span className="font-bold text-slate-950">{entry.value}</span>
            </div>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100">
              <div
                className={`h-full rounded-full ${entry.color}`}
                style={{ width: `${Math.max(entry.value > 0 ? 4 : 0, (entry.value / total) * 100)}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

export default function AuditPage() {
  const defaultPeriod = useMemo(() => getDefaultAuditPeriod(), []);
  const [data, setData] = useState<AuditData | null>(null);
  const [loading, setLoading] = useState(true);
  const [preset, setPreset] = useState<AuditPeriodPreset>("30d");
  const [filters, setFilters] = useState<AuditFilters>({ laboratoryId: "", ...defaultPeriod });
  const [actionMessage, setActionMessage] = useState("");
  const [savingSnapshot, setSavingSnapshot] = useState(false);
  const [scope, setScope] = useState("Evaluasi kinerja K3, kepatuhan aset, laporan bahaya, inspeksi, dan efektivitas tindak lanjut.");
  const [criteria, setCriteria] = useState("Panduan SMK3L Perguruan Tinggi 2024, PP 50 Tahun 2012, ISO 45004:2024");
  const [methodology, setMethodology] = useState("Telaah data digital, analisis tren, pemeriksaan temuan prioritas, dan verifikasi tindak lanjut.");

  const loadData = async () => {
    setLoading(true);
    const result = await fetchAuditData();
    setData(result);
    setFilters((current) => ({
      ...current,
      laboratoryId: current.laboratoryId || (result.user?.role === "admin" ? "" : result.user?.laboratoryId ?? ""),
    }));
    setLoading(false);
  };

  useEffect(() => {
    let active = true;
    void fetchAuditData().then((result) => {
      if (!active) return;
      setData(result);
      setFilters((current) => ({
        ...current,
        laboratoryId: current.laboratoryId || (result.user?.role === "admin" ? "" : result.user?.laboratoryId ?? ""),
      }));
      setLoading(false);
    });
    return () => { active = false; };
  }, []);

  const view = useMemo(() => data ? buildAuditView(data, filters) : null, [data, filters]);
  const selectedLab = data?.laboratories.find((lab) => lab.id === filters.laboratoryId);
  const laboratoryName = selectedLab?.name ?? (filters.laboratoryId ? "Laboratorium terotorisasi" : "Seluruh laboratorium yang dapat diakses");
  const sourceDataComplete = Boolean(data && data.errors.length === 0);
  const periodValid = !filters.periodStart || !filters.periodEnd || filters.periodStart <= filters.periodEnd;
  const auditReady = sourceDataComplete && periodValid;
  const canCreateGlobal = data?.user?.role === "admin";

  const handlePreset = (value: AuditPeriodPreset) => {
    setPreset(value);
    if (value !== "custom") setFilters((current) => ({ ...current, ...resolveAuditPreset(value) }));
  };

  const handleSnapshot = async () => {
    if (!view || !data) return;
    if (!auditReady) {
      setActionMessage(periodValid ? "Draf audit tidak disimpan karena sumber data belum lengkap." : "Draf audit tidak disimpan karena periode audit tidak valid.");
      return;
    }
    setSavingSnapshot(true);
    setActionMessage("");
    const result = await createAuditSnapshot({
      filters,
      scope,
      criteria: criteria.split(",").map((item) => item.trim()).filter(Boolean),
      methodology,
      dataComplete: sourceDataComplete,
      view,
    });
    setSavingSnapshot(false);
    setActionMessage(result.error ?? "Draf audit berhasil disimpan.");
    if (!result.error) await loadData();
  };

  if (loading || !data || !view) {
    return (
      <AppShell>
        <div className="flex min-h-[55vh] items-center justify-center">
          <div className="rounded-3xl border border-white/70 bg-white/85 px-6 py-5 text-center shadow-xl backdrop-blur-xl">
            <Loader2 className="mx-auto h-7 w-7 animate-spin text-emerald-600" />
            <p className="mt-3 text-sm font-medium text-slate-600">Menyusun bukti audit K3...</p>
          </div>
        </div>
      </AppShell>
    );
  }

  const maxTrend = Math.max(1, ...view.trends.flatMap((point) => [point.reports, point.checklists, point.highCritical]));

  return (
    <AppShell>
      <main className="min-w-0 space-y-6 pb-8 print:space-y-4">
        <header className="relative overflow-hidden rounded-[2rem] bg-[linear-gradient(135deg,#062f27_0%,#0a5748_55%,#0e7662_100%)] p-5 text-white shadow-[0_28px_80px_-42px_rgba(5,60,50,0.9)] sm:p-7 print:rounded-none print:bg-white print:p-0 print:text-black print:shadow-none">
          <div className="absolute -right-16 -top-16 h-52 w-52 rounded-full bg-emerald-300/15 blur-2xl print:hidden" />
          <div className="relative flex min-w-0 flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
            <div className="min-w-0">
              <div className="flex items-center gap-2 text-emerald-200 print:text-black">
                <ShieldCheck className="h-5 w-5" />
                <span className="text-xs font-bold uppercase tracking-[0.2em]">Kinerja dan kepastian K3</span>
              </div>
              <h1 className="mt-3 break-words text-2xl font-black tracking-tight sm:text-3xl">Audit K3 Digital</h1>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-emerald-50/80 print:text-black">
                Menilai efektivitas pengendalian, ketertelusuran temuan, kepatuhan aset, dan penyelesaian tindakan korektif—bukan sekadar menghitung kejadian.
              </p>
              <div className="mt-4 flex flex-wrap gap-2 text-xs">
                <span className="rounded-full bg-white/10 px-3 py-1.5">{laboratoryName}</span>
                <span className="rounded-full bg-white/10 px-3 py-1.5">{filters.periodStart || "Awal data"} — {filters.periodEnd || "Sekarang"}</span>
                <span className="rounded-full bg-white/10 px-3 py-1.5">Oleh {data.user?.fullName ?? "Pengguna terotorisasi"}</span>
              </div>
            </div>
            <div className="grid gap-2 min-[430px]:grid-cols-2 print:hidden">
              <button
                type="button"
                disabled={!auditReady}
                onClick={() => exportAuditCsv(view, filters, laboratoryName, data.user?.fullName ?? "Pengguna terotorisasi")}
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl bg-white px-4 py-2.5 text-sm font-bold text-emerald-900 shadow-sm transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-45"
              >
                <Download className="h-4 w-4" /> Unduh CSV
              </button>
              <button
                type="button"
                disabled={!auditReady}
                onClick={() => window.print()}
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl border border-white/25 bg-white/10 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-45"
              >
                <Printer className="h-4 w-4" /> Cetak / Simpan PDF
              </button>
            </div>
          </div>
        </header>

        {data.errors.length > 0 && (
          <section role="alert" className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800 print:border-2">
            <div className="flex items-start gap-3">
              <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
              <div>
                <p className="font-bold">Data audit belum lengkap—unduh, cetak, dan penyimpanan draf dinonaktifkan.</p>
                <ul className="mt-2 list-disc space-y-1 pl-5">{data.errors.map((error) => <li key={error}>{error}</li>)}</ul>
              </div>
            </div>
          </section>
        )}

        {!periodValid && <section role="alert" className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-800">Tanggal mulai tidak boleh melewati tanggal akhir. Unduh, cetak, dan penyimpanan draf dinonaktifkan.</section>}

        <section className="rounded-[1.5rem] border border-slate-200/80 bg-white/90 p-4 shadow-sm print:hidden sm:p-5">
          <div className="flex items-center gap-2"><Filter className="h-5 w-5 text-emerald-700" /><h2 className="font-bold text-slate-950">Ruang lingkup audit</h2></div>
          <div className="mt-4 grid min-w-0 gap-4 md:grid-cols-2 xl:grid-cols-4">
            <label className="min-w-0 text-sm font-semibold text-slate-700">
              Laboratorium
              <select
                value={filters.laboratoryId}
                onChange={(event) => setFilters((current) => ({ ...current, laboratoryId: event.target.value }))}
                className="mt-2 min-h-11 w-full min-w-0 rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-emerald-500"
              >
                {canCreateGlobal && <option value="">Seluruh lab terotorisasi</option>}
                {data.laboratories.map((lab) => <option key={lab.id} value={lab.id}>{lab.code} - {lab.name}</option>)}
              </select>
            </label>
            <label className="min-w-0 text-sm font-semibold text-slate-700">
              Periode cepat
              <select value={preset} onChange={(event) => handlePreset(event.target.value as AuditPeriodPreset)} className="mt-2 min-h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-emerald-500">
                <option value="30d">30 hari terakhir</option><option value="90d">90 hari terakhir</option><option value="year">Tahun berjalan</option><option value="all">Semua data</option><option value="custom">Rentang khusus</option>
              </select>
            </label>
            <label className="text-sm font-semibold text-slate-700">Mulai<input type="date" value={filters.periodStart} onChange={(event) => { setPreset("custom"); setFilters((current) => ({ ...current, periodStart: event.target.value })); }} className="mt-2 min-h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-emerald-500" /></label>
            <label className="text-sm font-semibold text-slate-700">Sampai<input type="date" value={filters.periodEnd} onChange={(event) => { setPreset("custom"); setFilters((current) => ({ ...current, periodEnd: event.target.value })); }} className="mt-2 min-h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-emerald-500" /></label>
          </div>
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4 text-xs text-slate-500">
            <span>Data ditampilkan sesuai cakupan akses Anda. Filter tanggal berlaku untuk laporan dan checklist; status aset serta antrean tindakan tetap menunjukkan kondisi terkini.</span>
            <button type="button" onClick={() => void loadData()} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 font-bold text-slate-700 hover:bg-slate-50"><RefreshCw className="h-4 w-4" /> Muat ulang</button>
          </div>
        </section>

        <section className="grid min-w-0 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard label="Aset dalam cakupan" value={view.metrics.totalAssets} note={`${view.metrics.restrictedAssets} dibatasi/tidak layak`} icon={Package} tone={view.metrics.restrictedAssets ? "red" : "emerald"} />
          <MetricCard label="Laporan periode" value={view.metrics.totalReports} note={`${view.metrics.openReports} belum selesai`} icon={FileText} tone={view.metrics.openReports ? "amber" : "emerald"} />
          <MetricCard label="Checklist periode" value={view.metrics.totalChecklists} note={`${view.metrics.pendingInspectionReviews} peninjauan masih menunggu`} icon={ClipboardCheck} tone="sky" />
          <MetricCard label="Risiko tinggi/kritis" value={view.metrics.highCriticalRisks} note={`${view.metrics.criticalRisks} kategori kritis`} icon={ShieldAlert} tone={view.metrics.criticalRisks ? "red" : "orange"} />
          <MetricCard label="Bahaya aktif" value={view.metrics.activeHazards} note="Belum dinyatakan terkendali" icon={Siren} tone={view.metrics.activeHazards ? "red" : "emerald"} />
          <MetricCard label="Tindakan terlambat" value={view.metrics.overdueActions} note={`${view.metrics.openActions} tindakan masih terbuka`} icon={TimerReset} tone={view.metrics.overdueActions ? "red" : "emerald"} />
          <MetricCard label="Inspeksi terlambat" value={view.metrics.overdueInspections} note={`${formatPercent(view.metrics.inspectionScheduleCompliance)} sesuai jadwal`} icon={CalendarDays} tone={view.metrics.overdueInspections ? "orange" : "emerald"} />
          <MetricCard label="Perintah kerja terbuka" value={view.metrics.openWorkOrders} note={`${view.metrics.expiredCertificates} sertifikat kedaluwarsa`} icon={Wrench} tone={view.metrics.expiredCertificates ? "red" : "amber"} />
        </section>

        <section className="grid min-w-0 gap-4 lg:grid-cols-2">
          <div className="min-w-0 rounded-[1.5rem] border border-slate-200/80 bg-white/90 p-5 shadow-sm">
            <div className="flex items-center gap-2"><TrendingUp className="h-5 w-5 text-emerald-700" /><h2 className="font-bold text-slate-950">Leading indicators</h2></div>
            <p className="mt-1 text-xs text-slate-500">Rolling enam bulan sampai akhir periode audit agar indikator tidak bias oleh sampel 30 hari yang terlalu kecil.</p>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              {[
                ["Median respons laporan", formatHours(view.metrics.medianResponseHours), "Kecepatan respons awal"],
                ["Median penyelesaian", formatHours(view.metrics.medianClosureHours), "Berdasarkan follow-up penutupan"],
                ["Tindakan tepat waktu", formatPercent(view.metrics.correctiveActionOnTimeRate), "Corrective action selesai sebelum due date"],
                ["Cakupan bukti", formatPercent(view.metrics.evidenceCoverage), "Risiko tinggi/kritis dan item gagal"],
              ].map(([label, value, note]) => (
                <article key={label} className="rounded-2xl bg-slate-50 p-4">
                  <p className="text-xs font-semibold text-slate-500">{label}</p><p className="mt-1 text-lg font-black text-slate-950">{value}</p><p className="mt-1 text-xs leading-5 text-slate-500">{note}</p>
                </article>
              ))}
            </div>
            <p className="mt-4 text-xs leading-5 text-slate-500">Nilai “belum cukup data” hanya tampil jika dalam enam bulan memang belum ada pasangan laporan–tindak lanjut atau tindakan selesai yang dapat dihitung.</p>
          </div>

          <div className="min-w-0 rounded-[1.5rem] border border-slate-200/80 bg-white/90 p-5 shadow-sm">
            <div className="flex items-center gap-2"><BarChart3 className="h-5 w-5 text-emerald-700" /><h2 className="font-bold text-slate-950">Tren enam bulan</h2></div>
            <p className="mt-1 text-xs text-slate-500">Selalu menampilkan enam bulan berjalan sesuai cakupan laboratorium, terpisah dari filter ringkasan periode.</p>
            <div className="mt-5 grid grid-cols-6 gap-2">
              {view.trends.map((point) => (
                <div key={point.key} className="min-w-0 text-center">
                  <div className="flex h-32 items-end justify-center gap-1 rounded-xl bg-slate-50 px-1 pb-2">
                    <div title={`${point.reports} laporan`} className="w-2 rounded-t bg-teal-500" style={{ height: `${Math.max(point.reports ? 8 : 0, (point.reports / maxTrend) * 100)}%` }} />
                    <div title={`${point.checklists} checklist`} className="w-2 rounded-t bg-sky-400" style={{ height: `${Math.max(point.checklists ? 8 : 0, (point.checklists / maxTrend) * 100)}%` }} />
                    <div title={`${point.highCritical} risiko tinggi/kritis`} className="w-2 rounded-t bg-red-500" style={{ height: `${Math.max(point.highCritical ? 8 : 0, (point.highCritical / maxTrend) * 100)}%` }} />
                  </div>
                  <p className="mt-2 truncate text-[10px] font-semibold text-slate-500">{point.label}</p>
                </div>
              ))}
            </div>
            <div className="mt-4 flex flex-wrap gap-3 text-xs text-slate-500"><span><i className="mr-1 inline-block h-2 w-2 rounded-full bg-teal-500" />Laporan</span><span><i className="mr-1 inline-block h-2 w-2 rounded-full bg-sky-400" />Checklist</span><span><i className="mr-1 inline-block h-2 w-2 rounded-full bg-red-500" />Tinggi/kritis</span></div>
          </div>
        </section>

        <section className="grid min-w-0 gap-4 md:grid-cols-2 xl:grid-cols-4">
          <DistributionCard title="Risiko laporan" entries={Object.entries(view.reportRisk).map(([risk, value]) => ({ label: riskLabels[risk as RiskLevel], value, color: risk === "kritis" ? "bg-red-500" : risk === "tinggi" ? "bg-orange-500" : risk === "sedang" ? "bg-amber-400" : "bg-emerald-500" }))} />
          <DistributionCard title="Status laporan" entries={Object.entries(view.reportStatus).map(([status, value]) => ({ label: statusLabels[status as ReportStatus], value, color: status === "selesai" ? "bg-emerald-500" : status === "ditolak" ? "bg-slate-500" : status === "dalam_penanganan" ? "bg-orange-500" : "bg-sky-500" }))} />
          <DistributionCard title="Risiko checklist" entries={Object.entries(view.checklistRisk).map(([risk, value]) => ({ label: riskLabels[risk as RiskLevel], value, color: risk === "kritis" ? "bg-red-500" : risk === "tinggi" ? "bg-orange-500" : risk === "sedang" ? "bg-amber-400" : "bg-emerald-500" }))} />
          <DistributionCard title="Status aset" entries={Object.entries(view.assetStatus).map(([status, value]) => ({ label: status === "layak" ? "Layak" : status === "perlu_dicek" ? "Perlu dicek" : "Tidak layak", value, color: status === "layak" ? "bg-emerald-500" : status === "perlu_dicek" ? "bg-amber-400" : "bg-red-500" }))} />
        </section>

        <section className="min-w-0 rounded-[1.5rem] border border-slate-200/80 bg-white/95 p-5 shadow-sm sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div><p className="text-xs font-bold uppercase tracking-[0.18em] text-red-600">Perlu tindakan</p><h2 className="mt-1 text-xl font-black text-slate-950">Temuan prioritas</h2><p className="mt-1 text-sm text-slate-500">Mencakup bahaya aktif dan tindakan terbuka di seluruh cakupan; diurutkan berdasarkan klasifikasi dan tenggat.</p></div>
            <span className="rounded-full bg-red-50 px-3 py-1.5 text-xs font-bold text-red-700">{view.priorityFindings.length} temuan</span>
          </div>
          {view.priorityFindings.length === 0 ? (
            <div className="mt-5 flex items-center gap-3 rounded-2xl bg-emerald-50 p-4 text-sm text-emerald-800"><CheckCircle2 className="h-5 w-5 shrink-0" />Tidak ada temuan aktif atau tindakan terbuka pada cakupan ini.</div>
          ) : (
            <div className="mt-5 grid min-w-0 gap-3 xl:grid-cols-2">
              {view.priorityFindings.slice(0, 12).map((finding) => (
                <article key={finding.id} className="min-w-0 rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
                  <div className="flex min-w-0 flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0"><span className={`inline-flex rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-wider ${findingStyles[finding.classification]}`}>{findingLabels[finding.classification]}</span><h3 className="mt-2 break-words font-bold text-slate-950">{finding.title}</h3></div>
                    {finding.riskScore !== null && <span className="rounded-xl bg-white px-3 py-2 text-sm font-black text-red-700 shadow-sm">{finding.riskScore}</span>}
                  </div>
                  <p className="mt-2 line-clamp-3 break-words text-sm leading-6 text-slate-600">{finding.description}</p>
                  <dl className="mt-3 grid gap-2 text-xs text-slate-500 sm:grid-cols-2">
                    <div><dt className="font-semibold text-slate-700">Aset</dt><dd className="break-words">{finding.assetLabel}</dd></div><div><dt className="font-semibold text-slate-700">PIC</dt><dd className="break-words">{finding.owner}</dd></div><div><dt className="font-semibold text-slate-700">Status</dt><dd>{finding.status.replaceAll("_", " ")}</dd></div><div><dt className="font-semibold text-slate-700">Tenggat</dt><dd>{formatDate(finding.dueAt)}</dd></div>
                  </dl>
                  <p className="mt-3 rounded-xl bg-white p-3 text-xs leading-5 text-slate-600"><strong className="text-slate-800">Arah pengendalian:</strong> {finding.recommendation}</p>
                  {finding.href && <Link href={finding.href} className="mt-3 inline-flex items-center gap-1 text-xs font-bold text-emerald-700 print:hidden">Buka sumber <ChevronRight className="h-3.5 w-3.5" /></Link>}
                </article>
              ))}
            </div>
          )}
        </section>

        <section className="grid min-w-0 gap-4 lg:grid-cols-2">
          <div className="min-w-0 rounded-[1.5rem] border border-emerald-200 bg-emerald-50/75 p-5">
            <div className="flex items-center gap-2"><BadgeCheck className="h-5 w-5 text-emerald-700" /><h2 className="font-bold text-emerald-950">Rekomendasi audit</h2></div>
            <ol className="mt-4 space-y-3">{view.recommendations.map((recommendation, index) => <li key={recommendation} className="flex gap-3 text-sm leading-6 text-emerald-950"><span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-700 text-xs font-black text-white">{index + 1}</span><span>{recommendation}</span></li>)}</ol>
          </div>
          <div className="min-w-0 rounded-[1.5rem] border border-slate-200 bg-white/90 p-5">
            <div className="flex items-center gap-2"><Database className="h-5 w-5 text-slate-700" /><h2 className="font-bold text-slate-950">Integritas dan kualitas data</h2></div>
            <div className={`mt-4 rounded-2xl p-4 text-sm ${sourceDataComplete && view.dataQualityIssues.length === 0 ? "bg-emerald-50 text-emerald-800" : "bg-amber-50 text-amber-800"}`}>
              <p className="font-bold">{sourceDataComplete ? "Semua sumber data berhasil dimuat." : "Ada sumber data yang gagal dimuat."}</p>
              <p className="mt-1 text-xs leading-5">Audit tidak mengubah skor risiko. Pemeriksaan konsistensi selalu memakai severity × probability × exposure dan threshold aplikasi.</p>
            </div>
            {view.dataQualityIssues.length > 0 ? <ul className="mt-4 max-h-48 space-y-2 overflow-auto text-xs text-slate-600">{view.dataQualityIssues.map((issue) => <li key={issue} className="rounded-xl bg-slate-50 p-3">{issue}</li>)}</ul> : <p className="mt-4 text-sm text-slate-500">Tidak ditemukan inkonsistensi skor atau konteks utama pada cakupan ini.</p>}
          </div>
        </section>

        <section className="min-w-0 rounded-[1.5rem] border border-slate-200 bg-white/95 p-5 shadow-sm print:hidden sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div><div className="flex items-center gap-2"><FileCheck2 className="h-5 w-5 text-emerald-700" /><h2 className="font-bold text-slate-950">Arsip dan persetujuan audit</h2></div><p className="mt-1 text-sm text-slate-500">Simpan kondisi audit agar hasil sebelumnya tidak berubah mengikuti data operasional.</p></div>
            {!data.auditStorageAvailable && <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-bold text-amber-800">Penyimpanan arsip belum tersedia</span>}
          </div>
          <div className="mt-5 grid min-w-0 gap-5 xl:grid-cols-[1.1fr_0.9fr]">
            <div className="min-w-0 space-y-4 rounded-2xl bg-slate-50 p-4">
              <label className="block text-sm font-semibold text-slate-700">Ruang lingkup<textarea value={scope} onChange={(event) => setScope(event.target.value)} rows={2} className="mt-2 w-full resize-y rounded-xl border border-slate-200 bg-white p-3 text-sm outline-none focus:border-emerald-500" /></label>
              <label className="block text-sm font-semibold text-slate-700">Kriteria audit<input value={criteria} onChange={(event) => setCriteria(event.target.value)} className="mt-2 min-h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-emerald-500" /></label>
              <label className="block text-sm font-semibold text-slate-700">Metodologi<textarea value={methodology} onChange={(event) => setMethodology(event.target.value)} rows={2} className="mt-2 w-full resize-y rounded-xl border border-slate-200 bg-white p-3 text-sm outline-none focus:border-emerald-500" /></label>
              <button type="button" disabled={!data.auditStorageAvailable || !auditReady || savingSnapshot || !scope.trim() || !methodology.trim()} onClick={() => void handleSnapshot()} className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-emerald-700 px-4 py-2.5 text-sm font-bold text-white hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-45"><Save className="h-4 w-4" />{savingSnapshot ? "Menyimpan..." : "Simpan Draf Audit"}</button>
              {actionMessage && <p role="status" className="rounded-xl bg-white p-3 text-xs font-medium text-slate-700">{actionMessage}</p>}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2"><History className="h-4 w-4 text-slate-600" /><h3 className="text-sm font-bold text-slate-900">Riwayat audit</h3></div>
              {data.auditRuns.length === 0 ? <p className="mt-4 rounded-2xl border border-dashed border-slate-200 p-5 text-center text-sm text-slate-500">Belum ada arsip audit yang dapat ditampilkan.</p> : <div className="mt-3 space-y-3">{data.auditRuns.map((run) => (
                <article key={run.id} className="min-w-0 rounded-2xl border border-slate-200 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-2"><div className="min-w-0"><p className="break-all text-xs font-black text-slate-900">{run.auditNumber}</p><p className="mt-1 text-xs text-slate-500">{run.laboratoryName ?? "Semua lab"} · {formatDate(run.generatedAt)}</p></div><span className={`rounded-full px-2.5 py-1 text-[10px] font-black ${run.status === "approved" ? "bg-emerald-100 text-emerald-700" : run.status === "reviewed" ? "bg-sky-100 text-sky-700" : "bg-slate-100 text-slate-600"}`}>{runStatusLabels[run.status]}</span></div>
                  <p className="mt-2 line-clamp-2 text-xs leading-5 text-slate-600">{run.scope}</p>
                  <Link href={`/audit/${run.id}`} className="mt-3 inline-flex items-center gap-1 text-xs font-bold text-emerald-700">Tinjau audit <ChevronRight className="h-3.5 w-3.5" /></Link>
                </article>
              ))}</div>}
            </div>
          </div>
        </section>

        <section className="grid min-w-0 gap-4 lg:grid-cols-2">
          <div className="min-w-0 rounded-[1.5rem] border border-slate-200 bg-white/90 p-5"><h2 className="font-bold text-slate-950">Jejak laporan terbaru</h2><div className="mt-4 space-y-3">{view.reports.slice(0, 5).map((report) => <Link key={report.id} href={`/reports/${report.id}`} className="flex min-w-0 items-center justify-between gap-3 rounded-2xl bg-slate-50 p-3 print:block"><div className="min-w-0"><p className="truncate text-sm font-bold text-slate-900">{report.reportNumber} · {report.title}</p><p className="mt-1 text-xs text-slate-500">{formatDate(report.reportedAt)} · {report.laboratory?.name ?? report.location}</p></div><ChevronRight className="h-4 w-4 shrink-0 text-slate-400 print:hidden" /></Link>)}{view.reports.length === 0 && <p className="text-sm text-slate-500">Tidak ada laporan pada periode ini.</p>}</div></div>
          <div className="min-w-0 rounded-[1.5rem] border border-slate-200 bg-white/90 p-5"><h2 className="font-bold text-slate-950">Jejak checklist terbaru</h2><div className="mt-4 space-y-3">{view.checklists.slice(0, 5).map((checklist) => <Link key={checklist.id} href={`/checklists/${checklist.id}`} className="flex min-w-0 items-center justify-between gap-3 rounded-2xl bg-slate-50 p-3 print:block"><div className="min-w-0"><p className="truncate text-sm font-bold text-slate-900">{checklist.template?.title ?? "Checklist K3"}</p><p className="mt-1 text-xs text-slate-500">{formatDate(checklist.completedAt)} · {checklist.inspector?.fullName ?? "Pemeriksa"}</p></div><ChevronRight className="h-4 w-4 shrink-0 text-slate-400 print:hidden" /></Link>)}{view.checklists.length === 0 && <p className="text-sm text-slate-500">Tidak ada checklist pada periode ini.</p>}</div></div>
        </section>

        <footer className="rounded-2xl border border-slate-200 bg-white/70 p-4 text-xs leading-5 text-slate-500 print:border-t print:bg-white print:text-black">
          <div className="flex flex-wrap items-center justify-between gap-2"><span>Laporan audit sementara</span><span>Diperbarui {new Date(data.summary.updatedAt).toLocaleString("id-ID")}</span></div>
          <p className="mt-2">Data ditampilkan sesuai cakupan akses pengguna. Simpan draf audit sebelum melakukan peninjauan dan persetujuan. Rekomendasi menerapkan urutan eliminasi, substitusi, rekayasa teknik, administratif, dan APD.</p>
        </footer>
      </main>
    </AppShell>
  );
}
