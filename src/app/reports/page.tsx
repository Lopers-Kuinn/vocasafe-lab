"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AlertCircle, Award, CalendarClock, ChevronRight, Clock3, FileWarning, Layers3, Loader2, MapPin, Plus, Search, ShieldAlert, SlidersHorizontal, Tag, UserCheck, Users } from "lucide-react";
import AppShell from "@/components/AppShell";
import MobileFilterSheet from "@/components/mobile/MobileFilterSheet";
import { fetchLaboratories, type LaboratorySummary } from "@/lib/assets";
import { getCurrentUserProfile, getRoleLabel } from "@/lib/auth";
import { canEditReportStatus } from "@/lib/role-access";
import {
  fetchReports,
  fetchReportContributors,
  getReportContributionReward,
  HAZARD_CATEGORY_LABELS,
  REPORT_TYPE_LABELS,
  type DatabaseReport,
  type ReportContributor,
} from "@/lib/reports";
import type { HazardCategory, ReportStatus, ReportType, RiskLevel } from "@/types";
import { useViewStateMemory } from "@/lib/use-view-state-memory";

const riskColors: Record<RiskLevel, string> = {
  rendah: "bg-green-100 text-green-800",
  sedang: "bg-yellow-100 text-yellow-800",
  tinggi: "bg-orange-100 text-orange-800",
  kritis: "bg-red-100 text-red-800",
};

const statusLabels: Record<ReportStatus, string> = {
  baru: "Baru",
  diverifikasi: "Diverifikasi",
  dalam_penanganan: "Dalam Penanganan",
  selesai: "Selesai",
  ditolak: "Ditolak",
};

const statusColors: Record<ReportStatus, string> = {
  baru: "bg-slate-100 text-slate-700",
  diverifikasi: "bg-teal-100 text-teal-700",
  dalam_penanganan: "bg-yellow-100 text-yellow-700",
  selesai: "bg-green-100 text-green-700",
  ditolak: "bg-red-100 text-red-700",
};

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

type AssignmentFilter = "semua" | "saya" | "belum_ditetapkan" | "terlambat";

function isReportClosed(report: DatabaseReport): boolean {
  return report.status === "selesai" || report.status === "ditolak";
}

function matchesAssignmentFilter(
  report: DatabaseReport,
  filter: AssignmentFilter,
  currentUserId: string,
  currentTimestamp: number,
): boolean {
  if (filter === "semua") return true;
  if (filter === "saya") return report.assignedTo === currentUserId;
  if (filter === "belum_ditetapkan") return !report.assignedTo && !isReportClosed(report);
  return Boolean(
    report.responseDueAt &&
      !isReportClosed(report) &&
      new Date(report.responseDueAt).getTime() < currentTimestamp,
  );
}

interface ReportGroup {
  key: string;
  assetName: string;
  assetCode: string | null;
  reports: DatabaseReport[];
}

function groupReportsByAsset(reports: DatabaseReport[]): ReportGroup[] {
  const groups = new Map<string, ReportGroup>();

  for (const report of reports) {
    const key = report.assetId ? `asset:${report.assetId}` : `report:${report.id}`;
    const group = groups.get(key) ?? {
      key,
      assetName: report.asset?.name ?? "Laporan tanpa aset",
      assetCode: report.asset?.code ?? null,
      reports: [],
    };
    group.reports.push(report);
    groups.set(key, group);
  }

  return [...groups.values()]
    .map((group) => ({
      ...group,
      reports: group.reports.sort(
        (a, b) => new Date(b.reportedAt).getTime() - new Date(a.reportedAt).getTime(),
      ),
    }))
    .sort(
      (a, b) =>
        new Date(b.reports[0].reportedAt).getTime() -
        new Date(a.reports[0].reportedAt).getTime(),
    );
}

export default function ReportsPage() {
  const [reports, setReports] = useState<DatabaseReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [laboratories, setLaboratories] = useState<LaboratorySummary[]>([]);
  const [riskFilter, setRiskFilter] = useState<"semua" | RiskLevel>("semua");
  const [laboratoryFilter, setLaboratoryFilter] = useState("semua");
  const [typeFilter, setTypeFilter] = useState<"semua" | ReportType>("semua");
  const [categoryFilter, setCategoryFilter] = useState<"semua" | HazardCategory>("semua");
  const [search, setSearch] = useState("");
  const [showMobileFilters, setShowMobileFilters] = useState(false);
  const [draftRiskFilter, setDraftRiskFilter] = useState<"semua" | RiskLevel>("semua");
  const [draftLaboratoryFilter, setDraftLaboratoryFilter] = useState("semua");
  const [draftTypeFilter, setDraftTypeFilter] = useState<"semua" | ReportType>("semua");
  const [draftCategoryFilter, setDraftCategoryFilter] = useState<"semua" | HazardCategory>("semua");
  const [assignmentFilter, setAssignmentFilter] = useState<AssignmentFilter>("semua");
  const [draftAssignmentFilter, setDraftAssignmentFilter] = useState<AssignmentFilter>("semua");
  const [currentUserId, setCurrentUserId] = useState("");
  const [canManageResponses, setCanManageResponses] = useState(false);
  const [currentTimestamp, setCurrentTimestamp] = useState(0);
  const [contributors, setContributors] = useState<ReportContributor[]>([]);
  const [timelineWarning, setTimelineWarning] = useState("");

  useEffect(() => {
    let active = true;

    void Promise.all([fetchReports(), fetchLaboratories(), getCurrentUserProfile()]).then(async ([result, laboratoryResult, profileResult]) => {
      if (!active) return;
      setReports(result.reports);
      setLaboratories(laboratoryResult.laboratories);
      setCurrentUserId(profileResult.user?.id ?? "");
      setCanManageResponses(Boolean(profileResult.user && canEditReportStatus(profileResult.user.role)));
      setCurrentTimestamp(Date.now());
      setError(
        result.error || laboratoryResult.error
          ? `Sebagian laporan belum dapat dimuat: ${[result.error, laboratoryResult.error]
              .filter(Boolean)
              .join("; ")}`
          : "",
      );
      setLoading(false);

      const contributorResult = await fetchReportContributors(
        result.reports.map((report) => report.id),
      );
      if (!active) return;
      setContributors(contributorResult.contributors);
      setTimelineWarning(contributorResult.error ?? "");
    });

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    const interval = window.setInterval(() => setCurrentTimestamp(Date.now()), 60_000);
    return () => window.clearInterval(interval);
  }, []);

  const contributorByReportId = useMemo(
    () => new Map(contributors.map((contributor) => [contributor.reportId, contributor])),
    [contributors],
  );

  const filteredReports = useMemo(
    () =>
      reports.filter((report) => {
        const term = search.trim().toLowerCase();
        const searchable = [
          report.title,
          report.description,
          report.location,
          report.asset?.name,
          report.asset?.code,
          report.laboratory?.name,
          contributorByReportId.get(report.id)?.fullName,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();

        return (
          (riskFilter === "semua" || report.riskCategory === riskFilter) &&
          (laboratoryFilter === "semua" || report.laboratoryId === laboratoryFilter) &&
          (typeFilter === "semua" || report.reportType === typeFilter) &&
          (categoryFilter === "semua" || report.hazardCategory === categoryFilter) &&
          (!canManageResponses || matchesAssignmentFilter(report, assignmentFilter, currentUserId, currentTimestamp)) &&
          (!term || searchable.includes(term))
        );
      }),
    [assignmentFilter, canManageResponses, categoryFilter, contributorByReportId, currentTimestamp, currentUserId, laboratoryFilter, reports, riskFilter, search, typeFilter],
  );

  const reportGroups = useMemo(() => groupReportsByAsset(filteredReports), [filteredReports]);

  const pendingMobileResultCount = useMemo(() => reports.filter((report) => {
    const term = search.trim().toLowerCase();
    const searchable = [report.title, report.description, report.location, report.asset?.name, report.asset?.code, report.laboratory?.name].filter(Boolean).join(" ").toLowerCase();
    return (draftRiskFilter === "semua" || report.riskCategory === draftRiskFilter) &&
      (draftLaboratoryFilter === "semua" || report.laboratoryId === draftLaboratoryFilter) &&
      (draftTypeFilter === "semua" || report.reportType === draftTypeFilter) &&
      (draftCategoryFilter === "semua" || report.hazardCategory === draftCategoryFilter) &&
      (!canManageResponses || matchesAssignmentFilter(report, draftAssignmentFilter, currentUserId, currentTimestamp)) &&
      (!term || searchable.includes(term));
  }).length, [canManageResponses, currentTimestamp, currentUserId, draftAssignmentFilter, draftCategoryFilter, draftLaboratoryFilter, draftRiskFilter, draftTypeFilter, reports, search]);

  const activeFilterCount = [riskFilter, laboratoryFilter, typeFilter, categoryFilter, canManageResponses ? assignmentFilter : "semua"].filter((value) => value !== "semua").length;

  function openMobileFilters() {
    setDraftRiskFilter(riskFilter); setDraftLaboratoryFilter(laboratoryFilter);
    setDraftTypeFilter(typeFilter); setDraftCategoryFilter(categoryFilter);
    setDraftAssignmentFilter(assignmentFilter);
    setShowMobileFilters(true);
  }

  useViewStateMemory(
    "vocasafe_reports_list_view_v1",
    { search, riskFilter, laboratoryFilter, typeFilter, categoryFilter, assignmentFilter },
    (saved) => {
      if (typeof saved.search === "string") setSearch(saved.search);
      if (typeof saved.riskFilter === "string") setRiskFilter(saved.riskFilter as "semua" | RiskLevel);
      if (typeof saved.laboratoryFilter === "string") setLaboratoryFilter(saved.laboratoryFilter);
      if (typeof saved.typeFilter === "string") setTypeFilter(saved.typeFilter as "semua" | ReportType);
      if (typeof saved.categoryFilter === "string") setCategoryFilter(saved.categoryFilter as "semua" | HazardCategory);
      if (typeof saved.assignmentFilter === "string") setAssignmentFilter(saved.assignmentFilter as AssignmentFilter);
    },
    !loading,
  );

  return (
    <AppShell>
      <div className="space-y-6">
        <div className="flex flex-col items-stretch gap-3 min-[420px]:flex-row min-[420px]:items-center min-[420px]:justify-between">
          <div className="min-w-0">
            <h1 className="text-2xl font-bold text-slate-900">Daftar Laporan</h1>
            <p className="mt-1 text-sm text-slate-500">
              Pantau laporan bahaya dan perkembangan tindak lanjutnya.
            </p>
          </div>
          <Link
            href="/reports/new"
            className="inline-flex min-h-11 w-full items-center justify-center gap-1 rounded-xl bg-emerald-600 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-700 min-[420px]:w-auto"
          >
            <Plus className="h-4 w-4" /> Laporan Baru
          </Link>
        </div>

        <section className={`grid gap-3 rounded-2xl border border-white/80 bg-white/85 p-4 shadow-sm backdrop-blur-xl sm:grid-cols-2 ${canManageResponses ? "xl:grid-cols-5" : "xl:grid-cols-4"}`}>
          <label className={`relative block sm:col-span-2 ${canManageResponses ? "xl:col-span-5" : "xl:col-span-4"}`}>
            <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">Cari laporan</span>
            <Search className="pointer-events-none absolute bottom-3 left-3 h-4 w-4 text-slate-400" />
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Judul, deskripsi, aset, kode, atau lokasi" className="min-h-11 w-full rounded-xl border border-slate-200 bg-white py-2 pl-10 pr-3 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100" />
          </label>
          <button type="button" onClick={openMobileFilters} className="flex min-h-12 items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm font-semibold text-slate-700 sm:hidden"><span className="inline-flex items-center gap-2"><SlidersHorizontal className="h-4 w-4" /> Filter laporan</span><span className="rounded-full bg-white px-2 py-0.5 text-xs text-slate-500">{activeFilterCount} aktif</span></button>
          <label className="relative hidden sm:block">
            <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">
              Tingkat bahaya
            </span>
            <ShieldAlert className="pointer-events-none absolute bottom-3 left-3 h-4 w-4 text-slate-400" />
            <select
              value={riskFilter}
              onChange={(event) =>
                setRiskFilter(event.target.value as "semua" | RiskLevel)
              }
              className="min-h-11 w-full rounded-xl border border-slate-200 bg-white py-2 pl-10 pr-3 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
            >
              <option value="semua">Semua tingkat risiko</option>
              <option value="kritis">Kritis</option>
              <option value="tinggi">Tinggi</option>
              <option value="sedang">Sedang</option>
              <option value="rendah">Rendah</option>
            </select>
          </label>

          <label className="relative hidden sm:block">
            <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">Jenis laporan</span>
            <Tag className="pointer-events-none absolute bottom-3 left-3 h-4 w-4 text-slate-400" />
            <select value={typeFilter} onChange={(event) => setTypeFilter(event.target.value as "semua" | ReportType)} className="min-h-11 w-full rounded-xl border border-slate-200 bg-white py-2 pl-10 pr-3 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100">
              <option value="semua">Semua jenis laporan</option>
              {Object.entries(REPORT_TYPE_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </label>

          <label className="relative hidden sm:block">
            <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">Kategori bahaya</span>
            <ShieldAlert className="pointer-events-none absolute bottom-3 left-3 h-4 w-4 text-slate-400" />
            <select value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value as "semua" | HazardCategory)} className="min-h-11 w-full rounded-xl border border-slate-200 bg-white py-2 pl-10 pr-3 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100">
              <option value="semua">Semua kategori bahaya</option>
              {Object.entries(HAZARD_CATEGORY_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </label>

          <label className="relative hidden sm:block">
            <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">
              Lokasi laboratorium
            </span>
            <MapPin className="pointer-events-none absolute bottom-3 left-3 h-4 w-4 text-slate-400" />
            <select
              value={laboratoryFilter}
              onChange={(event) => setLaboratoryFilter(event.target.value)}
              className="min-h-11 w-full rounded-xl border border-slate-200 bg-white py-2 pl-10 pr-3 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
            >
              <option value="semua">Semua laboratorium</option>
              {laboratories.map((laboratory) => (
                <option key={laboratory.id} value={laboratory.id}>
                  {laboratory.name}
                </option>
              ))}
            </select>
          </label>

          {canManageResponses && (
            <label className="relative hidden sm:block">
              <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">Penugasan respons</span>
              <UserCheck className="pointer-events-none absolute bottom-3 left-3 h-4 w-4 text-slate-400" />
              <select value={assignmentFilter} onChange={(event) => setAssignmentFilter(event.target.value as AssignmentFilter)} className="min-h-11 w-full rounded-xl border border-slate-200 bg-white py-2 pl-10 pr-3 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100">
                <option value="semua">Semua penugasan</option>
                <option value="saya">Ditugaskan kepada saya</option>
                <option value="belum_ditetapkan">Belum ada PIC</option>
                <option value="terlambat">Tenggat terlewati</option>
              </select>
            </label>
          )}
        </section>

        {activeFilterCount > 0 && <div className="-mt-3 flex gap-2 overflow-x-auto pb-1 sm:hidden" aria-label="Filter laporan aktif">
          {riskFilter !== "semua" && <button type="button" onClick={() => setRiskFilter("semua")} className="shrink-0 rounded-full bg-emerald-100 px-3 py-1.5 text-xs font-semibold text-emerald-800">{capitalize(riskFilter)} ×</button>}
          {typeFilter !== "semua" && <button type="button" onClick={() => setTypeFilter("semua")} className="shrink-0 rounded-full bg-emerald-100 px-3 py-1.5 text-xs font-semibold text-emerald-800">{REPORT_TYPE_LABELS[typeFilter]} ×</button>}
          {categoryFilter !== "semua" && <button type="button" onClick={() => setCategoryFilter("semua")} className="shrink-0 rounded-full bg-emerald-100 px-3 py-1.5 text-xs font-semibold text-emerald-800">{HAZARD_CATEGORY_LABELS[categoryFilter]} ×</button>}
          {laboratoryFilter !== "semua" && <button type="button" onClick={() => setLaboratoryFilter("semua")} className="shrink-0 rounded-full bg-emerald-100 px-3 py-1.5 text-xs font-semibold text-emerald-800">{laboratories.find((item) => item.id === laboratoryFilter)?.name ?? "Laboratorium"} ×</button>}
          {canManageResponses && assignmentFilter !== "semua" && <button type="button" onClick={() => setAssignmentFilter("semua")} className="shrink-0 rounded-full bg-emerald-100 px-3 py-1.5 text-xs font-semibold text-emerald-800">{assignmentFilter === "saya" ? "Tugas saya" : assignmentFilter === "belum_ditetapkan" ? "Belum ada PIC" : "Terlambat"} ×</button>}
        </div>}

        {loading ? (
          <div className="flex min-h-48 items-center justify-center rounded-lg border border-slate-200 bg-white">
            <Loader2 className="mr-2 h-5 w-5 animate-spin text-emerald-600" />
            <span className="text-sm text-slate-500">Memuat laporan...</span>
          </div>
        ) : error ? (
          <div
            role="alert"
            className="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700"
          >
            <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
            <p>{error}</p>
          </div>
        ) : filteredReports.length === 0 ? (
          <div className="rounded-lg border border-slate-200 bg-white p-8 text-center">
            <FileWarning className="mx-auto mb-2 h-10 w-10 text-slate-300" />
            <p className="text-slate-500">
              {reports.length === 0
                ? "Belum ada laporan yang dapat ditampilkan."
                : "Tidak ada laporan yang sesuai dengan filter."}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-slate-500">
                {filteredReports.length} laporan dalam {reportGroups.length} kelompok aset.
              </p>
              <p className="text-xs text-slate-400">Satu aset dapat memiliki beberapa masalah berbeda.</p>
            </div>
            {timelineWarning && (
              <p role="status" className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-800">
                {timelineWarning}
              </p>
            )}
            {reportGroups.map((group) => {
              const openReports = group.reports.filter((report) => !isReportClosed(report));
              const highestRisk = group.reports.reduce((highest, report) =>
                report.riskScore > highest.riskScore ? report : highest,
              );
              const reporterCount = new Set(
                group.reports.map((report) => report.reporterId).filter(Boolean),
              ).size;

              return (
                <section key={group.key} className="min-w-0 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                  <div className="border-b border-slate-100 bg-gradient-to-r from-emerald-50 to-white p-4 sm:p-5">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0">
                        <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.14em] text-emerald-700">
                          <Layers3 className="h-4 w-4" /> Kelompok QR / aset
                        </p>
                        <h2 className="mt-2 break-words text-lg font-bold text-slate-950">
                          {group.assetName}{group.assetCode ? ` (${group.assetCode})` : ""}
                        </h2>
                        <p className="mt-1 text-xs leading-5 text-slate-500">
                          {group.reports[0].laboratory?.name ?? group.reports[0].location}
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-2 text-xs font-semibold">
                        <span className="inline-flex items-center gap-1 rounded-full bg-white px-2.5 py-1 text-slate-700 shadow-sm"><Clock3 className="h-3.5 w-3.5" /> {group.reports.length} laporan</span>
                        <span className="inline-flex items-center gap-1 rounded-full bg-white px-2.5 py-1 text-slate-700 shadow-sm"><Users className="h-3.5 w-3.5" /> {reporterCount || group.reports.length} pelapor</span>
                        <span className={`inline-flex rounded-full px-2.5 py-1 ${riskColors[highestRisk.riskCategory]}`}>Risiko tertinggi {highestRisk.riskScore}</span>
                        {openReports.length > 0 && <span className="inline-flex rounded-full bg-amber-100 px-2.5 py-1 text-amber-800">{openReports.length} belum selesai</span>}
                      </div>
                    </div>
                  </div>

                  <div className="p-4 sm:p-5">
                    <p className="mb-4 text-xs leading-5 text-slate-500">
                      Timeline ini mengelompokkan laporan berdasarkan aset. Detail setiap laporan tetap dipertahankan agar masalah berbeda tidak tertutup bersamaan.
                    </p>
                    <ol className="space-y-3" aria-label={`Timeline laporan ${group.assetName}`}>
                      {group.reports.map((report) => {
                        const contributor = contributorByReportId.get(report.id);
                        const reward = getReportContributionReward(report.status);
                        return (
                          <li key={report.id} className="relative border-l-2 border-emerald-100 pl-4">
                            <span className="absolute -left-[5px] top-4 h-2 w-2 rounded-full bg-emerald-600" aria-hidden="true" />
                            <Link href={`/reports/${report.id}`} className="group block rounded-xl border border-slate-100 bg-slate-50 p-3 transition hover:border-emerald-200 hover:bg-emerald-50/60">
                              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                                <div className="min-w-0">
                                  <p className="break-words text-sm font-bold text-slate-900">{report.title}</p>
                                  <p className="mt-1 text-xs text-slate-500">
                                    {contributor?.fullName ?? "Pelapor"}
                                    {contributor?.role ? ` · ${getRoleLabel(contributor.role)}` : ""}
                                    {` · ${new Date(report.reportedAt).toLocaleString("id-ID", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}`}
                                  </p>
                                </div>
                                <ChevronRight className="hidden h-4 w-4 shrink-0 text-slate-400 transition group-hover:translate-x-0.5 group-hover:text-emerald-700 sm:block" />
                              </div>
                              <div className="mt-3 flex flex-wrap items-center gap-2 text-xs font-semibold">
                                <span className={`rounded-full px-2.5 py-1 ${statusColors[report.status]}`}>{statusLabels[report.status]}</span>
                                <span className={`rounded-full px-2.5 py-1 ${riskColors[report.riskCategory]}`}>{capitalize(report.riskCategory)} · {report.riskScore}</span>
                                <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 ${reward.points > 0 ? "bg-amber-100 text-amber-800" : "bg-slate-100 text-slate-600"}`}>
                                  <Award className="h-3.5 w-3.5" /> {reward.points > 0 ? `+${reward.points} poin` : reward.label}
                                </span>
                                {report.assignee && <span className="inline-flex items-center gap-1 rounded-full bg-white px-2.5 py-1 text-slate-600"><UserCheck className="h-3.5 w-3.5" /> {report.assignee.fullName}</span>}
                                {report.responseDueAt && <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 ${!isReportClosed(report) && new Date(report.responseDueAt).getTime() < currentTimestamp ? "bg-red-100 text-red-800" : "bg-amber-50 text-amber-800"}`}><CalendarClock className="h-3.5 w-3.5" /> {new Date(report.responseDueAt).toLocaleString("id-ID", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</span>}
                              </div>
                            </Link>
                          </li>
                        );
                      })}
                    </ol>
                  </div>
                </section>
              );
            })}
          </div>
        )}
      </div>
      <MobileFilterSheet open={showMobileFilters} title="Filter laporan" resultCount={pendingMobileResultCount} onClose={() => setShowMobileFilters(false)} onReset={() => { setDraftRiskFilter("semua"); setDraftLaboratoryFilter("semua"); setDraftTypeFilter("semua"); setDraftCategoryFilter("semua"); setDraftAssignmentFilter("semua"); }} onApply={() => { setRiskFilter(draftRiskFilter); setLaboratoryFilter(draftLaboratoryFilter); setTypeFilter(draftTypeFilter); setCategoryFilter(draftCategoryFilter); setAssignmentFilter(draftAssignmentFilter); setShowMobileFilters(false); }}>
        <label className="text-sm font-semibold text-slate-700">Tingkat bahaya<select value={draftRiskFilter} onChange={(event) => setDraftRiskFilter(event.target.value as "semua" | RiskLevel)} className="mt-2 min-h-12 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm"><option value="semua">Semua tingkat risiko</option><option value="kritis">Kritis</option><option value="tinggi">Tinggi</option><option value="sedang">Sedang</option><option value="rendah">Rendah</option></select></label>
        <label className="text-sm font-semibold text-slate-700">Jenis laporan<select value={draftTypeFilter} onChange={(event) => setDraftTypeFilter(event.target.value as "semua" | ReportType)} className="mt-2 min-h-12 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm"><option value="semua">Semua jenis laporan</option>{Object.entries(REPORT_TYPE_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
        <label className="text-sm font-semibold text-slate-700">Kategori bahaya<select value={draftCategoryFilter} onChange={(event) => setDraftCategoryFilter(event.target.value as "semua" | HazardCategory)} className="mt-2 min-h-12 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm"><option value="semua">Semua kategori</option>{Object.entries(HAZARD_CATEGORY_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
        <label className="text-sm font-semibold text-slate-700">Laboratorium<select value={draftLaboratoryFilter} onChange={(event) => setDraftLaboratoryFilter(event.target.value)} className="mt-2 min-h-12 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm"><option value="semua">Semua laboratorium</option>{laboratories.map((laboratory) => <option key={laboratory.id} value={laboratory.id}>{laboratory.name}</option>)}</select></label>
        {canManageResponses && <label className="text-sm font-semibold text-slate-700">Penugasan respons<select value={draftAssignmentFilter} onChange={(event) => setDraftAssignmentFilter(event.target.value as AssignmentFilter)} className="mt-2 min-h-12 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm"><option value="semua">Semua penugasan</option><option value="saya">Ditugaskan kepada saya</option><option value="belum_ditetapkan">Belum ada PIC</option><option value="terlambat">Tenggat terlewati</option></select></label>}
      </MobileFilterSheet>
    </AppShell>
  );
}
