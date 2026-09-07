"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Activity,
  AlertCircle,
  AlertTriangle,
  ArrowUpRight,
  BarChart3,
  Building2,
  CalendarClock,
  CheckCircle2,
  ClipboardCheck,
  Clock3,
  FileWarning,
  Gauge,
  Loader2,
  Package,
  RefreshCw,
  ScanLine,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  UserRoundCheck,
  Wrench,
  type LucideIcon,
} from "lucide-react";
import AppShell from "@/components/AppShell";
import { getCurrentUserProfile, getRoleLabel } from "@/lib/auth";
import { fetchSupabaseSummary, type SupabaseSummary } from "@/lib/summary";
import type { AppUser, ReportStatus, RiskLevel, UserRole } from "@/types";

type PeriodKey = "today" | "7" | "30" | "365" | "all";

interface DashboardStat {
  label: string;
  value: number | string;
  note: string;
  icon: LucideIcon;
  accent: string;
  surface: string;
}

interface PriorityItem {
  id: string;
  title: string;
  detail: string;
  href: string;
  label: string;
  tone: string;
  icon: LucideIcon;
}

const DAY_MS = 86_400_000;

const periodOptions: Array<{ key: PeriodKey; label: string }> = [
  { key: "today", label: "Hari ini" },
  { key: "7", label: "7 hari" },
  { key: "30", label: "30 hari" },
  { key: "365", label: "1 tahun" },
  { key: "all", label: "Semua" },
];

const riskColors: Record<RiskLevel, string> = {
  rendah: "bg-emerald-100 text-emerald-800",
  sedang: "bg-yellow-100 text-yellow-800",
  tinggi: "bg-orange-100 text-orange-800",
  kritis: "bg-red-100 text-red-800",
};

const riskBars: Record<RiskLevel, string> = {
  rendah: "bg-emerald-500",
  sedang: "bg-yellow-400",
  tinggi: "bg-orange-500",
  kritis: "bg-red-500",
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

const roleCopy: Record<UserRole, {
  eyebrow: string;
  title: string;
  description: string;
  primary: { href: string; label: string };
  secondary: { href: string; label: string };
}> = {
  mahasiswa: {
    eyebrow: "Keselamatan praktikum",
    title: "Pastikan area dan aset aman sebelum mulai",
    description: "Lihat pembatasan penggunaan, pantau laporan Anda, dan scan QR sebelum memakai alat laboratorium.",
    primary: { href: "/scan", label: "Scan aset" },
    secondary: { href: "/reports/new", label: "Laporkan bahaya" },
  },
  dosen: {
    eyebrow: "Kesiapan praktikum",
    title: "Pastikan kegiatan dimulai dengan pengendalian yang siap",
    description: "Tinjau bahaya aktif, kondisi aset, dan inspeksi K3 sebelum mahasiswa memasuki area praktik.",
    primary: { href: "/checklists/new", label: "Isi checklist" },
    secondary: { href: "/reports/new", label: "Buat laporan" },
  },
  teknisi: {
    eyebrow: "Antrean operasional K3",
    title: "Tangani risiko yang paling mendesak lebih dulu",
    description: "Prioritaskan bahaya aktif, inspeksi terlambat, perintah kerja, dan peninjauan kondisi aset.",
    primary: { href: "/reports", label: "Tinjau laporan" },
    secondary: { href: "/assets", label: "Kelola kondisi aset" },
  },
  kepala_lab: {
    eyebrow: "Kinerja keselamatan laboratorium",
    title: "Arahkan tindakan dari indikator yang dapat ditindaklanjuti",
    description: "Pantau risiko aktif, penyelesaian laporan, kesiapan aset, dan bukti inspeksi untuk tinjauan manajemen.",
    primary: { href: "/audit", label: "Buka laporan audit" },
    secondary: { href: "/reports", label: "Tinjau laporan" },
  },
  admin: {
    eyebrow: "Pemantauan keselamatan lintas laboratorium",
    title: "Jaga data, akses, dan operasi K3 tetap terkendali",
    description: "Lihat gambaran menyeluruh sesuai kewenangan Anda, lalu telusuri risiko dan kualitas data yang memerlukan perhatian.",
    primary: { href: "/admin", label: "Kelola data dasar" },
    secondary: { href: "/audit", label: "Buka audit" },
  },
};

function getPeriodBounds(period: PeriodKey, now: Date) {
  if (period === "all") return { start: null, previousStart: null, previousEnd: null };

  if (period === "today") {
    const start = new Date(now);
    start.setHours(0, 0, 0, 0);
    return {
      start: start.getTime(),
      previousStart: start.getTime() - DAY_MS,
      previousEnd: start.getTime(),
    };
  }

  const duration = Number(period) * DAY_MS;
  const start = now.getTime() - duration;
  return {
    start,
    previousStart: start - duration,
    previousEnd: start,
  };
}

function isWithin(timestamp: string, start: number | null, end: number) {
  if (start === null) return true;
  const value = new Date(timestamp).getTime();
  return !Number.isNaN(value) && value >= start && value < end;
}

function emptyRiskSummary(): Record<RiskLevel, number> {
  return { rendah: 0, sedang: 0, tinggi: 0, kritis: 0 };
}

function emptyStatusSummary(): Record<ReportStatus, number> {
  return { baru: 0, diverifikasi: 0, dalam_penanganan: 0, selesai: 0, ditolak: 0 };
}

function deltaLabel(current: number, previous: number, period: PeriodKey) {
  if (period === "all") return "Seluruh data yang dapat diakses";
  const delta = current - previous;
  if (delta === 0) return "Sama dengan periode sebelumnya";
  return `${delta > 0 ? "+" : ""}${delta} dibanding periode sebelumnya`;
}

function formatUpdatedAt(value: string) {
  return new Date(value).toLocaleString("id-ID", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export default function DashboardPage() {
  const [summary, setSummary] = useState<SupabaseSummary | null>(null);
  const [profile, setProfile] = useState<AppUser | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [period, setPeriod] = useState<PeriodKey>("30");

  const loadDashboard = useCallback(async (manual = false) => {
    if (manual) setRefreshing(true);

    const [summaryResult, profileResult] = await Promise.all([
      fetchSupabaseSummary(),
      getCurrentUserProfile(),
    ]);

    setSummary(summaryResult.summary);
    setProfile(profileResult.user);
    setErrors([
      ...summaryResult.errors,
      ...(profileResult.error ? ["Profil dan cakupan akses belum dapat dikonfirmasi."] : []),
    ]);
    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => void loadDashboard(), 0);
    return () => clearTimeout(timer);
  }, [loadDashboard]);

  const analytics = useMemo(() => {
    if (!summary) return null;

    const now = new Date();
    const end = now.getTime() + 1;
    const bounds = getPeriodBounds(period, now);
    const reports = summary.reports.filter((report) =>
      isWithin(report.reportedAt, bounds.start, end),
    );
    const checklists = summary.checklistResults.filter((checklist) =>
      isWithin(checklist.completedAt, bounds.start, end),
    );
    const previousReports = bounds.previousStart === null || bounds.previousEnd === null
      ? []
      : summary.reports.filter((report) =>
          isWithin(report.reportedAt, bounds.previousStart, bounds.previousEnd),
        );
    const previousChecklists = bounds.previousStart === null || bounds.previousEnd === null
      ? []
      : summary.checklistResults.filter((checklist) =>
          isWithin(checklist.completedAt, bounds.previousStart, bounds.previousEnd),
        );

    const reportRisk = emptyRiskSummary();
    const reportStatus = emptyStatusSummary();
    for (const report of reports) {
      reportRisk[report.riskCategory] += 1;
      reportStatus[report.status] += 1;
    }

    const checklistHighOrCritical = checklists.filter(
      (item) => item.riskCategory === "tinggi" || item.riskCategory === "kritis",
    ).length;
    const previousHighOrCritical = previousReports.filter(
      (item) => item.riskCategory === "tinggi" || item.riskCategory === "kritis",
    ).length + previousChecklists.filter(
      (item) => item.riskCategory === "tinggi" || item.riskCategory === "kritis",
    ).length;
    const highOrCritical = reportRisk.tinggi + reportRisk.kritis + checklistHighOrCritical;
    const actionableReports = reports.filter((report) => report.status !== "ditolak");
    const closureRate = actionableReports.length === 0
      ? 0
      : Math.round((reportStatus.selesai / actionableReports.length) * 100);

    return {
      reports,
      checklists,
      previousReports,
      previousChecklists,
      reportRisk,
      reportStatus,
      highOrCritical,
      previousHighOrCritical,
      closureRate,
    };
  }, [period, summary]);

  const scopeLabel = useMemo(() => {
    if (!profile || !summary) return "Cakupan akses belum tersedia";
    if (profile.role === "admin") return "Semua laboratorium yang dapat diakses";

    const laboratory = summary.assets.find(
      (asset) => asset.laboratoryId === profile.laboratoryId,
    )?.laboratory ?? summary.reports.find(
      (report) => report.laboratoryId === profile.laboratoryId,
    )?.laboratory;

    const laboratoryLabel = laboratory?.name ?? (profile.laboratoryId
      ? "laboratorium yang ditugaskan"
      : "area yang diizinkan");

    if (profile.role === "mahasiswa") return `Laporan saya + aset ${laboratoryLabel}`;
    if (profile.role === "dosen") return `Laporan/checklist saya + aset ${laboratoryLabel}`;
    return laboratory?.name ?? "Laboratorium yang ditugaskan";
  }, [profile, summary]);

  const roleStats = useMemo<DashboardStat[]>(() => {
    if (!summary || !profile || !analytics) return [];

    const complianceTotal = summary.compliance.expiredCertificates
      + summary.compliance.certificatesDueSoon
      + summary.compliance.openWorkOrders
      + summary.compliance.pendingReviews;
    const common = {
      red: { accent: "from-orange-500 to-red-600", surface: "bg-red-50 text-red-700" },
      amber: { accent: "from-amber-400 to-orange-600", surface: "bg-amber-50 text-amber-700" },
      emerald: { accent: "from-emerald-500 to-teal-700", surface: "bg-emerald-50 text-emerald-700" },
      blue: { accent: "from-sky-500 to-indigo-600", surface: "bg-sky-50 text-sky-700" },
    };

    if (profile.role === "mahasiswa") {
      return [
        { label: "Bahaya aktif", value: summary.activeHazards.length, note: "Dalam cakupan akses Anda", icon: ShieldAlert, ...common.red },
        { label: "Aset dibatasi", value: summary.restrictedAssets.length, note: "Jangan digunakan tanpa izin", icon: Package, ...common.amber },
        { label: "Laporan belum selesai", value: summary.openReports, note: "Pantau respons dan tindak lanjut", icon: FileWarning, ...common.blue },
        { label: "Aset layak", value: summary.assetStatus.layak, note: "Tetap verifikasi melalui QR", icon: ShieldCheck, ...common.emerald },
      ];
    }

    if (profile.role === "dosen") {
      return [
        { label: "Bahaya aktif", value: summary.activeHazards.length, note: "Periksa sebelum praktikum", icon: ShieldAlert, ...common.red },
        { label: "Aset dibatasi", value: summary.restrictedAssets.length, note: "Tidak siap digunakan normal", icon: Package, ...common.amber },
        { label: "Checklist periode", value: analytics.checklists.length, note: "Inspeksi yang terdokumentasi", icon: ClipboardCheck, ...common.blue },
        { label: "Temuan inspeksi prioritas", value: analytics.checklists.filter((item) => item.riskCategory === "tinggi" || item.riskCategory === "kritis").length, note: "Tinggi atau kritis", icon: AlertTriangle, ...common.red },
      ];
    }

    if (profile.role === "teknisi") {
      return [
        { label: "Risiko aktif prioritas", value: summary.activeHighOrCriticalReports.length, note: "Bahaya tinggi atau kritis", icon: AlertTriangle, ...common.red },
        { label: "Inspeksi terlambat", value: summary.overdueInspections.length, note: "Melewati jadwal berikutnya", icon: CalendarClock, ...common.amber },
        { label: "Perintah kerja terbuka", value: summary.compliance.openWorkOrders, note: "Perlu penyelesaian atau verifikasi", icon: Wrench, ...common.blue },
        { label: "Review menunggu", value: summary.compliance.pendingReviews, note: "Rekomendasi inspeksi aset", icon: UserRoundCheck, ...common.emerald },
      ];
    }

    if (profile.role === "kepala_lab") {
      return [
        { label: "Risiko aktif prioritas", value: summary.activeHighOrCriticalReports.length, note: "Tinggi atau kritis dan belum selesai", icon: AlertTriangle, ...common.red },
        { label: "Laporan belum selesai", value: summary.openReports, note: "Baru, diverifikasi, atau ditangani", icon: FileWarning, ...common.blue },
        { label: "Aset dibatasi", value: summary.restrictedAssets.length, note: "Penggunaan tidak normal", icon: Package, ...common.amber },
        { label: "Sertifikat perlu perhatian", value: summary.compliance.expiredCertificates + summary.compliance.certificatesDueSoon, note: "Kedaluwarsa atau jatuh tempo 30 hari", icon: Gauge, ...common.red },
      ];
    }

    return [
      { label: "Total aset", value: summary.assets.length, note: scopeLabel, icon: Building2, ...common.emerald },
      { label: "Risiko aktif prioritas", value: summary.activeHighOrCriticalReports.length, note: "Tinggi atau kritis dan belum selesai", icon: AlertTriangle, ...common.red },
      { label: "Laporan belum selesai", value: summary.openReports, note: "Dalam seluruh cakupan akses", icon: FileWarning, ...common.blue },
      { label: "Tindak lanjut compliance", value: complianceTotal, note: "Sertifikat, WO, dan review", icon: Wrench, ...common.amber },
    ];
  }, [analytics, profile, scopeLabel, summary]);

  const priorities = useMemo<PriorityItem[]>(() => {
    if (!summary || !profile) return [];

    const items: PriorityItem[] = [];
    const restrictedIds = new Set(summary.restrictedAssets.map((asset) => asset.id));

    for (const report of summary.activeHighOrCriticalReports.slice(0, 3)) {
      items.push({
        id: `report-${report.id}`,
        title: report.title,
        detail: `${report.asset?.code ?? "Area umum"} · ${report.location}`,
        href: `/reports/${report.id}`,
        label: `${riskLabels[report.riskCategory]} aktif`,
        tone: riskColors[report.riskCategory],
        icon: FileWarning,
      });
    }

    for (const asset of summary.restrictedAssets.slice(0, 3)) {
      items.push({
        id: `restricted-${asset.id}`,
        title: asset.name,
        detail: `${asset.code} · ${asset.location ?? "Lokasi belum dicatat"}`,
        href: `/assets/${asset.code}`,
        label: asset.operationalState.replaceAll("_", " "),
        tone: "bg-amber-100 text-amber-800",
        icon: ShieldAlert,
      });
    }

    for (const asset of summary.overdueInspections.filter((item) => !restrictedIds.has(item.id)).slice(0, 2)) {
      items.push({
        id: `inspection-${asset.id}`,
        title: `Inspeksi ${asset.name} terlambat`,
        detail: `${asset.code} · jatuh tempo ${new Date(asset.nextInspectionAt ?? "").toLocaleDateString("id-ID")}`,
        href: `/assets/${asset.code}`,
        label: "Lewat jadwal",
        tone: "bg-orange-100 text-orange-800",
        icon: CalendarClock,
      });
    }

    if (["teknisi", "kepala_lab", "admin"].includes(profile.role)) {
      if (summary.compliance.expiredCertificates > 0) {
        items.push({
          id: "expired-certificates",
          title: `${summary.compliance.expiredCertificates} sertifikat atau kalibrasi kedaluwarsa`,
          detail: "Tinjau dokumen dan batasi penggunaan jika persyaratan belum terpenuhi.",
          href: "/assets",
          label: "Compliance",
          tone: "bg-red-100 text-red-800",
          icon: AlertCircle,
        });
      }
      if (summary.compliance.openWorkOrders > 0) {
        items.push({
          id: "open-work-orders",
          title: `${summary.compliance.openWorkOrders} perintah kerja masih terbuka`,
          detail: "Pastikan pekerjaan dan verifikasi return-to-service terdokumentasi.",
          href: "/assets",
          label: "Pemeliharaan",
          tone: "bg-sky-100 text-sky-800",
          icon: Wrench,
        });
      }
    }

    return items.slice(0, 6);
  }, [profile, summary]);

  if (!loading && !profile) {
    return (
      <AppShell>
        <div className="soft-card mx-auto max-w-xl rounded-[28px] border border-amber-200 bg-amber-50/90 p-6 text-amber-950">
          <AlertCircle className="h-7 w-7 text-amber-700" />
          <h1 className="mt-4 text-xl font-bold">Profil dashboard belum dapat dimuat</h1>
          <p className="mt-2 text-sm leading-6 text-amber-800">Periksa koneksi lalu muat ulang. Dashboard tidak akan menebak role atau cakupan data Anda.</p>
          <button type="button" onClick={() => void loadDashboard(true)} className="mt-5 inline-flex min-h-11 items-center gap-2 rounded-xl bg-amber-900 px-4 text-sm font-semibold text-white"><RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />Coba lagi</button>
        </div>
      </AppShell>
    );
  }

  if (loading || !summary || !profile || !analytics) {
    return (
      <AppShell>
        <div className="flex min-h-[60vh] items-center justify-center">
          <div className="premium-surface flex items-center gap-3 rounded-3xl px-6 py-4 text-sm font-medium text-emerald-950">
            <Loader2 className="h-5 w-5 animate-spin text-emerald-600" />
            Menyiapkan dashboard sesuai peran Anda...
          </div>
        </div>
      </AppShell>
    );
  }

  const copy = roleCopy[profile.role];
  const totalReportRisk = Object.values(analytics.reportRisk).reduce((total, value) => total + value, 0);
  const periodLabel = periodOptions.find((item) => item.key === period)?.label ?? "Periode";
  const analyticalCards = [
    { label: "Laporan masuk", value: analytics.reports.length, note: deltaLabel(analytics.reports.length, analytics.previousReports.length, period), icon: FileWarning },
    { label: "Checklist selesai", value: analytics.checklists.length, note: deltaLabel(analytics.checklists.length, analytics.previousChecklists.length, period), icon: ClipboardCheck },
    { label: "Temuan tinggi/kritis", value: analytics.highOrCritical, note: deltaLabel(analytics.highOrCritical, analytics.previousHighOrCritical, period), icon: AlertTriangle },
    { label: "Penyelesaian laporan", value: `${analytics.closureRate}%`, note: "Selesai dari laporan non-ditolak pada periode", icon: CheckCircle2 },
  ];

  return (
    <AppShell>
      <div className="min-w-0 space-y-5 sm:space-y-6">
        <section className="fade-up relative overflow-hidden rounded-[28px] bg-[#102c23] p-5 text-white shadow-[0_28px_70px_rgba(16,44,35,0.18)] sm:rounded-[32px] sm:p-7 lg:p-8">
          <div className="pointer-events-none absolute -right-16 -top-28 h-80 w-80 rounded-full bg-emerald-400/20 blur-3xl" />
          <div className="pointer-events-none absolute bottom-[-11rem] right-[26%] h-80 w-80 rounded-full bg-violet-400/15 blur-3xl" />
          <div className="relative grid gap-7 lg:grid-cols-[1fr_0.7fr] lg:items-center">
            <div className="min-w-0">
              <div className="flex flex-wrap gap-2">
                <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.07] px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.14em] text-emerald-200 backdrop-blur-lg"><Sparkles className="h-3.5 w-3.5" />{copy.eyebrow}</span>
                <span className="inline-flex max-w-full items-center gap-2 rounded-full border border-white/10 bg-white/[0.07] px-3 py-1.5 text-[10px] font-semibold text-white/75 backdrop-blur-lg"><Building2 className="h-3.5 w-3.5 shrink-0" /><span className="truncate">{scopeLabel}</span></span>
              </div>
              <h1 className="mt-5 max-w-3xl text-2xl font-semibold leading-tight tracking-[-0.045em] sm:text-4xl">{copy.title}</h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-emerald-50/70">{copy.description}</p>
              <div className="mt-6 flex flex-wrap gap-3">
                <Link href={copy.primary.href} className="group inline-flex min-h-11 items-center gap-2 rounded-2xl bg-white px-4 py-2.5 text-xs font-bold text-[#102c23] shadow-lg transition hover:-translate-y-0.5">{profile.role === "mahasiswa" && <ScanLine className="h-4 w-4" />}{copy.primary.label}<ArrowUpRight className="h-4 w-4 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" /></Link>
                <Link href={copy.secondary.href} className="inline-flex min-h-11 items-center rounded-2xl border border-white/12 bg-white/[0.06] px-4 py-2.5 text-xs font-bold text-white backdrop-blur-lg transition hover:bg-white/10">{copy.secondary.label}</Link>
              </div>
            </div>
            <div className="hidden min-w-0 grid-cols-2 gap-3 sm:grid sm:grid-cols-3 lg:grid-cols-2">
              {[
                { label: "Bahaya aktif", value: summary.activeHazards.length, icon: ShieldAlert, tone: "text-red-200" },
                { label: "Aset dibatasi", value: summary.restrictedAssets.length, icon: Package, tone: "text-amber-200" },
                { label: "Inspeksi terlambat", value: summary.overdueInspections.length, icon: CalendarClock, tone: "text-sky-200" },
                { label: "Role aktif", value: getRoleLabel(profile.role), icon: UserRoundCheck, tone: "text-emerald-200" },
              ].map(({ label, value, icon: Icon, tone }) => (
                <div key={label} className="min-w-0 rounded-2xl border border-white/10 bg-white/[0.07] p-3.5 backdrop-blur-xl"><Icon className={`h-4 w-4 ${tone}`} /><p className="mt-3 break-words text-lg font-semibold tracking-[-0.03em]">{value}</p><p className="mt-1 text-[10px] leading-4 text-white/55">{label}</p></div>
              ))}
            </div>
          </div>
        </section>

        <section className="soft-card flex min-w-0 flex-col gap-4 rounded-[24px] p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0"><p className="text-[10px] font-bold uppercase tracking-[0.15em] text-emerald-700">Cakupan dashboard</p><p className="mt-1 break-words text-sm font-semibold text-slate-900">{scopeLabel}</p><p className="mt-1 text-[11px] text-slate-500">Diperbarui {formatUpdatedAt(summary.updatedAt)} · sesuai cakupan akses Anda</p></div>
          <div className="flex min-w-0 flex-col gap-2 min-[430px]:flex-row min-[430px]:items-center">
            <label className="sr-only" htmlFor="dashboard-period">Periode analisis</label>
            <select id="dashboard-period" value={period} onChange={(event) => setPeriod(event.target.value as PeriodKey)} className="min-h-11 min-w-0 rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100">{periodOptions.map((option) => <option key={option.key} value={option.key}>{option.label}</option>)}</select>
            <button type="button" onClick={() => void loadDashboard(true)} disabled={refreshing} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#102c23] px-4 text-sm font-semibold text-white transition hover:bg-emerald-900 disabled:cursor-wait disabled:opacity-60"><RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />Perbarui</button>
          </div>
        </section>

        {errors.length > 0 && (
          <div role="alert" className="soft-card flex items-start gap-3 rounded-3xl border-amber-200/70 bg-amber-50/90 p-4 text-sm text-amber-900"><AlertCircle className="mt-0.5 h-5 w-5 shrink-0" /><div><p className="font-semibold">Sebagian indikator belum tersedia.</p><ul className="mt-1 list-disc pl-5 text-amber-800">{[...new Set(errors)].map((error) => <li key={error}>{error}</li>)}</ul></div></div>
        )}

        <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
          {roleStats.map(({ label, value, icon: Icon, accent, surface, note }, index) => (
            <article key={label} className="soft-card lift-card relative min-w-0 overflow-hidden rounded-[22px] p-3.5 sm:rounded-[26px] sm:p-5" style={{ animationDelay: `${index * 70}ms` }}><div className={`absolute inset-x-0 top-0 h-1 bg-gradient-to-r ${accent}`} /><div className="flex items-start justify-between gap-2 sm:gap-4"><div className="min-w-0"><p className="break-words text-[11px] font-semibold leading-4 text-slate-500 sm:text-xs">{label}</p><p className="mt-2 break-words text-2xl font-semibold tracking-[-0.05em] text-slate-950 sm:text-3xl">{value}</p></div><span className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl sm:h-11 sm:w-11 sm:rounded-2xl ${surface}`}><Icon className="h-4 w-4 sm:h-5 sm:w-5" /></span></div><p className="mt-3 break-words text-[10px] leading-4 text-slate-400 sm:mt-4 sm:text-[11px]">{note}</p></article>
          ))}
        </div>

        <section className="soft-card min-w-0 rounded-[28px] p-4 sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-[10px] font-bold uppercase tracking-[0.16em] text-red-600">Tindakan berbasis risiko</p><h2 className="mt-1 text-lg font-bold tracking-[-0.025em] text-slate-950">Prioritas sekarang</h2><p className="mt-1 text-xs leading-5 text-slate-500">Kondisi aktif tidak dibatasi oleh filter periode agar bahaya lama yang belum selesai tetap terlihat.</p></div><span className="rounded-full bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-700">{priorities.length} perhatian</span></div>
          {priorities.length === 0 ? (
            <div className="mt-5 flex items-start gap-3 rounded-2xl border border-emerald-100 bg-emerald-50/70 p-4 text-emerald-900"><CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" /><div><p className="text-sm font-semibold">Tidak ada prioritas tinggi yang terdeteksi.</p><p className="mt-1 text-xs leading-5 text-emerald-700">Lanjutkan inspeksi, briefing, dan pelaporan kondisi tidak aman secara berkala.</p></div></div>
          ) : (
            <div className="mt-5 grid min-w-0 gap-3 lg:grid-cols-2">{priorities.map(({ id, title, detail, href, label, tone, icon: Icon }) => (
              <Link key={id} href={href} className="group flex min-w-0 items-start gap-3 rounded-2xl border border-slate-100 bg-slate-50/75 p-3.5 transition hover:border-emerald-200 hover:bg-white hover:shadow-sm"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-white text-slate-600 shadow-sm group-hover:text-emerald-700"><Icon className="h-4 w-4" /></span><span className="min-w-0 flex-1"><span className="block break-words text-sm font-semibold leading-5 text-slate-900">{title}</span><span className="mt-1 block break-words text-[11px] leading-4 text-slate-500">{detail}</span></span><span className={`hidden shrink-0 rounded-full px-2.5 py-1 text-[10px] font-bold capitalize sm:inline-flex ${tone}`}>{label}</span><ArrowUpRight className="mt-1 h-4 w-4 shrink-0 text-slate-400 group-hover:text-emerald-700" /></Link>
            ))}</div>
          )}
        </section>

        <details className="soft-card min-w-0 rounded-[24px] p-4 md:hidden">
          <summary className="cursor-pointer list-none text-sm font-bold text-slate-950">Lihat analisis {periodLabel.toLowerCase()}<span className="float-right text-emerald-700">+</span></summary>
          <p className="mt-2 text-xs leading-5 text-slate-500">Indikator pencegahan dan hasil ditampilkan sesuai periode yang dipilih.</p>
          <div className="mt-4 grid grid-cols-2 gap-3">{analyticalCards.map(({ label, value, note, icon: Icon }) => (
            <article key={label} className="min-w-0 rounded-2xl bg-slate-50 p-3"><div className="flex items-start justify-between gap-2"><div className="min-w-0"><p className="text-[10px] font-semibold leading-4 text-slate-500">{label}</p><p className="mt-2 text-xl font-bold tracking-[-0.04em] text-slate-950">{value}</p></div><Icon className="h-4 w-4 shrink-0 text-violet-700" /></div><p className="mt-2 break-words text-[9px] leading-4 text-slate-400">{note}</p></article>
          ))}</div>
        </details>

        <section className="hidden min-w-0 space-y-4 md:block">
          <div className="flex flex-wrap items-end justify-between gap-3 px-1"><div><p className="text-[10px] font-bold uppercase tracking-[0.16em] text-violet-700">Indikator pencegahan dan hasil</p><h2 className="mt-1 text-xl font-bold tracking-[-0.03em] text-slate-950">Analisis {periodLabel.toLowerCase()}</h2></div><p className="max-w-xl text-xs leading-5 text-slate-500">Volume laporan menunjukkan partisipasi pelaporan, bukan otomatis penurunan keselamatan. Nilai bersama kecepatan respons dan efektivitas pengendalian.</p></div>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{analyticalCards.map(({ label, value, note, icon: Icon }) => (
            <article key={label} className="soft-card min-w-0 rounded-[22px] p-4"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="text-xs font-semibold text-slate-500">{label}</p><p className="mt-2 text-2xl font-bold tracking-[-0.04em] text-slate-950">{value}</p></div><span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-violet-50 text-violet-700"><Icon className="h-4 w-4" /></span></div><p className="mt-3 break-words text-[10px] leading-4 text-slate-400">{note}</p></article>
          ))}</div>
        </section>

        <div className="grid min-w-0 gap-5 xl:grid-cols-[0.9fr_1.1fr]">
          <section className="soft-card min-w-0 overflow-hidden rounded-[28px] p-4 sm:p-6">
            <div className="flex items-start justify-between gap-4"><div><p className="text-[10px] font-bold uppercase tracking-[0.16em] text-emerald-700">Kesiapan alat</p><h2 className="mt-1 text-lg font-bold tracking-[-0.025em] text-slate-950">Status aset saat ini</h2></div><span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-emerald-50 text-emerald-700"><Package className="h-4 w-4" /></span></div>
            <div className="mt-6 space-y-3">{[
              { label: "Layak", value: summary.assetStatus.layak, color: "bg-emerald-500", tone: "text-emerald-700" },
              { label: "Perlu dicek", value: summary.assetStatus.perlu_dicek, color: "bg-amber-400", tone: "text-amber-700" },
              { label: "Tidak layak", value: summary.assetStatus.tidak_layak, color: "bg-red-500", tone: "text-red-700" },
            ].map((item) => {
              const totalAssets = Math.max(summary.assets.length, 1);
              return <div key={item.label} className="rounded-2xl bg-slate-50/80 p-3.5"><div className="flex items-center justify-between text-xs"><span className={`font-semibold ${item.tone}`}>{item.label}</span><span className="font-bold text-slate-800">{item.value}</span></div><div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-slate-200/70"><div className={`motion-bar-x h-full rounded-full ${item.color}`} style={{ width: `${(item.value / totalAssets) * 100}%` }} /></div></div>;
            })}</div>
            <div className="mt-4 grid grid-cols-2 gap-2 text-center text-[10px] text-slate-500"><div className="rounded-xl bg-orange-50 p-3"><strong className="block text-lg text-orange-800">{summary.overdueInspections.length}</strong>inspeksi terlambat</div><div className="rounded-xl bg-sky-50 p-3"><strong className="block text-lg text-sky-800">{summary.inspectionsDueSoon.length}</strong>jatuh tempo 30 hari</div></div>
          </section>

          <section className="soft-card min-w-0 rounded-[28px] p-4 sm:p-6">
            <div className="flex items-start justify-between gap-4"><div><p className="text-[10px] font-bold uppercase tracking-[0.16em] text-violet-700">Analisis laporan</p><h2 className="mt-1 text-lg font-bold tracking-[-0.025em] text-slate-950">Distribusi risiko · {periodLabel}</h2></div><span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-violet-50 text-violet-700"><BarChart3 className="h-4 w-4" /></span></div>
            <div className="mt-6 grid grid-cols-1 gap-3 min-[360px]:grid-cols-2 sm:grid-cols-4">{(Object.entries(analytics.reportRisk) as [RiskLevel, number][]).map(([risk, count]) => {
              const percent = totalReportRisk > 0 ? Math.round((count / totalReportRisk) * 100) : 0;
              return <div key={risk} className={`lift-card rounded-2xl p-3.5 ${riskColors[risk]}`}><div className="flex items-center justify-between gap-2"><span className="text-[10px] font-bold uppercase tracking-[0.1em]">{riskLabels[risk]}</span><span className="text-[10px] font-medium opacity-60">{percent}%</span></div><p className="mt-4 text-3xl font-semibold tracking-[-0.05em]">{count}</p><div className="mt-3 h-1 overflow-hidden rounded-full bg-white/50"><div className={`h-full rounded-full ${riskBars[risk]}`} style={{ width: `${percent}%` }} /></div></div>;
            })}</div>
            <div className="mt-5 grid grid-cols-1 gap-2 min-[360px]:grid-cols-2 sm:grid-cols-5">{(Object.entries(analytics.reportStatus) as [ReportStatus, number][]).map(([status, count]) => (
              <div key={status} className="relative overflow-hidden rounded-2xl border border-slate-100 bg-white p-3.5"><span className={`absolute inset-y-0 left-0 w-1 ${statusBars[status]}`} /><p className="text-2xl font-semibold tracking-[-0.04em] text-slate-900">{count}</p><p className="mt-1 text-[10px] font-medium leading-4 text-slate-500">{statusLabels[status]}</p></div>
            ))}</div>
          </section>
        </div>

        <div className="grid min-w-0 gap-5 xl:grid-cols-2">
          <section className="soft-card min-w-0 rounded-[28px] p-4 sm:p-6">
            <div className="mb-5 flex items-center justify-between gap-3"><div><p className="text-[10px] font-bold uppercase tracking-[0.16em] text-red-600">Pemantauan</p><h2 className="mt-1 text-lg font-bold tracking-[-0.025em] text-slate-950">Laporan terbaru · {periodLabel}</h2></div><Link href="/reports" className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-slate-100 text-slate-600 transition hover:bg-[#102c23] hover:text-white" aria-label="Lihat semua laporan"><ArrowUpRight className="h-4 w-4" /></Link></div>
            {analytics.reports.length === 0 ? <p className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-500">Tidak ada laporan pada periode ini.</p> : <div className="space-y-2.5">{analytics.reports.slice(0, 5).map((report, index) => (
              <Link key={report.id} href={`/reports/${report.id}`} className={`${index >= 3 ? "hidden sm:flex" : "flex"} group min-w-0 flex-col items-stretch gap-3 rounded-2xl border border-transparent bg-slate-50/80 p-3.5 transition hover:border-emerald-100 hover:bg-white hover:shadow-sm min-[430px]:flex-row min-[430px]:items-center min-[430px]:justify-between`}><div className="flex min-w-0 items-start gap-3"><span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-white text-slate-500 shadow-sm group-hover:text-emerald-700"><FileWarning className="h-4 w-4" /></span><div className="min-w-0"><p className="break-words text-sm font-semibold leading-5 text-slate-900 min-[430px]:truncate">{report.title}</p><p className="mt-0.5 break-words text-[11px] leading-4 text-slate-500 min-[430px]:truncate">{report.asset?.code ?? "Area umum"} · {report.location}</p></div></div><div className="flex flex-wrap gap-2">{report.hazardActive && !["selesai", "ditolak"].includes(report.status) && <span className="w-fit rounded-full bg-red-100 px-2.5 py-1 text-[10px] font-bold text-red-800">Bahaya aktif</span>}<span className={`w-fit max-w-full shrink-0 break-words rounded-full px-2.5 py-1 text-[10px] font-bold ${riskColors[report.riskCategory]}`}>{riskLabels[report.riskCategory]}</span></div></Link>
            ))}</div>}
          </section>

          <section className="soft-card min-w-0 overflow-hidden rounded-[28px] p-4 sm:p-6">
            <div className="mb-5 flex items-center justify-between gap-3"><div><p className="text-[10px] font-bold uppercase tracking-[0.16em] text-teal-700">Inspeksi</p><h2 className="mt-1 text-lg font-bold tracking-[-0.025em] text-slate-950">Checklist terbaru · {periodLabel}</h2></div>{["dosen", "teknisi", "admin"].includes(profile.role) ? <Link href="/checklists" className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-teal-50 text-teal-700 transition hover:bg-teal-700 hover:text-white" aria-label="Lihat semua checklist"><Activity className="h-4 w-4" /></Link> : <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-teal-50 text-teal-700" aria-hidden="true"><Activity className="h-4 w-4" /></span>}</div>
            {analytics.checklists.length === 0 ? <p className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-500">Tidak ada hasil checklist pada periode ini atau akses Anda terbatas.</p> : <div className="space-y-2.5">{analytics.checklists.slice(0, 5).map((checklist, index) => (
              <div key={checklist.id} className={`${index >= 3 ? "hidden sm:flex" : "flex"} min-w-0 flex-col items-stretch gap-3 rounded-2xl bg-slate-50/80 p-3.5 min-[430px]:flex-row min-[430px]:items-center min-[430px]:justify-between`}><div className="flex min-w-0 items-start gap-3"><span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-white text-emerald-700 shadow-sm"><CheckCircle2 className="h-4 w-4" /></span><div className="min-w-0"><p className="break-words text-sm font-semibold leading-5 text-slate-900 min-[430px]:truncate">{checklist.template?.title ?? "Checklist K3"}</p><p className="mt-0.5 break-words text-[11px] leading-4 text-slate-500 min-[430px]:truncate">{checklist.asset?.code ?? "Tanpa aset"} · {new Date(checklist.completedAt).toLocaleDateString("id-ID")}</p></div></div><span className={`w-fit max-w-full shrink-0 break-words rounded-full px-2.5 py-1 text-[10px] font-bold ${checklist.riskCategory ? riskColors[checklist.riskCategory] : "bg-emerald-100 text-emerald-800"}`}>{checklist.riskCategory ? `${riskLabels[checklist.riskCategory]} (${checklist.riskScore})` : "Tanpa temuan"}</span></div>
            ))}</div>}
          </section>
        </div>

        <div className="soft-card flex min-w-0 items-start gap-3 rounded-2xl p-4 text-xs leading-5 text-slate-500"><Clock3 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-700" /><p>Dashboard mendukung pemantauan dan prioritas tindakan, bukan sertifikasi kepatuhan. Verifikasi lapangan, kompetensi pemeriksa, dan efektivitas pengendalian tetap diperlukan.</p></div>
      </div>
    </AppShell>
  );
}
