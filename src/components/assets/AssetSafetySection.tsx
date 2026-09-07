"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  CalendarClock,
  CheckCircle2,
  ClipboardCheck,
  Download,
  FileBadge,
  FileText,
  Gauge,
  Loader2,
  LockKeyhole,
  Pencil,
  Plus,
  RefreshCw,
  ShieldCheck,
  Wrench,
  X,
} from "lucide-react";
import {
  fetchAssetPicCandidates,
  type AssetOperationalState,
  type DatabaseAsset,
} from "@/lib/assets";
import {
  fetchAssetSafetyBundle,
  getAssetDocumentUrl,
  reviewAssetInspection,
  saveAssetCertificate,
  saveAssetDocument,
  saveAssetSafetyControl,
  saveAssetSafetyProfile,
  saveAssetWorkOrder,
  type AssetCertificate,
  type AssetDocumentType,
  type AssetSafetyBundle,
  type AssetWorkOrder,
  type CertificateType,
  type SafetyControlStatus,
  type SafetyControlType,
  type WorkOrderStatus,
  type WorkOrderType,
} from "@/lib/asset-safety";

interface AssetSafetySectionProps {
  asset: DatabaseAsset;
  canManage: boolean;
  onAssetUpdated: () => void;
}

type ActiveForm = "profile" | "control" | "certificate" | "work-order" | "document" | null;

const EMPTY_BUNDLE: AssetSafetyBundle = {
  controls: [],
  certificates: [],
  workOrders: [],
  documents: [],
  inspectionReviews: [],
};

const operationalLabels: Record<AssetOperationalState, string> = {
  aktif: "Aktif",
  penggunaan_dibatasi: "Penggunaan Dibatasi",
  dalam_perbaikan: "Dalam Perbaikan",
  dikarantina: "Dikarantina / LOTO",
  dipensiunkan: "Dipensiunkan",
};

const operationalColors: Record<AssetOperationalState, string> = {
  aktif: "border-emerald-200 bg-emerald-50 text-emerald-900",
  penggunaan_dibatasi: "border-amber-200 bg-amber-50 text-amber-900",
  dalam_perbaikan: "border-orange-200 bg-orange-50 text-orange-900",
  dikarantina: "border-red-300 bg-red-50 text-red-900",
  dipensiunkan: "border-slate-300 bg-slate-100 text-slate-800",
};

const controlLabels: Record<SafetyControlType, string> = {
  guard: "Pelindung mesin (guard)",
  interlock: "Interlock",
  emergency_stop: "Emergency stop",
  grounding: "Grounding",
  ventilasi: "Ventilasi / LEV",
  alarm: "Alarm",
  isolasi_energi: "Isolasi energi / LOTO",
  lainnya: "Kontrol lainnya",
};

const controlStatusLabels: Record<SafetyControlStatus, string> = {
  baik: "Baik",
  perlu_dicek: "Perlu Dicek",
  tidak_berfungsi: "Tidak Berfungsi",
  tidak_berlaku: "Tidak Berlaku",
};

const certificateLabels: Record<CertificateType, string> = {
  riksa_uji: "Riksa Uji",
  kalibrasi: "Kalibrasi",
  izin_operasi: "Izin Operasi",
  sertifikat_lainnya: "Sertifikat Lainnya",
};

const workStatusLabels: Record<WorkOrderStatus, string> = {
  terbuka: "Terbuka",
  dijadwalkan: "Dijadwalkan",
  dalam_pengerjaan: "Dalam Pengerjaan",
  menunggu_verifikasi: "Menunggu Verifikasi",
  selesai: "Selesai",
  dibatalkan: "Dibatalkan",
};

function formatDate(value: string | null, withTime = false) {
  if (!value) return "Belum tersedia";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Tanggal tidak valid";
  return new Intl.DateTimeFormat("id-ID", {
    dateStyle: "medium",
    ...(withTime ? { timeStyle: "short" as const } : {}),
  }).format(date);
}

function dateInput(value: string | null) {
  if (!value) return "";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toISOString().slice(0, 10);
}

function dateTimeInput(value: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

function isoDate(value: string) {
  return value || null;
}

function isoDateTime(value: string) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function parseSpecs(value: string): Record<string, string> {
  return Object.fromEntries(
    value
      .split("\n")
      .map((line) => line.split(":"))
      .filter((parts) => parts.length >= 2)
      .map(([key, ...rest]) => [key.trim(), rest.join(":").trim()])
      .filter(([key, item]) => Boolean(key && item)),
  );
}

function specsText(specs: Record<string, string>) {
  return Object.entries(specs).map(([key, value]) => `${key}: ${value}`).join("\n");
}

function certificateState(certificate: AssetCertificate, referenceTime: number) {
  if (!certificate.expiresAt) return { label: "Tanpa masa berlaku", className: "bg-slate-100 text-slate-700" };
  const remaining = new Date(certificate.expiresAt).getTime() - referenceTime;
  if (remaining < 0) return { label: "Kedaluwarsa", className: "bg-red-100 text-red-800" };
  if (remaining <= 30 * 86_400_000) return { label: "Segera berakhir", className: "bg-amber-100 text-amber-800" };
  return { label: "Berlaku", className: "bg-emerald-100 text-emerald-800" };
}

export default function AssetSafetySection({
  asset,
  canManage,
  onAssetUpdated,
}: AssetSafetySectionProps) {
  const [bundle, setBundle] = useState<AssetSafetyBundle>(EMPTY_BUNDLE);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeForm, setActiveForm] = useState<ActiveForm>(null);
  const [referenceTime, setReferenceTime] = useState(0);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [technicians, setTechnicians] = useState<Array<{ id: string; fullName: string }>>([]);

  const [manufacturer, setManufacturer] = useState(asset.manufacturer ?? "");
  const [model, setModel] = useState(asset.model ?? "");
  const [serialNumber, setSerialNumber] = useState(asset.serialNumber ?? "");
  const [manufactureYear, setManufactureYear] = useState(asset.manufactureYear?.toString() ?? "");
  const [acquiredAt, setAcquiredAt] = useState(dateInput(asset.acquiredAt));
  const [technicalSpecs, setTechnicalSpecs] = useState(specsText(asset.technicalSpecs));
  const [energySources, setEnergySources] = useState(asset.energySources.join(", "));
  const [requiredCompetency, setRequiredCompetency] = useState(asset.requiredCompetency ?? "");
  const [regulatoryReference, setRegulatoryReference] = useState(asset.regulatoryReference ?? "");
  const [inspectionIntervalDays, setInspectionIntervalDays] = useState(asset.inspectionIntervalDays.toString());
  const [operationalState, setOperationalState] = useState(asset.operationalState);
  const [isolationReason, setIsolationReason] = useState(asset.isolationReason ?? "");

  const [controlType, setControlType] = useState<SafetyControlType>("guard");
  const [controlName, setControlName] = useState("");
  const [controlStatus, setControlStatus] = useState<SafetyControlStatus>("baik");
  const [controlVerifiedAt, setControlVerifiedAt] = useState("");
  const [controlNote, setControlNote] = useState("");

  const [certificateType, setCertificateType] = useState<CertificateType>("riksa_uji");
  const [certificateNumber, setCertificateNumber] = useState("");
  const [certificateIssuer, setCertificateIssuer] = useState("");
  const [certificateIssuedAt, setCertificateIssuedAt] = useState("");
  const [certificateExpiresAt, setCertificateExpiresAt] = useState("");
  const [certificateNote, setCertificateNote] = useState("");
  const [certificateFile, setCertificateFile] = useState<File | null>(null);

  const [editingWorkOrder, setEditingWorkOrder] = useState<AssetWorkOrder | null>(null);
  const [workType, setWorkType] = useState<WorkOrderType>("preventif");
  const [workStatus, setWorkStatus] = useState<WorkOrderStatus>("terbuka");
  const [workTitle, setWorkTitle] = useState("");
  const [workDescription, setWorkDescription] = useState("");
  const [workFindings, setWorkFindings] = useState("");
  const [workParts, setWorkParts] = useState("");
  const [workAssignedTo, setWorkAssignedTo] = useState("");
  const [workScheduledAt, setWorkScheduledAt] = useState("");
  const [workCompletedAt, setWorkCompletedAt] = useState("");
  const [workVerification, setWorkVerification] = useState("");
  const [workReturnToService, setWorkReturnToService] = useState(false);

  const [documentType, setDocumentType] = useState<AssetDocumentType>("manual");
  const [documentTitle, setDocumentTitle] = useState("");
  const [documentNote, setDocumentNote] = useState("");
  const [documentFile, setDocumentFile] = useState<File | null>(null);
  const [reviewNotes, setReviewNotes] = useState<Record<string, string>>({});

  const inspectionState = useMemo(() => {
    if (!asset.nextInspectionAt) return { label: "Jadwal belum ditentukan", overdue: false };
    const difference = new Date(asset.nextInspectionAt).getTime() - referenceTime;
    if (difference < 0) return { label: "Inspeksi melewati jadwal", overdue: true };
    const days = Math.ceil(difference / 86_400_000);
    return { label: `Inspeksi berikutnya ${days} hari lagi`, overdue: false };
  }, [asset.nextInspectionAt, referenceTime]);

  function loadBundle() {
    setLoading(true);
    void fetchAssetSafetyBundle(asset.id).then((result) => {
      setBundle(result.bundle);
      setError(result.error ?? "");
      setReferenceTime(new Date().getTime());
      setLoading(false);
    });
  }

  useEffect(() => {
    let active = true;
    void Promise.all([
      fetchAssetSafetyBundle(asset.id),
      asset.laboratoryId ? fetchAssetPicCandidates(asset.laboratoryId) : Promise.resolve({ candidates: [], error: null }),
    ]).then(([result, candidatesResult]) => {
      if (!active) return;
      setBundle(result.bundle);
      setError([result.error, candidatesResult.error].filter(Boolean).join("; "));
      setTechnicians(
        candidatesResult.candidates
          .filter((candidate) => candidate.role === "teknisi")
          .map((candidate) => ({ id: candidate.id, fullName: candidate.fullName })),
      );
      setReferenceTime(new Date().getTime());
      setLoading(false);
    });
    return () => {
      active = false;
    };
  }, [asset.id, asset.laboratoryId]);

  function openForm(form: ActiveForm) {
    setActiveForm((current) => (current === form ? null : form));
    setFormError("");
  }

  async function handleProfileSubmit(event: React.FormEvent) {
    event.preventDefault();
    setFormError("");
    const interval = Number(inspectionIntervalDays);
    if (!Number.isInteger(interval) || interval < 1 || interval > 3650) {
      setFormError("Interval inspeksi harus antara 1 dan 3650 hari.");
      return;
    }
    if (["dalam_perbaikan", "dikarantina"].includes(operationalState) && !isolationReason.trim()) {
      setFormError("Alasan isolasi wajib diisi untuk aset yang diperbaiki atau dikarantina.");
      return;
    }

    setSaving(true);
    const result = await saveAssetSafetyProfile({
      assetId: asset.id,
      manufacturer,
      model,
      serialNumber,
      manufactureYear: manufactureYear ? Number(manufactureYear) : null,
      acquiredAt: isoDate(acquiredAt),
      technicalSpecs: parseSpecs(technicalSpecs),
      energySources: energySources.split(",").map((item) => item.trim()).filter(Boolean),
      requiredCompetency,
      regulatoryReference,
      inspectionIntervalDays: interval,
      operationalState,
      isolationReason,
    });
    setSaving(false);
    if (result.error) return setFormError(result.error);
    setActiveForm(null);
    onAssetUpdated();
  }

  async function handleControlSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!controlName.trim()) return setFormError("Nama kontrol keselamatan wajib diisi.");
    setSaving(true);
    const result = await saveAssetSafetyControl({
      assetId: asset.id,
      controlType,
      name: controlName,
      status: controlStatus,
      lastVerifiedAt: isoDateTime(controlVerifiedAt),
      note: controlNote,
    });
    setSaving(false);
    if (result.error) return setFormError(result.error);
    setControlName("");
    setControlNote("");
    setActiveForm(null);
    loadBundle();
  }

  async function handleCertificateSubmit(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    const result = await saveAssetCertificate({
      assetId: asset.id,
      certificateType,
      certificateNumber,
      issuer: certificateIssuer,
      issuedAt: isoDate(certificateIssuedAt),
      expiresAt: isoDate(certificateExpiresAt),
      note: certificateNote,
      file: certificateFile,
    });
    setSaving(false);
    if (result.error) return setFormError(result.error);
    setCertificateNumber("");
    setCertificateIssuer("");
    setCertificateNote("");
    setCertificateFile(null);
    setActiveForm(null);
    loadBundle();
  }

  function editWorkOrder(workOrder: AssetWorkOrder) {
    setEditingWorkOrder(workOrder);
    setWorkType(workOrder.maintenanceType);
    setWorkStatus(workOrder.status);
    setWorkTitle(workOrder.title);
    setWorkDescription(workOrder.description ?? "");
    setWorkFindings(workOrder.findings ?? "");
    setWorkParts(workOrder.partsReplaced ?? "");
    setWorkAssignedTo(workOrder.assignedTo ?? "");
    setWorkScheduledAt(dateTimeInput(workOrder.scheduledAt));
    setWorkCompletedAt(dateTimeInput(workOrder.completedAt));
    setWorkVerification(workOrder.verificationNote ?? "");
    setWorkReturnToService(workOrder.returnToService);
    setActiveForm("work-order");
    setFormError("");
  }

  async function handleWorkOrderSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!workTitle.trim()) return setFormError("Judul perintah kerja wajib diisi.");
    setSaving(true);
    const result = await saveAssetWorkOrder({
      id: editingWorkOrder?.id,
      assetId: asset.id,
      maintenanceType: workType,
      status: workStatus,
      title: workTitle,
      description: workDescription,
      findings: workFindings,
      partsReplaced: workParts,
      assignedTo: workAssignedTo || null,
      openedAt: editingWorkOrder?.openedAt ?? new Date().toISOString(),
      scheduledAt: isoDateTime(workScheduledAt),
      completedAt: isoDateTime(workCompletedAt),
      verificationNote: workVerification,
      returnToService: workReturnToService,
    });
    setSaving(false);
    if (result.error) return setFormError(result.error);
    setEditingWorkOrder(null);
    setWorkTitle("");
    setWorkDescription("");
    setWorkFindings("");
    setWorkParts("");
    setWorkVerification("");
    setWorkReturnToService(false);
    setActiveForm(null);
    loadBundle();
    onAssetUpdated();
  }

  async function handleDocumentSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!documentTitle.trim() || !documentFile) {
      return setFormError("Judul dan file dokumen wajib diisi.");
    }
    setSaving(true);
    const result = await saveAssetDocument({
      assetId: asset.id,
      documentType,
      title: documentTitle,
      note: documentNote,
      file: documentFile,
    });
    setSaving(false);
    if (result.error) return setFormError(result.error);
    setDocumentTitle("");
    setDocumentNote("");
    setDocumentFile(null);
    setActiveForm(null);
    loadBundle();
  }

  async function openDocument(bucket: string, path: string) {
    setError("");
    const result = await getAssetDocumentUrl(bucket, path);
    if (!result.url) return setError(result.error ?? "Dokumen tidak dapat dibuka.");
    window.open(result.url, "_blank", "noopener,noreferrer");
  }

  async function handleReview(reviewId: string, decision: "diterapkan" | "ditolak") {
    setSaving(true);
    const result = await reviewAssetInspection(reviewId, decision, reviewNotes[reviewId] ?? "");
    setSaving(false);
    if (result.error) return setError(result.error);
    loadBundle();
    onAssetUpdated();
  }

  const formClass = "mt-4 rounded-2xl border border-slate-200 bg-slate-50/70 p-4";
  const inputClass = "min-h-11 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm";
  const buttonClass = "inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-800 hover:bg-emerald-100";

  return (
    <section className="min-w-0 space-y-5 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
      <div className={`rounded-2xl border p-4 ${operationalColors[asset.operationalState]}`}>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex min-w-0 items-start gap-3">
            {asset.operationalState === "aktif" ? <ShieldCheck className="mt-0.5 h-6 w-6 shrink-0" /> : <LockKeyhole className="mt-0.5 h-6 w-6 shrink-0" />}
            <div className="min-w-0">
              <p className="text-xs font-bold uppercase tracking-[0.16em]">Status operasional</p>
              <h2 className="mt-1 text-lg font-bold">{operationalLabels[asset.operationalState]}</h2>
              <p className="mt-1 break-words text-sm opacity-80">
                {asset.isolationReason || (asset.operationalState === "aktif" ? "Aset dapat digunakan sesuai SOP dan kewenangan operator." : "Periksa pembatasan sebelum aset digunakan.")}
              </p>
            </div>
          </div>
          {canManage && (
            <button type="button" onClick={() => openForm("profile")} className={buttonClass}>
              {activeForm === "profile" ? <X className="h-4 w-4" /> : <Pencil className="h-4 w-4" />}
              {activeForm === "profile" ? "Tutup" : "Kelola Profil K3"}
            </button>
          )}
        </div>
        <div className="mt-4 grid gap-2 text-sm sm:grid-cols-2">
          <p className={`rounded-xl bg-white/70 px-3 py-2 ${inspectionState.overdue ? "font-semibold text-red-700" : ""}`}>
            <CalendarClock className="mr-2 inline h-4 w-4" /> {inspectionState.label}
          </p>
          <p className="rounded-xl bg-white/70 px-3 py-2">
            <ClipboardCheck className="mr-2 inline h-4 w-4" /> Interval {asset.inspectionIntervalDays} hari
          </p>
        </div>
      </div>

      {activeForm === "profile" && canManage && (
        <form onSubmit={handleProfileSubmit} className={formClass}>
          <h3 className="font-bold text-slate-900">Identitas teknis dan kendali operasional</h3>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <label><span className="mb-1 block text-xs font-semibold">Produsen</span><input value={manufacturer} onChange={(event) => setManufacturer(event.target.value)} className={inputClass} /></label>
            <label><span className="mb-1 block text-xs font-semibold">Model</span><input value={model} onChange={(event) => setModel(event.target.value)} className={inputClass} /></label>
            <label><span className="mb-1 block text-xs font-semibold">Nomor seri</span><input value={serialNumber} onChange={(event) => setSerialNumber(event.target.value)} className={inputClass} /></label>
            <label><span className="mb-1 block text-xs font-semibold">Tahun pembuatan</span><input type="number" min="1900" max={new Date().getFullYear() + 1} value={manufactureYear} onChange={(event) => setManufactureYear(event.target.value)} className={inputClass} /></label>
            <label><span className="mb-1 block text-xs font-semibold">Tanggal perolehan</span><input type="date" value={acquiredAt} onChange={(event) => setAcquiredAt(event.target.value)} className={inputClass} /></label>
            <label><span className="mb-1 block text-xs font-semibold">Interval inspeksi (hari)</span><input type="number" min="1" max="3650" value={inspectionIntervalDays} onChange={(event) => setInspectionIntervalDays(event.target.value)} className={inputClass} required /></label>
            <label><span className="mb-1 block text-xs font-semibold">Sumber energi</span><input value={energySources} onChange={(event) => setEnergySources(event.target.value)} placeholder="Listrik, pneumatik, hidrolik" className={inputClass} /></label>
            <label><span className="mb-1 block text-xs font-semibold">Kompetensi operator</span><input value={requiredCompetency} onChange={(event) => setRequiredCompetency(event.target.value)} className={inputClass} /></label>
            <label className="sm:col-span-2"><span className="mb-1 block text-xs font-semibold">Dasar regulasi / standar</span><input value={regulatoryReference} onChange={(event) => setRegulatoryReference(event.target.value)} placeholder="Contoh: Permenaker 38/2016" className={inputClass} /></label>
            <label className="sm:col-span-2"><span className="mb-1 block text-xs font-semibold">Spesifikasi teknis (satu key: value per baris)</span><textarea rows={4} value={technicalSpecs} onChange={(event) => setTechnicalSpecs(event.target.value)} className={inputClass} placeholder="Kapasitas: 2 kW\nTegangan: 220 V" /></label>
            <label><span className="mb-1 block text-xs font-semibold">Status operasional</span><select value={operationalState} onChange={(event) => setOperationalState(event.target.value as AssetOperationalState)} className={inputClass}>{Object.entries(operationalLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
            <label><span className="mb-1 block text-xs font-semibold">Alasan isolasi/pembatasan</span><input value={isolationReason} onChange={(event) => setIsolationReason(event.target.value)} className={inputClass} /></label>
          </div>
          {formError && <p role="alert" className="mt-3 text-sm text-red-700">{formError}</p>}
          <button disabled={saving} className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-xl bg-emerald-700 px-4 py-2 text-sm font-bold text-white disabled:opacity-60">{saving && <Loader2 className="h-4 w-4 animate-spin" />}Simpan Profil K3</button>
        </form>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 p-4">
          <div className="flex items-start justify-between gap-3"><div><h3 className="font-bold text-slate-900">Identitas Teknis</h3><p className="text-xs text-slate-500">Informasi produsen dan spesifikasi penting.</p></div><Gauge className="h-5 w-5 text-emerald-700" /></div>
          <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
            <div><dt className="text-xs text-slate-500">Produsen / model</dt><dd className="break-words font-medium">{[asset.manufacturer, asset.model].filter(Boolean).join(" · ") || "Belum tersedia"}</dd></div>
            <div><dt className="text-xs text-slate-500">Nomor seri</dt><dd className="break-all font-medium">{asset.serialNumber || "Belum tersedia"}</dd></div>
            <div><dt className="text-xs text-slate-500">Tahun / perolehan</dt><dd>{asset.manufactureYear || "-"} · {formatDate(asset.acquiredAt)}</dd></div>
            <div><dt className="text-xs text-slate-500">Sumber energi</dt><dd>{asset.energySources.join(", ") || "Belum tersedia"}</dd></div>
            <div className="sm:col-span-2"><dt className="text-xs text-slate-500">Kompetensi wajib</dt><dd>{asset.requiredCompetency || "Belum ditentukan"}</dd></div>
            <div className="sm:col-span-2"><dt className="text-xs text-slate-500">Regulasi/standar</dt><dd>{asset.regulatoryReference || "Belum ditentukan"}</dd></div>
          </dl>
          {Object.keys(asset.technicalSpecs).length > 0 && <div className="mt-4 grid gap-2 rounded-xl bg-slate-50 p-3 text-sm sm:grid-cols-2">{Object.entries(asset.technicalSpecs).map(([key, value]) => <p key={key}><span className="text-slate-500">{key}:</span> {value}</p>)}</div>}
        </div>

        <div className="rounded-2xl border border-slate-200 p-4">
          <div className="flex items-start justify-between gap-3"><div><h3 className="font-bold text-slate-900">Peninjauan Inspeksi</h3><p className="text-xs text-slate-500">Perubahan status memerlukan persetujuan berwenang.</p></div><ClipboardCheck className="h-5 w-5 text-emerald-700" /></div>
          <div className="mt-4 space-y-3">
            {bundle.inspectionReviews.filter((review) => review.reviewStatus === "menunggu").length === 0 ? <p className="rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800">Tidak ada rekomendasi status yang menunggu peninjauan.</p> : bundle.inspectionReviews.filter((review) => review.reviewStatus === "menunggu").map((review) => <div key={review.id} className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm"><p className="font-semibold">Rekomendasi: {review.recommendedStatus.replaceAll("_", " ")}</p><p className="mt-1 text-xs text-slate-500">Checklist {formatDate(review.createdAt, true)}</p>{canManage && <><input value={reviewNotes[review.id] ?? ""} onChange={(event) => setReviewNotes((current) => ({ ...current, [review.id]: event.target.value }))} placeholder="Catatan keputusan" className={`${inputClass} mt-3`} /><div className="mt-2 flex flex-wrap gap-2"><button type="button" disabled={saving} onClick={() => void handleReview(review.id, "diterapkan")} className="rounded-lg bg-emerald-700 px-3 py-2 text-xs font-bold text-white">Terapkan</button><button type="button" disabled={saving} onClick={() => void handleReview(review.id, "ditolak")} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-bold">Tolak</button></div></>}</div>)}
          </div>
        </div>
      </div>

      {loading ? <div className="flex min-h-28 items-center justify-center text-sm text-slate-500"><Loader2 className="mr-2 h-5 w-5 animate-spin" />Memuat register K3...</div> : error && bundle === EMPTY_BUNDLE ? <p className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p> : (
        <>
          {error && <p className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />{error}<button type="button" onClick={loadBundle} className="ml-auto"><RefreshCw className="h-4 w-4" /></button></p>}

          <div className="rounded-2xl border border-slate-200 p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div><h3 className="flex items-center gap-2 font-bold text-slate-900"><ShieldCheck className="h-5 w-5 text-emerald-700" />Kontrol Keselamatan</h3><p className="mt-1 text-xs text-slate-500">Guard, interlock, emergency stop, grounding, ventilasi, dan isolasi energi.</p></div>{canManage && <button type="button" onClick={() => openForm("control")} className={buttonClass}><Plus className="h-4 w-4" />Tambah Kontrol</button>}</div>
            {activeForm === "control" && canManage && <form onSubmit={handleControlSubmit} className={formClass}><div className="grid gap-3 sm:grid-cols-2"><label><span className="mb-1 block text-xs font-semibold">Jenis</span><select value={controlType} onChange={(event) => setControlType(event.target.value as SafetyControlType)} className={inputClass}>{Object.entries(controlLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><label><span className="mb-1 block text-xs font-semibold">Nama kontrol</span><input value={controlName} onChange={(event) => setControlName(event.target.value)} className={inputClass} required /></label><label><span className="mb-1 block text-xs font-semibold">Status</span><select value={controlStatus} onChange={(event) => setControlStatus(event.target.value as SafetyControlStatus)} className={inputClass}>{Object.entries(controlStatusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><label><span className="mb-1 block text-xs font-semibold">Terakhir diverifikasi</span><input type="datetime-local" value={controlVerifiedAt} onChange={(event) => setControlVerifiedAt(event.target.value)} className={inputClass} /></label><label className="sm:col-span-2"><span className="mb-1 block text-xs font-semibold">Catatan</span><textarea value={controlNote} onChange={(event) => setControlNote(event.target.value)} className={inputClass} /></label></div>{formError && <p className="mt-3 text-sm text-red-700">{formError}</p>}<button disabled={saving} className="mt-3 rounded-xl bg-emerald-700 px-4 py-2 text-sm font-bold text-white">Simpan Kontrol</button></form>}
            <div className="mt-4 grid gap-3 sm:grid-cols-2">{bundle.controls.length === 0 ? <p className="text-sm text-slate-500">Kontrol keselamatan belum didata.</p> : bundle.controls.map((control) => <div key={control.id} className="rounded-xl bg-slate-50 p-3"><div className="flex items-start justify-between gap-2"><p className="font-semibold text-slate-800">{control.name}</p><span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${control.status === "baik" ? "bg-emerald-100 text-emerald-800" : control.status === "tidak_berfungsi" ? "bg-red-100 text-red-800" : "bg-amber-100 text-amber-800"}`}>{controlStatusLabels[control.status]}</span></div><p className="mt-1 text-xs text-slate-500">{controlLabels[control.controlType]} · {formatDate(control.lastVerifiedAt)}</p>{control.note && <p className="mt-2 text-sm text-slate-600">{control.note}</p>}</div>)}</div>
          </div>

          <div className="rounded-2xl border border-slate-200 p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div><h3 className="flex items-center gap-2 font-bold text-slate-900"><FileBadge className="h-5 w-5 text-emerald-700" />Sertifikat & Kalibrasi</h3><p className="mt-1 text-xs text-slate-500">Riksa uji, kalibrasi, izin operasi, dan masa berlaku.</p></div>{canManage && <button type="button" onClick={() => openForm("certificate")} className={buttonClass}><Plus className="h-4 w-4" />Tambah Sertifikat</button>}</div>
            {activeForm === "certificate" && canManage && <form onSubmit={handleCertificateSubmit} className={formClass}><div className="grid gap-3 sm:grid-cols-2"><label><span className="mb-1 block text-xs font-semibold">Jenis</span><select value={certificateType} onChange={(event) => setCertificateType(event.target.value as CertificateType)} className={inputClass}>{Object.entries(certificateLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><label><span className="mb-1 block text-xs font-semibold">Nomor sertifikat</span><input value={certificateNumber} onChange={(event) => setCertificateNumber(event.target.value)} className={inputClass} /></label><label><span className="mb-1 block text-xs font-semibold">Penerbit/pemeriksa</span><input value={certificateIssuer} onChange={(event) => setCertificateIssuer(event.target.value)} className={inputClass} /></label><label><span className="mb-1 block text-xs font-semibold">Dokumen (opsional)</span><input type="file" accept="application/pdf,image/jpeg,image/png,image/webp" onChange={(event) => setCertificateFile(event.target.files?.[0] ?? null)} className={inputClass} /></label><label><span className="mb-1 block text-xs font-semibold">Tanggal terbit</span><input type="date" value={certificateIssuedAt} onChange={(event) => setCertificateIssuedAt(event.target.value)} className={inputClass} /></label><label><span className="mb-1 block text-xs font-semibold">Berlaku sampai</span><input type="date" value={certificateExpiresAt} onChange={(event) => setCertificateExpiresAt(event.target.value)} className={inputClass} /></label><label className="sm:col-span-2"><span className="mb-1 block text-xs font-semibold">Catatan</span><textarea value={certificateNote} onChange={(event) => setCertificateNote(event.target.value)} className={inputClass} /></label></div>{formError && <p className="mt-3 text-sm text-red-700">{formError}</p>}<button disabled={saving} className="mt-3 rounded-xl bg-emerald-700 px-4 py-2 text-sm font-bold text-white">Simpan Sertifikat</button></form>}
            <div className="mt-4 space-y-3">{bundle.certificates.length === 0 ? <p className="text-sm text-slate-500">Sertifikat atau kalibrasi belum tersedia.</p> : bundle.certificates.map((certificate) => { const state = certificateState(certificate, referenceTime); return <div key={certificate.id} className="flex flex-col gap-3 rounded-xl bg-slate-50 p-3 sm:flex-row sm:items-start sm:justify-between"><div><div className="flex flex-wrap items-center gap-2"><p className="font-semibold">{certificateLabels[certificate.certificateType]}</p><span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${state.className}`}>{state.label}</span></div><p className="mt-1 text-sm text-slate-600">{certificate.certificateNumber || "Tanpa nomor"} · {certificate.issuer || "Penerbit belum dicatat"}</p><p className="text-xs text-slate-500">Terbit {formatDate(certificate.issuedAt)} · Berlaku sampai {formatDate(certificate.expiresAt)}</p></div>{certificate.bucket && certificate.path && <button type="button" onClick={() => void openDocument(certificate.bucket!, certificate.path!)} className={buttonClass}><Download className="h-4 w-4" />Buka</button>}</div>; })}</div>
          </div>

          <div className="rounded-2xl border border-slate-200 p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div><h3 className="flex items-center gap-2 font-bold text-slate-900"><Wrench className="h-5 w-5 text-emerald-700" />Perintah Kerja Pemeliharaan</h3><p className="mt-1 text-xs text-slate-500">Pemeliharaan preventif/korektif sampai verifikasi kembali beroperasi.</p></div>{canManage && <button type="button" onClick={() => { setEditingWorkOrder(null); openForm("work-order"); }} className={buttonClass}><Plus className="h-4 w-4" />Buat Perintah Kerja</button>}</div>
            {activeForm === "work-order" && canManage && <form onSubmit={handleWorkOrderSubmit} className={formClass}><p className="font-semibold">{editingWorkOrder ? `Edit ${editingWorkOrder.workOrderNumber}` : "Perintah kerja baru"}</p><div className="mt-3 grid gap-3 sm:grid-cols-2"><label><span className="mb-1 block text-xs font-semibold">Jenis</span><select value={workType} onChange={(event) => setWorkType(event.target.value as WorkOrderType)} className={inputClass}><option value="preventif">Preventif</option><option value="korektif">Korektif</option><option value="inspeksi_khusus">Inspeksi Khusus</option><option value="kalibrasi">Kalibrasi</option></select></label><label><span className="mb-1 block text-xs font-semibold">Status</span><select value={workStatus} onChange={(event) => setWorkStatus(event.target.value as WorkOrderStatus)} className={inputClass}>{Object.entries(workStatusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><label className="sm:col-span-2"><span className="mb-1 block text-xs font-semibold">Judul</span><input value={workTitle} onChange={(event) => setWorkTitle(event.target.value)} className={inputClass} required /></label><label><span className="mb-1 block text-xs font-semibold">Teknisi</span><select value={workAssignedTo} onChange={(event) => setWorkAssignedTo(event.target.value)} className={inputClass}><option value="">Belum ditentukan</option>{technicians.map((technician) => <option key={technician.id} value={technician.id}>{technician.fullName}</option>)}</select></label><label><span className="mb-1 block text-xs font-semibold">Jadwal</span><input type="datetime-local" value={workScheduledAt} onChange={(event) => setWorkScheduledAt(event.target.value)} className={inputClass} /></label><label className="sm:col-span-2"><span className="mb-1 block text-xs font-semibold">Deskripsi pekerjaan</span><textarea value={workDescription} onChange={(event) => setWorkDescription(event.target.value)} className={inputClass} /></label><label><span className="mb-1 block text-xs font-semibold">Temuan</span><textarea value={workFindings} onChange={(event) => setWorkFindings(event.target.value)} className={inputClass} /></label><label><span className="mb-1 block text-xs font-semibold">Komponen diganti</span><textarea value={workParts} onChange={(event) => setWorkParts(event.target.value)} className={inputClass} /></label><label><span className="mb-1 block text-xs font-semibold">Tanggal selesai</span><input type="datetime-local" value={workCompletedAt} onChange={(event) => setWorkCompletedAt(event.target.value)} className={inputClass} /></label><label><span className="mb-1 block text-xs font-semibold">Catatan verifikasi</span><input value={workVerification} onChange={(event) => setWorkVerification(event.target.value)} className={inputClass} /></label><label className="sm:col-span-2 flex items-center gap-2 rounded-xl bg-white p-3 text-sm"><input type="checkbox" checked={workReturnToService} onChange={(event) => setWorkReturnToService(event.target.checked)} />Kembalikan aset ke status operasional setelah verifikasi</label></div>{formError && <p className="mt-3 text-sm text-red-700">{formError}</p>}<button disabled={saving} className="mt-3 rounded-xl bg-emerald-700 px-4 py-2 text-sm font-bold text-white">Simpan Perintah Kerja</button></form>}
            <div className="mt-4 space-y-3">{bundle.workOrders.length === 0 ? <p className="text-sm text-slate-500">Belum ada perintah kerja.</p> : bundle.workOrders.map((workOrder) => <div key={workOrder.id} className="rounded-xl bg-slate-50 p-3"><div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between"><div><p className="font-semibold">{workOrder.title}</p><p className="text-xs text-slate-500">{workOrder.workOrderNumber} · {workStatusLabels[workOrder.status]} · Dibuka {formatDate(workOrder.openedAt)}</p></div>{canManage && workOrder.status !== "selesai" && workOrder.status !== "dibatalkan" && <button type="button" onClick={() => editWorkOrder(workOrder)} className={buttonClass}><Pencil className="h-4 w-4" />Perbarui</button>}</div>{workOrder.description && <p className="mt-2 text-sm text-slate-600">{workOrder.description}</p>}{workOrder.verificationNote && <p className="mt-2 rounded-lg bg-emerald-50 p-2 text-sm text-emerald-800"><CheckCircle2 className="mr-1 inline h-4 w-4" />{workOrder.verificationNote}</p>}</div>)}</div>
          </div>

          <div className="rounded-2xl border border-slate-200 p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div><h3 className="flex items-center gap-2 font-bold text-slate-900"><FileText className="h-5 w-5 text-emerald-700" />Dokumen Aset</h3><p className="mt-1 text-xs text-slate-500">Manual, lembar data, diagram, dan foto untuk pengguna berwenang.</p></div>{canManage && <button type="button" onClick={() => openForm("document")} className={buttonClass}><Plus className="h-4 w-4" />Unggah Dokumen</button>}</div>
            {activeForm === "document" && canManage && <form onSubmit={handleDocumentSubmit} className={formClass}><div className="grid gap-3 sm:grid-cols-2"><label><span className="mb-1 block text-xs font-semibold">Jenis</span><select value={documentType} onChange={(event) => setDocumentType(event.target.value as AssetDocumentType)} className={inputClass}><option value="manual">Panduan</option><option value="datasheet">Lembar data</option><option value="foto">Foto</option><option value="diagram">Diagram</option><option value="dokumen_lainnya">Dokumen Lainnya</option></select></label><label><span className="mb-1 block text-xs font-semibold">Judul</span><input value={documentTitle} onChange={(event) => setDocumentTitle(event.target.value)} className={inputClass} required /></label><label><span className="mb-1 block text-xs font-semibold">File maksimal 10 MB</span><input type="file" accept="application/pdf,image/jpeg,image/png,image/webp" onChange={(event) => setDocumentFile(event.target.files?.[0] ?? null)} className={inputClass} required /></label><label><span className="mb-1 block text-xs font-semibold">Catatan</span><input value={documentNote} onChange={(event) => setDocumentNote(event.target.value)} className={inputClass} /></label></div>{formError && <p className="mt-3 text-sm text-red-700">{formError}</p>}<button disabled={saving} className="mt-3 rounded-xl bg-emerald-700 px-4 py-2 text-sm font-bold text-white">Unggah Dokumen</button></form>}
            <div className="mt-4 grid gap-3 sm:grid-cols-2">{bundle.documents.length === 0 ? <p className="text-sm text-slate-500">Dokumen aset belum tersedia.</p> : bundle.documents.map((document) => <button key={document.id} type="button" onClick={() => void openDocument(document.bucket, document.path)} className="flex min-w-0 items-start gap-3 rounded-xl bg-slate-50 p-3 text-left hover:bg-slate-100"><FileText className="mt-0.5 h-5 w-5 shrink-0 text-emerald-700" /><span className="min-w-0"><span className="block break-words font-semibold">{document.title}</span><span className="block truncate text-xs text-slate-500">{document.fileName}</span></span><Download className="ml-auto h-4 w-4 shrink-0 text-slate-400" /></button>)}</div>
          </div>
        </>
      )}
    </section>
  );
}
