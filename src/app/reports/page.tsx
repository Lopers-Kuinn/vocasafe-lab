"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AlertCircle, FileWarning, Loader2, MapPin, Plus, Search, ShieldAlert, SlidersHorizontal, Tag } from "lucide-react";
import AppShell from "@/components/AppShell";
import MobileFilterSheet from "@/components/mobile/MobileFilterSheet";
import { fetchLaboratories, type LaboratorySummary } from "@/lib/assets";
import {
  fetchReports,
  HAZARD_CATEGORY_LABELS,
  REPORT_TYPE_LABELS,
  type DatabaseReport,
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

  useEffect(() => {
    let active = true;

    void Promise.all([fetchReports(), fetchLaboratories()]).then(([result, laboratoryResult]) => {
      if (!active) return;
      setReports(result.reports);
      setLaboratories(laboratoryResult.laboratories);
      setError(
        result.error || laboratoryResult.error
          ? `Sebagian laporan belum dapat dimuat: ${[result.error, laboratoryResult.error]
              .filter(Boolean)
              .join("; ")}`
          : "",
      );
      setLoading(false);
    });

    return () => {
      active = false;
    };
  }, []);

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
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();

        return (
          (riskFilter === "semua" || report.riskCategory === riskFilter) &&
          (laboratoryFilter === "semua" || report.laboratoryId === laboratoryFilter) &&
          (typeFilter === "semua" || report.reportType === typeFilter) &&
          (categoryFilter === "semua" || report.hazardCategory === categoryFilter) &&
          (!term || searchable.includes(term))
        );
      }),
    [categoryFilter, laboratoryFilter, reports, riskFilter, search, typeFilter],
  );

  const pendingMobileResultCount = useMemo(() => reports.filter((report) => {
    const term = search.trim().toLowerCase();
    const searchable = [report.title, report.description, report.location, report.asset?.name, report.asset?.code, report.laboratory?.name].filter(Boolean).join(" ").toLowerCase();
    return (draftRiskFilter === "semua" || report.riskCategory === draftRiskFilter) &&
      (draftLaboratoryFilter === "semua" || report.laboratoryId === draftLaboratoryFilter) &&
      (draftTypeFilter === "semua" || report.reportType === draftTypeFilter) &&
      (draftCategoryFilter === "semua" || report.hazardCategory === draftCategoryFilter) &&
      (!term || searchable.includes(term));
  }).length, [draftCategoryFilter, draftLaboratoryFilter, draftRiskFilter, draftTypeFilter, reports, search]);

  const activeFilterCount = [riskFilter, laboratoryFilter, typeFilter, categoryFilter].filter((value) => value !== "semua").length;

  function openMobileFilters() {
    setDraftRiskFilter(riskFilter); setDraftLaboratoryFilter(laboratoryFilter);
    setDraftTypeFilter(typeFilter); setDraftCategoryFilter(categoryFilter);
    setShowMobileFilters(true);
  }

  useViewStateMemory(
    "vocasafe_reports_list_view_v1",
    { search, riskFilter, laboratoryFilter, typeFilter, categoryFilter },
    (saved) => {
      if (typeof saved.search === "string") setSearch(saved.search);
      if (typeof saved.riskFilter === "string") setRiskFilter(saved.riskFilter as "semua" | RiskLevel);
      if (typeof saved.laboratoryFilter === "string") setLaboratoryFilter(saved.laboratoryFilter);
      if (typeof saved.typeFilter === "string") setTypeFilter(saved.typeFilter as "semua" | ReportType);
      if (typeof saved.categoryFilter === "string") setCategoryFilter(saved.categoryFilter as "semua" | HazardCategory);
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

        <section className="grid gap-3 rounded-2xl border border-white/80 bg-white/85 p-4 shadow-sm backdrop-blur-xl sm:grid-cols-2 xl:grid-cols-4">
          <label className="relative block sm:col-span-2 xl:col-span-4">
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
        </section>

        {activeFilterCount > 0 && <div className="-mt-3 flex gap-2 overflow-x-auto pb-1 sm:hidden" aria-label="Filter laporan aktif">
          {riskFilter !== "semua" && <button type="button" onClick={() => setRiskFilter("semua")} className="shrink-0 rounded-full bg-emerald-100 px-3 py-1.5 text-xs font-semibold text-emerald-800">{capitalize(riskFilter)} ×</button>}
          {typeFilter !== "semua" && <button type="button" onClick={() => setTypeFilter("semua")} className="shrink-0 rounded-full bg-emerald-100 px-3 py-1.5 text-xs font-semibold text-emerald-800">{REPORT_TYPE_LABELS[typeFilter]} ×</button>}
          {categoryFilter !== "semua" && <button type="button" onClick={() => setCategoryFilter("semua")} className="shrink-0 rounded-full bg-emerald-100 px-3 py-1.5 text-xs font-semibold text-emerald-800">{HAZARD_CATEGORY_LABELS[categoryFilter]} ×</button>}
          {laboratoryFilter !== "semua" && <button type="button" onClick={() => setLaboratoryFilter("semua")} className="shrink-0 rounded-full bg-emerald-100 px-3 py-1.5 text-xs font-semibold text-emerald-800">{laboratories.find((item) => item.id === laboratoryFilter)?.name ?? "Laboratorium"} ×</button>}
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
            <p className="text-sm text-slate-500">
              Menampilkan {filteredReports.length} dari {reports.length} laporan.
            </p>
            {filteredReports.map((report) => (
              <Link
                key={report.id}
                href={`/reports/${report.id}`}
                className="block min-w-0 overflow-hidden rounded-lg border border-slate-200 bg-white p-4 shadow-sm transition-shadow hover:shadow-md"
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0 flex-1">
                    <p className="break-words font-semibold text-slate-900">{report.title}</p>
                    <p className="mt-1 break-words text-sm text-slate-500">
                      {report.asset
                        ? `${report.asset.name} (${report.asset.code})`
                        : "Tanpa aset"}
                    </p>
                    <p className="mt-1 break-words text-xs text-slate-400">
                      {report.laboratory?.name ?? report.location} &middot;{" "}
                      {new Date(report.occurredAt).toLocaleDateString("id-ID", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                    <span className="inline-flex rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-medium text-blue-700">{REPORT_TYPE_LABELS[report.reportType]}</span>
                    <span className="inline-flex rounded-full bg-violet-50 px-2.5 py-0.5 text-xs font-medium text-violet-700">{HAZARD_CATEGORY_LABELS[report.hazardCategory]}</span>
                    {report.hazardActive && <span className="inline-flex rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-medium text-red-800">Bahaya aktif</span>}
                    <span
                      className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${riskColors[report.riskCategory]}`}
                    >
                      {capitalize(report.riskCategory)} &middot; {report.riskScore}
                    </span>
                    <span
                      className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${statusColors[report.status]}`}
                    >
                      {statusLabels[report.status]}
                    </span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
      <MobileFilterSheet open={showMobileFilters} title="Filter laporan" resultCount={pendingMobileResultCount} onClose={() => setShowMobileFilters(false)} onReset={() => { setDraftRiskFilter("semua"); setDraftLaboratoryFilter("semua"); setDraftTypeFilter("semua"); setDraftCategoryFilter("semua"); }} onApply={() => { setRiskFilter(draftRiskFilter); setLaboratoryFilter(draftLaboratoryFilter); setTypeFilter(draftTypeFilter); setCategoryFilter(draftCategoryFilter); setShowMobileFilters(false); }}>
        <label className="text-sm font-semibold text-slate-700">Tingkat bahaya<select value={draftRiskFilter} onChange={(event) => setDraftRiskFilter(event.target.value as "semua" | RiskLevel)} className="mt-2 min-h-12 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm"><option value="semua">Semua tingkat risiko</option><option value="kritis">Kritis</option><option value="tinggi">Tinggi</option><option value="sedang">Sedang</option><option value="rendah">Rendah</option></select></label>
        <label className="text-sm font-semibold text-slate-700">Jenis laporan<select value={draftTypeFilter} onChange={(event) => setDraftTypeFilter(event.target.value as "semua" | ReportType)} className="mt-2 min-h-12 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm"><option value="semua">Semua jenis laporan</option>{Object.entries(REPORT_TYPE_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
        <label className="text-sm font-semibold text-slate-700">Kategori bahaya<select value={draftCategoryFilter} onChange={(event) => setDraftCategoryFilter(event.target.value as "semua" | HazardCategory)} className="mt-2 min-h-12 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm"><option value="semua">Semua kategori</option>{Object.entries(HAZARD_CATEGORY_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
        <label className="text-sm font-semibold text-slate-700">Laboratorium<select value={draftLaboratoryFilter} onChange={(event) => setDraftLaboratoryFilter(event.target.value)} className="mt-2 min-h-12 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm"><option value="semua">Semua laboratorium</option>{laboratories.map((laboratory) => <option key={laboratory.id} value={laboratory.id}>{laboratory.name}</option>)}</select></label>
      </MobileFilterSheet>
    </AppShell>
  );
}
