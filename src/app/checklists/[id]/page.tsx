"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  AlertCircle,
  ArrowLeft,
  CalendarClock,
  ExternalLink,
  FileCheck2,
  Loader2,
  ShieldAlert,
  UserRoundCheck,
} from "lucide-react";
import AppShell from "@/components/AppShell";
import {
  fetchChecklistAssignees,
  fetchChecklistResultDetail,
  saveChecklistCorrectiveAction,
  uploadChecklistEvidence,
  type ChecklistAssignee,
  type ChecklistResultDetail,
  type ControlHierarchy,
  type CorrectiveAction,
  type CorrectiveActionStatus,
} from "@/lib/checklist-v2";

const hierarchyOptions: Array<{ value: ControlHierarchy; label: string }> = [
  { value: "eliminasi", label: "Eliminasi" },
  { value: "substitusi", label: "Substitusi" },
  { value: "rekayasa_teknik", label: "Rekayasa teknik" },
  { value: "administratif", label: "Administratif" },
  { value: "apd", label: "APD" },
];

const statusOptions: Array<{ value: CorrectiveActionStatus; label: string }> = [
  { value: "terbuka", label: "Terbuka" },
  { value: "dalam_pengerjaan", label: "Dalam pengerjaan" },
  { value: "menunggu_verifikasi", label: "Menunggu verifikasi" },
  { value: "selesai", label: "Selesai dan terverifikasi" },
  { value: "dibatalkan", label: "Dibatalkan" },
];

function localDate(value: string): string {
  return new Date(value).toLocaleString("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function riskClass(category: string | null): string {
  if (category === "kritis") return "border-red-200 bg-red-50 text-red-800";
  if (category === "tinggi") return "border-orange-200 bg-orange-50 text-orange-800";
  if (category === "sedang") return "border-amber-200 bg-amber-50 text-amber-800";
  return "border-emerald-200 bg-emerald-50 text-emerald-800";
}

function CorrectiveActionEditor({
  action,
  resultId,
  assignees,
  onSaved,
}: {
  action: CorrectiveAction;
  resultId: string;
  assignees: ChecklistAssignee[];
  onSaved: () => void;
}) {
  const [status, setStatus] = useState(action.status);
  const [assignedTo, setAssignedTo] = useState(action.assignedTo ?? "");
  const [completionNote, setCompletionNote] = useState(action.completionNote);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function save() {
    if (!assignedTo) {
      setError("Pilih PIC tindakan korektif.");
      return;
    }
    if (status === "selesai" && !completionNote.trim()) {
      setError("Catatan verifikasi wajib diisi sebelum tindakan dinyatakan selesai.");
      return;
    }
    setSaving(true);
    setError("");
    const result = await saveChecklistCorrectiveAction({
      id: action.id,
      resultId,
      resultItemId: action.resultItemId,
      description: action.description,
      controlHierarchy: action.controlHierarchy,
      assignedTo: assignedTo || null,
      dueAt: action.dueAt,
      status,
      completionNote,
    });
    if (result.error) setError(result.error);
    else onSaved();
    setSaving(false);
  }

  return (
    <article className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="font-semibold text-slate-900">{action.description}</p>
          <p className="mt-1 text-xs text-slate-500">
            {hierarchyOptions.find((option) => option.value === action.controlHierarchy)?.label}
            {" · "}Tenggat {localDate(action.dueAt)}
          </p>
        </div>
        <span className="self-start rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">
          {statusOptions.find((option) => option.value === action.status)?.label}
        </span>
      </div>
      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <label className="text-xs font-medium text-slate-600">
          PIC
          <select
            value={assignedTo}
            onChange={(event) => setAssignedTo(event.target.value)}
            className="mt-1 min-h-11 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          >
            <option value="">Belum ditentukan</option>
            {assignees.map((assignee) => (
              <option key={assignee.id} value={assignee.id}>{assignee.fullName}</option>
            ))}
          </select>
        </label>
        <label className="text-xs font-medium text-slate-600">
          Status
          <select
            value={status}
            onChange={(event) => setStatus(event.target.value as CorrectiveActionStatus)}
            className="mt-1 min-h-11 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          >
            {statusOptions.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </label>
      </div>
      <label className="mt-3 block text-xs font-medium text-slate-600">
        Catatan penyelesaian/verifikasi
        <textarea
          value={completionNote}
          onChange={(event) => setCompletionNote(event.target.value)}
          rows={2}
          className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
        />
      </label>
      {error && <p className="mt-2 text-sm text-red-700">{error}</p>}
      <button
        type="button"
        onClick={save}
        disabled={saving}
        className="mt-3 inline-flex min-h-10 items-center justify-center rounded-lg bg-slate-900 px-4 text-sm font-semibold text-white disabled:opacity-60"
      >
        {saving ? "Menyimpan..." : "Simpan perubahan"}
      </button>
    </article>
  );
}

function EvidenceUploader({
  resultId,
  itemId,
  onUploaded,
}: {
  resultId: string;
  itemId: string;
  onUploaded: () => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");

  async function upload() {
    if (!file) {
      setError("Pilih foto bukti terlebih dahulu.");
      return;
    }
    setUploading(true);
    setError("");
    const result = await uploadChecklistEvidence(resultId, itemId, file);
    if (result.error) setError(result.error);
    else onUploaded();
    setUploading(false);
  }

  return (
    <div className="mt-3 rounded-lg border border-dashed border-red-300 bg-white p-3">
      <p className="text-xs font-semibold text-red-800">Bukti temuan belum tersedia</p>
      <input
        type="file"
        accept="image/jpeg,image/png,image/webp"
        onChange={(event) => setFile(event.target.files?.[0] ?? null)}
        className="mt-2 block w-full text-xs text-slate-600 file:mr-2 file:rounded-md file:border-0 file:bg-slate-100 file:px-3 file:py-2"
      />
      {error && <p className="mt-2 text-xs text-red-700">{error}</p>}
      <button type="button" onClick={upload} disabled={uploading} className="mt-2 min-h-10 rounded-lg bg-red-700 px-3 text-xs font-bold text-white disabled:opacity-60">
        {uploading ? "Mengunggah..." : "Unggah bukti"}
      </button>
    </div>
  );
}

export default function ChecklistDetailPage() {
  const params = useParams<{ id: string }>();
  const resultId = params.id;
  const [detail, setDetail] = useState<ChecklistResultDetail | null>(null);
  const [assignees, setAssignees] = useState<ChecklistAssignee[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [description, setDescription] = useState("");
  const [resultItemId, setResultItemId] = useState("");
  const [hierarchy, setHierarchy] = useState<ControlHierarchy>("rekayasa_teknik");
  const [assignedTo, setAssignedTo] = useState("");
  const [dueAt, setDueAt] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const response = await fetchChecklistResultDetail(resultId);
    setDetail(response.detail);
    setError(response.error ?? "");
    if (response.detail?.canManageActions) {
      setAssignees(await fetchChecklistAssignees(response.detail.id));
    }
    setLoading(false);
  }, [resultId]);

  useEffect(() => {
    let active = true;
    void fetchChecklistResultDetail(resultId).then(async (response) => {
      if (!active) return;
      const nextAssignees = response.detail?.canManageActions
        ? await fetchChecklistAssignees(response.detail.id)
        : [];
      if (!active) return;
      setDetail(response.detail);
      setError(response.error ?? "");
      setAssignees(nextAssignees);
      setLoading(false);
    });
    return () => {
      active = false;
    };
  }, [resultId]);

  async function addAction(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!detail || !description.trim() || !dueAt || !assignedTo) {
      setError("Deskripsi, PIC, dan tenggat tindakan wajib diisi.");
      return;
    }
    setSaving(true);
    setError("");
    const response = await saveChecklistCorrectiveAction({
      resultId: detail.id,
      resultItemId: resultItemId || null,
      description,
      controlHierarchy: hierarchy,
      assignedTo: assignedTo || null,
      dueAt: new Date(dueAt).toISOString(),
      status: "terbuka",
    });
    if (response.error) setError(response.error);
    else {
      setDescription("");
      setResultItemId("");
      setAssignedTo("");
      setDueAt("");
      await load();
    }
    setSaving(false);
  }

  if (loading) {
    return <AppShell><div className="flex min-h-72 items-center justify-center"><Loader2 className="mr-2 h-5 w-5 animate-spin" />Memuat hasil checklist...</div></AppShell>;
  }

  if (!detail) {
    return (
      <AppShell>
        <div className="mx-auto max-w-3xl rounded-2xl border border-red-200 bg-red-50 p-6 text-red-800">
          <AlertCircle className="mb-3 h-8 w-8" />
          <h1 className="text-xl font-bold">Hasil checklist tidak tersedia</h1>
          <p className="mt-2 text-sm">{error || "Data tidak ditemukan atau akses ditolak."}</p>
          <Link href="/checklists" className="mt-4 inline-flex text-sm font-semibold underline">Kembali ke checklist</Link>
        </div>
      </AppShell>
    );
  }

  const failedItems = detail.items.filter((item) => item.answer === "tidak");

  return (
    <AppShell>
      <div className="mx-auto max-w-5xl space-y-6 pb-8">
        <Link href="/checklists" className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-emerald-700">
          <ArrowLeft className="h-4 w-4" /> Kembali
        </Link>

        <header className="rounded-2xl border border-white/80 bg-white/90 p-5 shadow-sm sm:p-7">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-emerald-700">Hasil inspeksi K3</p>
              <h1 className="mt-2 text-2xl font-bold text-slate-950 sm:text-3xl">{detail.templateTitle}</h1>
              <p className="mt-2 text-sm text-slate-600">
                Versi {detail.templateVersion ?? "-"} · {localDate(detail.completedAt)} · {detail.inspector?.fullName ?? "Pemeriksa tidak tersedia"}
              </p>
            </div>
            <div className={`rounded-xl border px-4 py-3 ${riskClass(detail.riskCategory)}`}>
              <p className="text-xs font-semibold uppercase tracking-wide">Risiko</p>
              <p className="mt-1 text-xl font-bold">
                {detail.riskScore ?? 0} · {detail.riskCategory ?? "tanpa temuan"}
              </p>
            </div>
          </div>
        </header>

        {error && <p className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">{error}</p>}

        <section className="grid gap-4 md:grid-cols-2">
          <div className="rounded-2xl border border-slate-200 bg-white p-5">
            <h2 className="flex items-center gap-2 font-bold text-slate-900"><FileCheck2 className="h-5 w-5 text-emerald-600" />Konteks inspeksi</h2>
            <dl className="mt-4 space-y-3 text-sm">
              <div><dt className="text-slate-500">Aset</dt><dd className="font-semibold text-slate-900">{detail.asset?.name ?? "-"} ({detail.asset?.code ?? "-"})</dd></div>
              <div><dt className="text-slate-500">Lokasi</dt><dd className="font-semibold text-slate-900">{detail.asset?.location ?? "-"}</dd></div>
              <div><dt className="text-slate-500">Pernyataan pemeriksa</dt><dd className="font-semibold text-slate-900">{detail.inspectorAttestation ? "Dikonfirmasi" : "Data lama/belum dikonfirmasi"}</dd></div>
            </dl>
            {detail.asset && (
              <Link href={`/assets/${detail.asset.code}`} className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-emerald-700">
                Lihat detail aset <ExternalLink className="h-4 w-4" />
              </Link>
            )}
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-5">
            <h2 className="flex items-center gap-2 font-bold text-slate-900"><ShieldAlert className="h-5 w-5 text-orange-600" />Ringkasan risiko</h2>
            {detail.hasRiskFinding ? (
              <dl className="mt-4 grid grid-cols-3 gap-3 text-center text-sm">
                <div className="rounded-lg bg-slate-50 p-3"><dt className="text-xs text-slate-500">Severity</dt><dd className="text-lg font-bold">{detail.severity}</dd></div>
                <div className="rounded-lg bg-slate-50 p-3"><dt className="text-xs text-slate-500">Probability</dt><dd className="text-lg font-bold">{detail.probability}</dd></div>
                <div className="rounded-lg bg-slate-50 p-3"><dt className="text-xs text-slate-500">Exposure</dt><dd className="text-lg font-bold">{detail.exposure}</dd></div>
              </dl>
            ) : <p className="mt-4 text-sm text-emerald-700">Tidak ada temuan risiko.</p>}
            {detail.recommendation && <p className="mt-4 text-sm text-slate-600">{detail.recommendation}</p>}
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
          <h2 className="text-lg font-bold text-slate-900">Jawaban pemeriksaan</h2>
          <div className="mt-4 space-y-3">
            {detail.items.map((item, index) => (
              <article key={item.id} className={`rounded-xl border p-4 ${item.answer === "tidak" ? "border-red-200 bg-red-50/50" : "border-slate-200"}`}>
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <h3 className="font-semibold text-slate-900">{index + 1}. {item.label}</h3>
                    {item.note && <p className="mt-1 text-sm text-slate-600">{item.note}</p>}
                    {item.measurementValue !== null && <p className="mt-1 text-xs text-slate-500">Pengukuran: {item.measurementValue} {item.measurementUnit}</p>}
                  </div>
                  <span className={`self-start rounded-full px-2.5 py-1 text-xs font-bold ${item.answer === "tidak" ? "bg-red-100 text-red-800" : item.answer === "ya" ? "bg-emerald-100 text-emerald-800" : "bg-slate-100 text-slate-700"}`}>
                    {item.answer === "ya" ? "Ya" : item.answer === "tidak" ? "Tidak" : "Tidak berlaku"}
                  </span>
                </div>
                {item.evidenceUrl && (
                  <a href={item.evidenceUrl} target="_blank" rel="noreferrer" className="mt-3 block max-w-sm overflow-hidden rounded-lg border border-slate-200 bg-white">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={item.evidenceUrl} alt={`Bukti ${item.label}`} className="max-h-56 w-full object-cover" />
                    <span className="block truncate px-3 py-2 text-xs text-slate-600">{item.evidenceFileName}</span>
                  </a>
                )}
                {!item.evidenceUrl && item.answer === "tidak" && item.isCritical && detail.canUploadEvidence && item.itemId && (
                  <EvidenceUploader resultId={detail.id} itemId={item.itemId} onUploaded={() => void load()} />
                )}
              </article>
            ))}
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h2 className="flex items-center gap-2 text-lg font-bold text-slate-900"><UserRoundCheck className="h-5 w-5 text-teal-600" />Tindakan korektif</h2>
              <p className="mt-1 text-sm text-slate-500">PIC, tenggat, penyelesaian, dan verifikasi efektivitas temuan.</p>
            </div>
            {detail.inspectionReview && (
              <span className="self-start rounded-full bg-amber-100 px-3 py-1 text-xs font-bold text-amber-800">
                Status aset: {detail.inspectionReview.recommendedStatus} · {detail.inspectionReview.reviewStatus}
              </span>
            )}
          </div>

          <div className="mt-5 space-y-3">
            {detail.actions.length === 0 ? (
              <p className="rounded-xl bg-slate-50 p-4 text-sm text-slate-500">Belum ada tindakan korektif.</p>
            ) : detail.actions.map((action) => detail.canManageActions ? (
              <CorrectiveActionEditor key={action.id} action={action} resultId={detail.id} assignees={assignees} onSaved={() => void load()} />
            ) : (
              <article key={action.id} className="rounded-xl border border-slate-200 p-4">
                <p className="font-semibold text-slate-900">{action.description}</p>
                <p className="mt-1 text-sm text-slate-500">PIC: {action.assigneeName ?? "Belum ditentukan"} · Tenggat {localDate(action.dueAt)}</p>
                <p className="mt-1 text-xs font-bold text-slate-700">{statusOptions.find((option) => option.value === action.status)?.label}</p>
              </article>
            ))}
          </div>

          {detail.canManageActions && (
            <form onSubmit={addAction} className="mt-6 space-y-4 rounded-xl border border-teal-200 bg-teal-50/60 p-4">
              <h3 className="font-bold text-teal-950">Tambah tindakan korektif</h3>
              <label className="block text-sm font-medium text-slate-700">Temuan terkait
                <select value={resultItemId} onChange={(event) => setResultItemId(event.target.value)} className="mt-1 min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 py-2">
                  <option value="">Temuan umum</option>
                  {failedItems.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
                </select>
              </label>
              <label className="block text-sm font-medium text-slate-700">Tindakan yang harus dilakukan *
                <textarea required value={description} onChange={(event) => setDescription(event.target.value)} rows={3} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2" />
              </label>
              <div className="grid gap-3 md:grid-cols-3">
                <label className="text-sm font-medium text-slate-700">Hierarchy of controls
                  <select value={hierarchy} onChange={(event) => setHierarchy(event.target.value as ControlHierarchy)} className="mt-1 min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 py-2">
                    {hierarchyOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                  </select>
                </label>
                <label className="text-sm font-medium text-slate-700">PIC
                  <select required value={assignedTo} onChange={(event) => setAssignedTo(event.target.value)} className="mt-1 min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 py-2">
                    <option value="">Belum ditentukan</option>
                    {assignees.map((assignee) => <option key={assignee.id} value={assignee.id}>{assignee.fullName}</option>)}
                  </select>
                </label>
                <label className="text-sm font-medium text-slate-700">Tenggat *
                  <input required type="datetime-local" value={dueAt} onChange={(event) => setDueAt(event.target.value)} className="mt-1 min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 py-2" />
                </label>
              </div>
              <button disabled={saving} className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-teal-700 px-4 text-sm font-bold text-white disabled:opacity-60">
                <CalendarClock className="h-4 w-4" /> {saving ? "Menyimpan..." : "Simpan tindakan"}
              </button>
            </form>
          )}
        </section>
      </div>
    </AppShell>
  );
}
