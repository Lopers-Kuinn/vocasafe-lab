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
} from "lucide-react";
import AppShell from "@/components/AppShell";
import {
  fetchActiveChecklistTemplates,
  fetchChecklistResults,
  type DatabaseChecklistResult,
  type DatabaseChecklistTemplate,
} from "@/lib/checklists";
import type { RiskLevel } from "@/types";

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
      date.getFullYear() === now.getFullYear() &&
      date.getMonth() === now.getMonth() &&
      date.getDate() === now.getDate()
    );
  }

  const days = filter === "7_hari" ? 7 : filter === "30_hari" ? 30 : 365;
  return date.getTime() >= now.getTime() - days * 24 * 60 * 60 * 1000;
}

export default function ChecklistsPage() {
  const [results, setResults] = useState<DatabaseChecklistResult[]>([]);
  const [templates, setTemplates] = useState<DatabaseChecklistTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [findingFilter, setFindingFilter] = useState<FindingFilter>("semua");
  const [timeFilter, setTimeFilter] = useState<TimeFilter>("semua");

  useEffect(() => {
    let active = true;

    void Promise.all([
      fetchChecklistResults(),
      fetchActiveChecklistTemplates(),
    ]).then(([result, templateResult]) => {
      if (!active) return;
      setResults(result.results);
      setTemplates(templateResult.templates);
      const errors = [result.error, templateResult.error].filter(Boolean);
      setError(
        errors.length > 0
          ? `Data checklist tidak dapat dimuat dari Supabase: ${errors.join("; ")}`
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

      return (
        matchesSearch &&
        matchesFinding &&
        matchesTimeFilter(result.completedAt, timeFilter)
      );
    });
  }, [findingFilter, results, search, timeFilter]);

  return (
    <AppShell>
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Checklist K3</h1>
            <p className="mt-1 text-sm text-slate-500">
              Hasil inspeksi K3 yang tersimpan di Supabase.
            </p>
          </div>
          <Link
            href="/checklists/new"
            className="inline-flex min-h-10 items-center gap-1 rounded-md bg-emerald-600 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-700"
          >
            <Plus className="h-4 w-4" /> Isi Checklist
          </Link>
        </div>

        <section className="rounded-2xl border border-white/80 bg-white/85 p-4 shadow-sm backdrop-blur-xl">
          <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_220px]">
            <label className="relative block">
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

          <div className="mt-4 flex gap-2 overflow-x-auto pb-1" aria-label="Filter status temuan">
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
        </section>

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
            <section className="space-y-3">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">
                  Template Aktif
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  Template dan item dimuat langsung dari Supabase.
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
                      className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm transition-shadow hover:shadow-md"
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
                            {template.items.length} item pemeriksaan
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
            </section>

            <section className="space-y-3">
              <h2 className="text-lg font-semibold text-slate-900">
                Hasil Checklist
              </h2>

              {filteredResults.length === 0 ? (
          <div className="rounded-lg border border-slate-200 bg-white p-8 text-center">
            <ClipboardCheck className="mx-auto mb-3 h-10 w-10 text-slate-300" />
            <p className="text-slate-500">
              {results.length === 0
                ? "Belum ada hasil checklist di Supabase."
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
                className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm"
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0 flex-1">
                    <h2 className="font-semibold text-slate-900">
                      {result.template?.title ?? "Template tidak tersedia"}
                    </h2>
                    <p className="mt-1 text-sm text-slate-500">
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
                  <p className="mt-3 border-t border-slate-100 pt-3 text-sm text-slate-600">
                    {result.overallNote}
                  </p>
                )}
              </article>
            ))}
          </div>
              )}
            </section>
          </>
        )}
      </div>
    </AppShell>
  );
}
