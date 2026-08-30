"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertCircle,
  CalendarRange,
  ClipboardCheck,
  Loader2,
  Plus,
  Search,
  SlidersHorizontal,
} from "lucide-react";
import AppShell from "@/components/AppShell";
import MobileFilterSheet from "@/components/mobile/MobileFilterSheet";
import { getCurrentUserProfile } from "@/lib/auth";
import {
  fetchActiveChecklistTemplates,
  fetchChecklistResults,
  type DatabaseChecklistResult,
  type DatabaseChecklistTemplate,
} from "@/lib/checklists";
import type { RiskLevel } from "@/types";
import { useViewStateMemory } from "@/lib/use-view-state-memory";

const riskColors: Record<RiskLevel, string> = {
  rendah: "bg-green-100 text-green-800",
  sedang: "bg-yellow-100 text-yellow-800",
  tinggi: "bg-orange-100 text-orange-800",
  kritis: "bg-red-100 text-red-800",
};

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

type FindingFilter = "semua" | "tanpa_temuan" | RiskLevel;
type TimeFilter = "semua" | "hari_ini" | "7_hari" | "30_hari" | "12_bulan";

const findingFilters: Array<{ value: FindingFilter; label: string; className: string }> = [
  { value: "semua", label: "Semua", className: "border-slate-200 text-slate-600" },
  {
    value: "tanpa_temuan",
    label: "Tidak Ada Temuan",
    className: "border-emerald-200 text-emerald-700",
  },
  { value: "rendah", label: "Rendah", className: "border-green-200 text-green-700" },
  { value: "sedang", label: "Sedang", className: "border-yellow-200 text-yellow-700" },
  { value: "tinggi", label: "Tinggi", className: "border-orange-200 text-orange-700" },
  { value: "kritis", label: "Kritis", className: "border-red-200 text-red-700" },
];

function matchesTimeFilter(value: string, filter: TimeFilter): boolean {
  if (filter === "semua") return true;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return false;

  const now = new Date();
  if (filter === "hari_ini") {
    return (
      date.getTime() <= now.getTime() &&
      date.getFullYear() === now.getFullYear() &&
      date.getMonth() === now.getMonth() &&
      date.getDate() === now.getDate()
    );
  }

  const days = filter === "7_hari" ? 7 : filter === "30_hari" ? 30 : 365;
  return (
    date.getTime() >= now.getTime() - days * 24 * 60 * 60 * 1000 &&
    date.getTime() <= now.getTime()
  );
}

export default function ChecklistsPage() {
  const [results, setResults] = useState<DatabaseChecklistResult[]>([]);
  const [templates, setTemplates] = useState<DatabaseChecklistTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [findingFilter, setFindingFilter] = useState<FindingFilter>("semua");
  const [timeFilter, setTimeFilter] = useState<TimeFilter>("semua");
  const [assetFilter, setAssetFilter] = useState("semua");
  const [templateFilter, setTemplateFilter] = useState("semua");
  const [laboratoryFilter, setLaboratoryFilter] = useState("semua");
  const [canCreate, setCanCreate] = useState(false);
  const [showMobileFilters, setShowMobileFilters] = useState(false);
  const [draftFindingFilter, setDraftFindingFilter] = useState<FindingFilter>("semua");
  const [draftTimeFilter, setDraftTimeFilter] = useState<TimeFilter>("semua");
  const [draftAssetFilter, setDraftAssetFilter] = useState("semua");
  const [draftTemplateFilter, setDraftTemplateFilter] = useState("semua");
  const [draftLaboratoryFilter, setDraftLaboratoryFilter] = useState("semua");

  useEffect(() => {
    let active = true;

    void Promise.all([
      fetchChecklistResults(),
      fetchActiveChecklistTemplates(),
      getCurrentUserProfile(),
    ]).then(([result, templateResult, profileResult]) => {
      if (!active) return;
      setResults(result.results);
      setTemplates(templateResult.templates);
      setCanCreate(
        Boolean(
          profileResult.user &&
            ["dosen", "teknisi", "admin"].includes(profileResult.user.role),
        ),
      );
      const errors = [result.error, templateResult.error].filter(Boolean);
      setError(
        errors.length > 0
          ? "Sebagian data checklist tidak dapat dimuat. Coba lagi atau hubungi admin jika masalah berlanjut."
          : "",
      );
      setLoading(false);
    });

    return () => {
      active = false;
    };
  }, []);

  const filteredResults = useMemo(() => {
    const query = search.trim().toLocaleLowerCase("id-ID");

    return results.filter((result) => {
      const matchesSearch =
        !query ||
        [
          result.asset?.name,
          result.asset?.code,
          result.asset?.location,
          result.inspector?.fullName,
          result.overallNote,
        ].some((value) => value?.toLocaleLowerCase("id-ID").includes(query));
      const matchesFinding =
        findingFilter === "semua" ||
        (findingFilter === "tanpa_temuan"
          ? !result.hasRiskFinding
          : result.hasRiskFinding && result.riskCategory === findingFilter);
      const matchesAsset = assetFilter === "semua" || result.assetId === assetFilter;
      const matchesTemplate =
        templateFilter === "semua" || result.templateId === templateFilter;
      const matchesLaboratory =
        laboratoryFilter === "semua" || result.laboratoryId === laboratoryFilter;

      return (
        matchesSearch &&
        matchesFinding &&
        matchesAsset &&
        matchesTemplate &&
        matchesLaboratory &&
        matchesTimeFilter(result.completedAt, timeFilter)
      );
    });
  }, [assetFilter, findingFilter, laboratoryFilter, results, search, templateFilter, timeFilter]);

  const filterOptions = useMemo(() => ({
    assets: [...new Map(results.filter((result) => result.asset).map((result) => [result.assetId, result.asset])).entries()],
    templates: [...new Map(results.filter((result) => result.template).map((result) => [result.templateId, result.template])).entries()],
    laboratories: [...new Map(results.filter((result) => result.laboratory).map((result) => [result.laboratoryId, result.laboratory])).entries()],
  }), [results]);

  const pendingMobileResultCount = useMemo(() => {
    const query = search.trim().toLocaleLowerCase("id-ID");
    return results.filter((result) => {
      const matchesSearch = !query || [result.asset?.name, result.asset?.code, result.asset?.location, result.inspector?.fullName, result.overallNote].some((value) => value?.toLocaleLowerCase("id-ID").includes(query));
      const matchesFinding = draftFindingFilter === "semua" || (draftFindingFilter === "tanpa_temuan" ? !result.hasRiskFinding : result.hasRiskFinding && result.riskCategory === draftFindingFilter);
      return matchesSearch && matchesFinding &&
        (draftAssetFilter === "semua" || result.assetId === draftAssetFilter) &&
        (draftTemplateFilter === "semua" || result.templateId === draftTemplateFilter) &&
        (draftLaboratoryFilter === "semua" || result.laboratoryId === draftLaboratoryFilter) &&
        matchesTimeFilter(result.completedAt, draftTimeFilter);
    }).length;
  }, [draftAssetFilter, draftFindingFilter, draftLaboratoryFilter, draftTemplateFilter, draftTimeFilter, results, search]);

  const activeFilterCount = [findingFilter, timeFilter, assetFilter, templateFilter, laboratoryFilter].filter((value) => value !== "semua").length;

  function openMobileFilters() {
    setDraftFindingFilter(findingFilter); setDraftTimeFilter(timeFilter);
    setDraftAssetFilter(assetFilter); setDraftTemplateFilter(templateFilter);
    setDraftLaboratoryFilter(laboratoryFilter); setShowMobileFilters(true);
  }

  useViewStateMemory(
    "vocasafe_checklists_list_view_v1",
    { search, findingFilter, timeFilter, assetFilter, templateFilter, laboratoryFilter },
    (saved) => {
      if (typeof saved.search === "string") setSearch(saved.search);
      if (typeof saved.findingFilter === "string") setFindingFilter(saved.findingFilter as FindingFilter);
      if (typeof saved.timeFilter === "string") setTimeFilter(saved.timeFilter as TimeFilter);
      if (typeof saved.assetFilter === "string") setAssetFilter(saved.assetFilter);
      if (typeof saved.templateFilter === "string") setTemplateFilter(saved.templateFilter);
      if (typeof saved.laboratoryFilter === "string") setLaboratoryFilter(saved.laboratoryFilter);
    },
    !loading,
  );

  return (
    <AppShell>
      <div className="space-y-6">
        <div className="flex flex-col items-stretch gap-3 min-[420px]:flex-row min-[420px]:items-center min-[420px]:justify-between">
          <div className="min-w-0">
            <h1 className="text-2xl font-bold text-slate-900">Checklist K3</h1>
            <p className="mt-1 text-sm text-slate-500">
              Riwayat hasil inspeksi keselamatan laboratorium.
            </p>
          </div>
          {canCreate && (
            <Link
              href="/checklists/new"
              className="inline-flex min-h-11 w-full items-center justify-center gap-1 rounded-xl bg-emerald-600 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-700 min-[420px]:w-auto"
            >
              <Plus className="h-4 w-4" /> Isi Checklist
            </Link>
          )}
        </div>

        <section className="rounded-2xl border border-white/80 bg-white/85 p-4 shadow-sm backdrop-blur-xl">
          <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_220px]">
            <label className="relative hidden md:block">
              <span className="sr-only">Cari riwayat checklist</span>
              <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-slate-400" />
              <input
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Cari mesin, kode aset, lokasi, atau pemeriksa"
                className="min-h-11 w-full rounded-xl border border-slate-200 bg-white py-2 pl-10 pr-3 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
              />
            </label>

            <label className="relative block">
              <span className="sr-only">Filter waktu inspeksi</span>
              <CalendarRange className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-slate-400" />
              <select
                value={timeFilter}
                onChange={(event) => setTimeFilter(event.target.value as TimeFilter)}
                className="min-h-11 w-full rounded-xl border border-slate-200 bg-white py-2 pl-10 pr-3 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
              >
                <option value="semua">Semua waktu</option>
                <option value="hari_ini">Hari ini</option>
                <option value="7_hari">7 hari terakhir</option>
                <option value="30_hari">30 hari terakhir</option>
                <option value="12_bulan">12 bulan terakhir</option>
              </select>
            </label>
          </div>

          <div className="-mx-1 mt-4 flex gap-2 overflow-x-auto px-1 pb-1 sm:flex-wrap" aria-label="Filter status temuan">
            {findingFilters.map((filter) => {
              const active = findingFilter === filter.value;
              return (
                <button
                  key={filter.value}
                  type="button"
                  onClick={() => setFindingFilter(filter.value)}
                  aria-pressed={active}
                  className={`min-h-9 shrink-0 rounded-full border px-3 py-1.5 text-xs font-semibold ${
                    active
                      ? "border-emerald-700 bg-emerald-700 text-white shadow-sm"
                      : `bg-white hover:bg-slate-50 ${filter.className}`
                  }`}
                >
                  {filter.label}
                </button>
              );
            })}
          </div>
          <button type="button" onClick={openMobileFilters} className="mt-4 flex min-h-12 w-full items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm font-semibold text-slate-700 md:hidden"><span className="inline-flex items-center gap-2"><SlidersHorizontal className="h-4 w-4" /> Semua filter</span><span className="rounded-full bg-white px-2 py-0.5 text-xs text-slate-500">{activeFilterCount} aktif</span></button>
          <div className="mt-4 hidden gap-3 md:grid md:grid-cols-3">
            <label className="text-xs font-semibold text-slate-600">Aset
              <select value={assetFilter} onChange={(event) => setAssetFilter(event.target.value)} className="mt-1 min-h-11 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-normal">
                <option value="semua">Semua aset</option>
                {filterOptions.assets.map(([id, asset]) => asset && <option key={id} value={id ?? ""}>{asset.name} ({asset.code})</option>)}
              </select>
            </label>
            <label className="text-xs font-semibold text-slate-600">Template
              <select value={templateFilter} onChange={(event) => setTemplateFilter(event.target.value)} className="mt-1 min-h-11 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-normal">
                <option value="semua">Semua template</option>
                {filterOptions.templates.map(([id, template]) => template && <option key={id} value={id ?? ""}>{template.title}</option>)}
              </select>
            </label>
            <label className="text-xs font-semibold text-slate-600">Laboratorium
              <select value={laboratoryFilter} onChange={(event) => setLaboratoryFilter(event.target.value)} className="mt-1 min-h-11 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-normal">
                <option value="semua">Semua laboratorium</option>
                {filterOptions.laboratories.map(([id, laboratory]) => laboratory && <option key={id} value={id ?? ""}>{laboratory.name}</option>)}
              </select>
            </label>
          </div>
        </section>

        {activeFilterCount > 0 && <div className="-mt-3 flex gap-2 overflow-x-auto pb-1 md:hidden" aria-label="Filter checklist aktif">
          {timeFilter !== "semua" && <button type="button" onClick={() => setTimeFilter("semua")} className="shrink-0 rounded-full bg-emerald-100 px-3 py-1.5 text-xs font-semibold text-emerald-800">{timeFilter.replaceAll("_", " ")} ×</button>}
          {findingFilter !== "semua" && <button type="button" onClick={() => setFindingFilter("semua")} className="shrink-0 rounded-full bg-emerald-100 px-3 py-1.5 text-xs font-semibold text-emerald-800">{findingFilters.find((item) => item.value === findingFilter)?.label} ×</button>}
          {(assetFilter !== "semua" || templateFilter !== "semua" || laboratoryFilter !== "semua") && <button type="button" onClick={() => { setAssetFilter("semua"); setTemplateFilter("semua"); setLaboratoryFilter("semua"); }} className="shrink-0 rounded-full bg-emerald-100 px-3 py-1.5 text-xs font-semibold text-emerald-800">Filter detail ×</button>}
        </div>}

        {loading ? (
          <div className="flex min-h-48 items-center justify-center rounded-lg border border-slate-200 bg-white">
            <Loader2 className="mr-2 h-5 w-5 animate-spin text-emerald-600" />
            <span className="text-sm text-slate-500">Memuat hasil checklist...</span>
          </div>
        ) : error ? (
          <div
            role="alert"
            className="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700"
          >
            <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
            <p>{error}</p>
          </div>
        ) : (
          <>
            {canCreate && <section className="space-y-3">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">
                  Template Aktif
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  Template dan item pemeriksaan yang tersedia.
                </p>
              </div>

              {templates.length === 0 ? (
                <div className="rounded-lg border border-slate-200 bg-white p-5 text-sm text-slate-500">
                  Belum ada template checklist aktif.
                </div>
              ) : (
                <div className="grid gap-3 md:grid-cols-2">
                  {templates.map((template) => (
                    <Link
                      key={template.id}
                      href={`/checklists/new?checklistId=${template.id}`}
                      className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition-shadow hover:shadow-md"
                    >
                      <div className="flex items-start gap-3">
                        <div className="rounded-full bg-emerald-100 p-2">
                          <ClipboardCheck className="h-5 w-5 text-emerald-600" />
                        </div>
                        <div>
                          <h3 className="font-semibold text-slate-900">
                            {template.title}
                          </h3>
                          <p className="mt-1 text-sm text-slate-500">
                            Versi {template.version} · {template.items.length} item pemeriksaan
                          </p>
                          <p className="mt-1 text-xs text-slate-400">
                            {template.items.filter((item) => item.isCritical).length}{" "}
                            item kritis
                          </p>
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </section>}

            <section className="space-y-3">
              <h2 className="text-lg font-semibold text-slate-900">
                Hasil Checklist
              </h2>

              {filteredResults.length === 0 ? (
          <div className="rounded-lg border border-slate-200 bg-white p-8 text-center">
            <ClipboardCheck className="mx-auto mb-3 h-10 w-10 text-slate-300" />
            <p className="text-slate-500">
              {results.length === 0
                ? "Belum ada hasil checklist yang dapat ditampilkan."
                : "Tidak ada checklist yang sesuai pencarian atau filter."}
            </p>
          </div>
              ) : (
          <div className="space-y-3">
            <p className="text-sm text-slate-500">
              Menampilkan {filteredResults.length} dari {results.length} hasil inspeksi.
            </p>
            {filteredResults.map((result) => (
              <article
                key={result.id}
                className="min-w-0 overflow-hidden rounded-lg border border-slate-200 bg-white p-4 shadow-sm"
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0 flex-1">
                    <h2 className="break-words font-semibold text-slate-900">
                      {result.template?.title ?? "Template tidak tersedia"}
                    </h2>
                    <p className="mt-1 break-words text-sm text-slate-500">
                      {result.asset
                        ? `${result.asset.name} (${result.asset.code})`
                        : "Tanpa aset terkait"}
                    </p>
                    <p className="mt-1 text-xs text-slate-400">
                      Pemeriksa: {result.inspector?.fullName ?? "Tidak tersedia"}
                      {" · "}
                      {new Date(result.completedAt).toLocaleDateString("id-ID", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </p>
                  </div>

                  {result.riskCategory && result.riskScore !== null ? (
                    <span
                      className={`inline-flex self-start rounded-full px-2.5 py-0.5 text-xs font-medium ${riskColors[result.riskCategory]}`}
                    >
                      {capitalize(result.riskCategory)} &middot; {result.riskScore}
                    </span>
                  ) : (
                    <span className="inline-flex self-start rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-medium text-emerald-700">
                      Tidak ada temuan
                    </span>
                  )}
                </div>

                {result.overallNote && (
                  <p className="mt-3 whitespace-pre-wrap break-words border-t border-slate-100 pt-3 text-sm text-slate-600">
                    {result.overallNote}
                  </p>
                )}
                <Link
                  href={`/checklists/${result.id}`}
                  className="mt-4 inline-flex min-h-10 w-full items-center justify-center rounded-lg border border-emerald-200 bg-emerald-50 px-3 text-sm font-semibold text-emerald-800 hover:bg-emerald-100 sm:w-auto"
                >
                  Lihat Detail Hasil
                </Link>
              </article>
            ))}
          </div>
              )}
            </section>
          </>
        )}
      </div>
      <MobileFilterSheet open={showMobileFilters} title="Filter checklist" resultCount={pendingMobileResultCount} onClose={() => setShowMobileFilters(false)} onReset={() => { setDraftFindingFilter("semua"); setDraftTimeFilter("semua"); setDraftAssetFilter("semua"); setDraftTemplateFilter("semua"); setDraftLaboratoryFilter("semua"); }} onApply={() => { setFindingFilter(draftFindingFilter); setTimeFilter(draftTimeFilter); setAssetFilter(draftAssetFilter); setTemplateFilter(draftTemplateFilter); setLaboratoryFilter(draftLaboratoryFilter); setShowMobileFilters(false); }}>
        <label className="text-sm font-semibold text-slate-700">Status temuan<select value={draftFindingFilter} onChange={(event) => setDraftFindingFilter(event.target.value as FindingFilter)} className="mt-2 min-h-12 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm">{findingFilters.map((filter) => <option key={filter.value} value={filter.value}>{filter.label}</option>)}</select></label>
        <label className="text-sm font-semibold text-slate-700">Periode<select value={draftTimeFilter} onChange={(event) => setDraftTimeFilter(event.target.value as TimeFilter)} className="mt-2 min-h-12 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm"><option value="semua">Semua waktu</option><option value="hari_ini">Hari ini</option><option value="7_hari">7 hari terakhir</option><option value="30_hari">30 hari terakhir</option><option value="12_bulan">12 bulan terakhir</option></select></label>
        <label className="text-sm font-semibold text-slate-700">Aset<select value={draftAssetFilter} onChange={(event) => setDraftAssetFilter(event.target.value)} className="mt-2 min-h-12 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm"><option value="semua">Semua aset</option>{filterOptions.assets.map(([id, asset]) => asset && <option key={id} value={id ?? ""}>{asset.name} ({asset.code})</option>)}</select></label>
        <label className="text-sm font-semibold text-slate-700">Template<select value={draftTemplateFilter} onChange={(event) => setDraftTemplateFilter(event.target.value)} className="mt-2 min-h-12 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm"><option value="semua">Semua template</option>{filterOptions.templates.map(([id, template]) => template && <option key={id} value={id ?? ""}>{template.title}</option>)}</select></label>
        <label className="text-sm font-semibold text-slate-700">Laboratorium<select value={draftLaboratoryFilter} onChange={(event) => setDraftLaboratoryFilter(event.target.value)} className="mt-2 min-h-12 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm"><option value="semua">Semua laboratorium</option>{filterOptions.laboratories.map(([id, laboratory]) => laboratory && <option key={id} value={id ?? ""}>{laboratory.name}</option>)}</select></label>
      </MobileFilterSheet>
    </AppShell>
  );
}
