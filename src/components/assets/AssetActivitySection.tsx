"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  AlertCircle,
  ClipboardCheck,
  FileWarning,
  History,
  Loader2,
  Plus,
  RefreshCw,
  Wrench,
  X,
} from "lucide-react";
import {
  addAssetActivity,
  fetchAssetActivities,
  type AddAssetActivityInput,
  type AssetActivity,
} from "@/lib/assets";

interface AssetActivitySectionProps {
  assetId: string;
  canManage: boolean;
}

function localDateTimeValue(): string {
  const now = new Date();
  const offset = now.getTimezoneOffset() * 60_000;
  return new Date(now.getTime() - offset).toISOString().slice(0, 16);
}

function activityIcon(type: AssetActivity["type"]) {
  if (type === "checklist") return ClipboardCheck;
  if (type === "laporan") return FileWarning;
  if (type === "servis" || type === "perbaikan") return Wrench;
  return History;
}

export default function AssetActivitySection({
  assetId,
  canManage,
}: AssetActivitySectionProps) {
  const [activities, setActivities] = useState<AssetActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [type, setType] = useState<AddAssetActivityInput["type"]>("servis");
  const [title, setTitle] = useState("");
  const [note, setNote] = useState("");
  const [occurredAt, setOccurredAt] = useState(localDateTimeValue);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  function loadActivities() {
    setLoading(true);
    void fetchAssetActivities(assetId).then((result) => {
      setActivities(result.activities);
      setError(result.error ?? "");
      setLoading(false);
    });
  }

  useEffect(() => {
    let active = true;
    void fetchAssetActivities(assetId).then((result) => {
      if (!active) return;
      setActivities(result.activities);
      setError(result.error ?? "");
      setLoading(false);
    });
    return () => {
      active = false;
    };
  }, [assetId]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError("");
    if (!title.trim()) {
      setFormError("Judul aktivitas wajib diisi.");
      return;
    }

    const date = new Date(occurredAt);
    if (Number.isNaN(date.getTime())) {
      setFormError("Tanggal aktivitas tidak valid.");
      return;
    }

    setSaving(true);
    const result = await addAssetActivity({
      assetId,
      type,
      title,
      note,
      occurredAt: date.toISOString(),
    });
    setSaving(false);

    if (result.error) {
      setFormError(result.error);
      return;
    }

    setTitle("");
    setNote("");
    setOccurredAt(localDateTimeValue());
    setShowForm(false);
    loadActivities();
  }

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="rounded-xl bg-emerald-100 p-2 text-emerald-700">
            <History className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Riwayat & Log Aktivitas</h2>
            <p className="mt-1 text-sm text-slate-500">
              Gabungan inspeksi, laporan risiko, servis, dan catatan perbaikan.
            </p>
          </div>
        </div>
        {canManage && (
          <button
            type="button"
            onClick={() => setShowForm((value) => !value)}
            className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-800 hover:bg-emerald-100"
          >
            {showForm ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
            {showForm ? "Tutup" : "Catat Aktivitas"}
          </button>
        )}
      </div>

      {showForm && canManage && (
        <form onSubmit={handleSubmit} className="mt-5 rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <label>
              <span className="mb-1 block text-xs font-semibold text-slate-600">Jenis aktivitas</span>
              <select
                value={type}
                onChange={(event) => setType(event.target.value as AddAssetActivityInput["type"])}
                className="min-h-11 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
              >
                <option value="servis">Servis</option>
                <option value="perbaikan">Perbaikan</option>
                <option value="catatan">Catatan umum</option>
              </select>
            </label>
            <label>
              <span className="mb-1 block text-xs font-semibold text-slate-600">Tanggal</span>
              <input
                type="datetime-local"
                value={occurredAt}
                onChange={(event) => setOccurredAt(event.target.value)}
                className="min-h-11 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
                required
              />
            </label>
            <label className="sm:col-span-2">
              <span className="mb-1 block text-xs font-semibold text-slate-600">Judul</span>
              <input
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="Contoh: Perbaikan kabel daya"
                className="min-h-11 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
                required
              />
            </label>
            <label className="sm:col-span-2">
              <span className="mb-1 block text-xs font-semibold text-slate-600">Catatan</span>
              <textarea
                value={note}
                onChange={(event) => setNote(event.target.value)}
                rows={3}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
              />
            </label>
          </div>
          {formError && <p role="alert" className="mt-3 text-sm text-red-600">{formError}</p>}
          <button
            type="submit"
            disabled={saving}
            className="mt-3 inline-flex min-h-10 items-center gap-2 rounded-xl bg-emerald-700 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-800 disabled:opacity-60"
          >
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            {saving ? "Menyimpan..." : "Simpan Aktivitas"}
          </button>
        </form>
      )}

      {loading ? (
        <div className="flex min-h-32 items-center justify-center text-sm text-slate-500">
          <Loader2 className="mr-2 h-5 w-5 animate-spin text-emerald-600" /> Memuat aktivitas...
        </div>
      ) : error && activities.length === 0 ? (
        <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          <div className="flex items-start gap-2">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <div>
              <p>Riwayat belum dapat dimuat: {error}</p>
              <button
                type="button"
                onClick={loadActivities}
                className="mt-2 inline-flex items-center gap-1 font-semibold"
              >
                <RefreshCw className="h-4 w-4" /> Coba lagi
              </button>
            </div>
          </div>
        </div>
      ) : activities.length === 0 ? (
        <p className="mt-6 rounded-xl border border-dashed border-slate-200 p-6 text-center text-sm text-slate-500">
          Belum ada aktivitas untuk aset ini.
        </p>
      ) : (
        <div className="relative mt-6 space-y-4 before:absolute before:bottom-3 before:left-[17px] before:top-3 before:w-px before:bg-slate-200">
          {activities.slice(0, 20).map((activity) => {
            const Icon = activityIcon(activity.type);
            const content = (
              <div className="relative flex gap-3 rounded-xl p-2 hover:bg-slate-50">
                <div className="relative z-10 mt-0.5 rounded-full border border-emerald-100 bg-white p-2 text-emerald-700 shadow-sm">
                  <Icon className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <h3 className="font-semibold text-slate-800">{activity.title}</h3>
                    <time className="text-xs text-slate-400">
                      {new Intl.DateTimeFormat("id-ID", {
                        dateStyle: "medium",
                        timeStyle: "short",
                      }).format(new Date(activity.occurredAt))}
                    </time>
                  </div>
                  {activity.note && <p className="mt-1 text-sm text-slate-500">{activity.note}</p>}
                </div>
              </div>
            );

            return activity.href ? (
              <Link key={activity.id} href={activity.href} className="block">
                {content}
              </Link>
            ) : (
              <div key={activity.id}>{content}</div>
            );
          })}
        </div>
      )}
    </section>
  );
}
