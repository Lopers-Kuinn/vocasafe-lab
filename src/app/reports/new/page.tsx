"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  AlertCircle,
  Ambulance,
  ArrowLeft,
  CheckCircle2,
  Clock3,
  EyeOff,
  FileImage,
  Loader2,
  Send,
  Siren,
  Users,
  X,
} from "lucide-react";
import AppShell from "@/components/AppShell";
import {
  fetchAssets,
  fetchLaboratories,
  type DatabaseAsset,
  type LaboratorySummary,
} from "@/lib/assets";
import {
  createReport,
  uploadReportEvidence,
  validateEvidenceFile,
} from "@/lib/reports";
import { calculateRiskScore } from "@/lib/risk-scoring";
import { getReportEvidenceBucket } from "@/lib/storage";
import type { HazardCategory, ReportType } from "@/types";

type AIRecommendationProvider =
  | "fallback"
  | "openai"
  | "gemini"
  | "deepseek"
  | "openrouter";

interface AIRiskSuggestionResponse {
  provider: AIRecommendationProvider;
  hazardCategory: HazardCategory;
  suggestedSeverity: number;
  suggestedProbability: number;
  suggestedExposure: number;
  suggestedRiskScore: number;
  suggestedRiskCategory: "rendah" | "sedang" | "tinggi" | "kritis";
  recommendation: string;
  shortRationale: string;
}

type AIReviewDecision = "pending" | "applied" | "manual";

const AI_PROVIDERS = new Set<AIRecommendationProvider>([
  "fallback",
  "openai",
  "gemini",
  "deepseek",
  "openrouter",
]);
const HAZARD_CATEGORIES = new Set<HazardCategory>([
  "listrik",
  "mekanik",
  "kebakaran",
  "bahan_kimia",
  "ergonomi",
  "fasilitas_k3",
  "lingkungan",
  "lainnya",
]);
const hazardCategoryLabels: Record<HazardCategory, string> = {
  listrik: "Listrik",
  mekanik: "Mekanik",
  kebakaran: "Kebakaran",
  bahan_kimia: "Bahan Kimia",
  ergonomi: "Ergonomi",
  fasilitas_k3: "Fasilitas K3",
  lingkungan: "Lingkungan",
  lainnya: "Lainnya",
};

const reportTypeOptions: Array<{
  value: ReportType;
  label: string;
  description: string;
}> = [
  {
    value: "kondisi_tidak_aman",
    label: "Kondisi tidak aman",
    description: "Bahaya ditemukan sebelum terjadi insiden.",
  },
  {
    value: "near_miss",
    label: "Nyaris celaka",
    description: "Kejadian hampir menimbulkan cedera atau kerusakan.",
  },
  {
    value: "kecelakaan_cedera",
    label: "Kecelakaan / cedera",
    description: "Kejadian menyebabkan cedera atau gangguan kesehatan.",
  },
  {
    value: "kerusakan_aset",
    label: "Kerusakan alat",
    description: "Alat atau fasilitas rusak dan berpotensi membahayakan.",
  },
  {
    value: "kebakaran_ledakan",
    label: "Kebakaran / ledakan",
    description: "Api, asap, panas berlebih, atau potensi ledakan.",
  },
  {
    value: "tumpahan_bahan",
    label: "Tumpahan bahan",
    description: "Tumpahan bahan kimia, limbah, atau material berbahaya.",
  },
  {
    value: "keluhan_kesehatan",
    label: "Keluhan kesehatan",
    description: "Keluhan yang diduga terkait aktivitas laboratorium.",
  },
];

const reportTypeLabels = Object.fromEntries(
  reportTypeOptions.map((option) => [option.value, option.label]),
) as Record<ReportType, string>;

const severityGuidance = [
  "Tidak menimbulkan cedera atau kerusakan berarti",
  "Cedera ringan atau kerusakan kecil",
  "Memerlukan pertolongan medis atau perbaikan sedang",
  "Cedera berat, rawat inap, atau kerusakan besar",
  "Berpotensi fatal, cacat tetap, atau kerugian sangat besar",
];

const probabilityGuidance = [
  "Sangat jarang dan hampir tidak pernah terjadi",
  "Jarang, tetapi masih mungkin terjadi",
  "Dapat terjadi pada kondisi tertentu",
  "Sering terjadi atau pernah berulang",
  "Hampir pasti terjadi bila kondisi dibiarkan",
];

const exposureGuidance = [
  "Paparan sangat jarang atau satu orang",
  "Paparan sesekali, sekitar bulanan",
  "Paparan berkala, sekitar mingguan",
  "Paparan sering, sekitar harian",
  "Paparan terus-menerus atau melibatkan banyak orang",
];

function localDateTimeValue(date = new Date()): string {
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

function RiskFactorSelector({
  id,
  label,
  value,
  guidance,
  onChange,
}: {
  id: string;
  label: string;
  value: number | null;
  guidance: string[];
  onChange: (value: number) => void;
}) {
  return (
    <fieldset>
      <legend className="text-sm font-semibold text-slate-800">{label} *</legend>
      <div className="mt-2 grid gap-2 sm:grid-cols-5">
        {guidance.map((description, index) => {
          const option = index + 1;
          const selected = value === option;
          return (
            <button
              key={option}
              id={index === 0 ? id : undefined}
              type="button"
              aria-pressed={selected}
              onClick={() => onChange(option)}
              className={`min-h-20 rounded-xl border p-3 text-left transition-colors ${
                selected
                  ? "border-emerald-500 bg-emerald-50 text-emerald-950 ring-2 ring-emerald-100"
                  : "border-slate-200 bg-white text-slate-700 hover:border-emerald-300"
              }`}
            >
              <span className="block text-lg font-bold">{option}</span>
              <span className="mt-1 block text-[11px] leading-4">{description}</span>
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isScaleValue(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isInteger(value) &&
    value >= 1 &&
    value <= 5
  );
}

function isAiSuggestionResponse(value: unknown): value is AIRiskSuggestionResponse {
  if (!isRecord(value)) return false;
  if (
    typeof value.provider !== "string" ||
    !AI_PROVIDERS.has(value.provider as AIRecommendationProvider) ||
    typeof value.hazardCategory !== "string" ||
    !HAZARD_CATEGORIES.has(value.hazardCategory as HazardCategory) ||
    !isScaleValue(value.suggestedSeverity) ||
    !isScaleValue(value.suggestedProbability) ||
    !isScaleValue(value.suggestedExposure) ||
    typeof value.recommendation !== "string" ||
    !value.recommendation.trim() ||
    typeof value.shortRationale !== "string" ||
    !value.shortRationale.trim()
  ) {
    return false;
  }

  const risk = calculateRiskScore({
    severity: value.suggestedSeverity,
    probability: value.suggestedProbability,
    exposure: value.suggestedExposure,
  });

  return (
    value.suggestedRiskScore === risk.score &&
    value.suggestedRiskCategory === risk.category
  );
}

function NewReportFallback() {
  return (
    <AppShell>
      <div className="flex min-h-64 items-center justify-center">
        <Loader2 className="mr-2 h-5 w-5 animate-spin text-emerald-600" />
        <span className="text-sm text-slate-500">Memuat form laporan...</span>
      </div>
    </AppShell>
  );
}

export default function NewReportPageWrapper() {
  return (
    <Suspense fallback={<NewReportFallback />}>
      <NewReportPage />
    </Suspense>
  );
}

function NewReportPage() {
  const searchParams = useSearchParams();
  const presetAsset = searchParams.get("assetId")?.trim() ?? "";
  const [assets, setAssets] = useState<DatabaseAsset[]>([]);
  const [laboratories, setLaboratories] = useState<LaboratorySummary[]>([]);
  const [assetsLoading, setAssetsLoading] = useState(true);
  const [assetError, setAssetError] = useState("");
  const [selectedAssetId, setSelectedAssetId] = useState("");
  const [selectedLaboratoryId, setSelectedLaboratoryId] = useState("");
  const [reportType, setReportType] = useState<ReportType>("kondisi_tidak_aman");
  const [hazardCategory, setHazardCategory] = useState<HazardCategory | "">("");
  const [occurredAt, setOccurredAt] = useState(localDateTimeValue);
  const [activityAtTime, setActivityAtTime] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [location, setLocation] = useState("");
  const [hazardActive, setHazardActive] = useState<boolean | null>(null);
  const [immediateAction, setImmediateAction] = useState("");
  const [picNotified, setPicNotified] = useState(false);
  const [peopleAffected, setPeopleAffected] = useState(false);
  const [injuryDetails, setInjuryDetails] = useState("");
  const [witnessDetails, setWitnessDetails] = useState("");
  const [isConfidential, setIsConfidential] = useState(false);
  const [severity, setSeverity] = useState<number | null>(null);
  const [probability, setProbability] = useState<number | null>(null);
  const [exposure, setExposure] = useState<number | null>(null);
  const [evidenceFiles, setEvidenceFiles] = useState<File[]>([]);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [createdReportId, setCreatedReportId] = useState("");
  const [attachmentWarning, setAttachmentWarning] = useState("");
  const [aiSuggestion, setAiSuggestion] =
    useState<AIRiskSuggestionResponse | null>(null);
  const [aiReviewDecision, setAiReviewDecision] =
    useState<AIReviewDecision | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState("");
  const [aiRetrySeconds, setAiRetrySeconds] = useState(0);
  const aiAbortControllerRef = useRef<AbortController | null>(null);
  const aiRequestSequenceRef = useRef(0);
  const aiContextFingerprintRef = useRef("");
  const aiLoadingRef = useRef(false);

  useEffect(() => {
    let active = true;

    void Promise.all([fetchAssets(), fetchLaboratories()]).then(
      ([result, laboratoryResult]) => {
      if (!active) return;

      setAssets(result.assets);
      setLaboratories(laboratoryResult.laboratories);
      setAssetsLoading(false);

      if (result.error || laboratoryResult.error) {
        setAssetError(
          `Data lokasi tidak dapat dimuat: ${[result.error, laboratoryResult.error]
            .filter(Boolean)
            .join("; ")}`,
        );
        return;
      }

      if (!presetAsset) return;

      const matched = result.assets.find(
        (asset) =>
          asset.id === presetAsset ||
          asset.code.toLowerCase() === presetAsset.toLowerCase(),
      );

      if (!matched) {
        setAssetError(
          `Aset ${presetAsset} tidak ditemukan. Pilih aset lain secara manual.`,
        );
        return;
      }

      setSelectedAssetId(matched.id);
      setSelectedLaboratoryId(matched.laboratoryId ?? "");
      setLocation(matched.location ?? matched.laboratory?.location ?? "");
      },
    );

    return () => {
      active = false;
    };
  }, [presetAsset]);

  useEffect(() => {
    return () => {
      aiRequestSequenceRef.current += 1;
      aiAbortControllerRef.current?.abort();
      aiAbortControllerRef.current = null;
      aiLoadingRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (aiRetrySeconds <= 0) return;

    const timeoutId = window.setTimeout(() => {
      setAiRetrySeconds((current) => Math.max(0, current - 1));
    }, 1000);

    return () => window.clearTimeout(timeoutId);
  }, [aiRetrySeconds]);

  const selectedAsset =
    assets.find((asset) => asset.id === selectedAssetId) ?? null;
  const selectedLaboratory =
    laboratories.find((laboratory) => laboratory.id === selectedLaboratoryId) ??
    selectedAsset?.laboratory ??
    null;
  const hasCompleteRisk =
    severity !== null && probability !== null && exposure !== null;
  const previewRisk = hasCompleteRisk
    ? calculateRiskScore({ severity, probability, exposure })
    : null;
  const aiContextFingerprint = JSON.stringify({
    reportType,
    hazardCategory,
    title: title.trim(),
    description: description.trim(),
    assetId: selectedAsset?.id ?? null,
    assetName: selectedAsset?.name ?? null,
    location: location.trim(),
    severity,
    probability,
    exposure,
  });

  useEffect(() => {
    aiContextFingerprintRef.current = aiContextFingerprint;
  }, [aiContextFingerprint]);

  function clearAiPresentation() {
    setAiSuggestion(null);
    setAiReviewDecision(null);
    setAiError("");
  }

  function invalidateAiState() {
    aiRequestSequenceRef.current += 1;
    aiAbortControllerRef.current?.abort();
    aiAbortControllerRef.current = null;
    aiLoadingRef.current = false;
    setAiLoading(false);
    clearAiPresentation();
  }

  function handleAssetChange(assetId: string) {
    setSelectedAssetId(assetId);
    setError("");
    invalidateAiState();
    const asset = assets.find((item) => item.id === assetId);
    if (asset) {
      setSelectedLaboratoryId(asset.laboratoryId ?? "");
      setLocation(asset.location ?? asset.laboratory?.location ?? "");
    }
  }

  async function handleGenerateAiRecommendation() {
    if (aiLoading) return;
    if (aiLoadingRef.current || aiRetrySeconds > 0) return;

    setError("");
    setAiError("");
    setAiSuggestion(null);
    setAiReviewDecision(null);

    if (
      !selectedLaboratory ||
      title.trim().length < 3 ||
      description.trim().length < 10 ||
      !location.trim() ||
      severity === null ||
      probability === null ||
      exposure === null
    ) {
      setAiError(
        "Lengkapi lokasi, deskripsi, dan penilaian awal risiko sebelum menggunakan AI.",
      );
      return;
    }

    const requestSequence = aiRequestSequenceRef.current + 1;
    aiRequestSequenceRef.current = requestSequence;
    const requestFingerprint = aiContextFingerprint;
    const controller = new AbortController();
    aiAbortControllerRef.current = controller;
    aiLoadingRef.current = true;
    setAiLoading(true);

    try {
      const response = await fetch("/api/ai/risk-recommendation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          source: "report",
          title: title.trim(),
          description: description.trim(),
          assetName: selectedAsset?.name ?? null,
          location: location.trim(),
          currentSeverity: severity,
          currentProbability: probability,
          currentExposure: exposure,
        }),
      });

      const data: unknown = await response.json().catch(() => null);

      if (
        controller.signal.aborted ||
        requestSequence !== aiRequestSequenceRef.current ||
        requestFingerprint !== aiContextFingerprintRef.current
      ) {
        return;
      }

      if (!response.ok) {
        if (response.status === 400) {
          setAiError("Data laporan belum memenuhi syarat untuk dianalisis.");
        } else if (response.status === 401) {
          setAiError("Sesi login berakhir. Silakan masuk kembali.");
        } else if (response.status === 403) {
          setAiError("Akun ini tidak memiliki akses untuk menggunakan analisis AI.");
        } else if (response.status === 429) {
          const bodyRetry =
            isRecord(data) && typeof data.retryAfterSeconds === "number"
              ? data.retryAfterSeconds
              : Number.NaN;
          const headerRetry = Number(response.headers.get("Retry-After"));
          const retrySeconds = Math.min(
            3600,
            Math.max(
              1,
              Math.ceil(
                Number.isFinite(bodyRetry)
                  ? bodyRetry
                  : Number.isFinite(headerRetry)
                    ? headerRetry
                    : 60,
              ),
            ),
          );
          setAiRetrySeconds(retrySeconds);
          setAiError("");
        } else {
          setAiError("Layanan analisis AI sedang tidak tersedia.");
        }
        return;
      }

      if (!isAiSuggestionResponse(data)) {
        setAiError("Layanan analisis AI sedang tidak tersedia.");
        return;
      }

      setAiSuggestion(data);
      setAiReviewDecision("pending");
    } catch (requestError) {
      if (
        controller.signal.aborted ||
        (requestError instanceof DOMException && requestError.name === "AbortError")
      ) {
        return;
      }

      if (requestSequence === aiRequestSequenceRef.current) {
        setAiError("Layanan analisis AI sedang tidak tersedia.");
      }
    } finally {
      if (requestSequence === aiRequestSequenceRef.current) {
        aiAbortControllerRef.current = null;
        aiLoadingRef.current = false;
        setAiLoading(false);
      }
    }
  }

  function handleApplyAiSuggestion() {
    if (!aiSuggestion) return;
    setHazardCategory(aiSuggestion.hazardCategory);
    setSeverity(aiSuggestion.suggestedSeverity);
    setProbability(aiSuggestion.suggestedProbability);
    setExposure(aiSuggestion.suggestedExposure);
    setAiReviewDecision("applied");
    setAiError("");
  }

  function handleManualAiReview() {
    if (!aiSuggestion) return;
    setAiReviewDecision("manual");
    window.requestAnimationFrame(() => {
      const severityInput = document.getElementById("severity");
      severityInput?.scrollIntoView({ behavior: "smooth", block: "center" });
      severityInput?.focus();
    });
  }

  function handleIgnoreAiSuggestion() {
    invalidateAiState();
  }

  function handleEvidenceChange(files: FileList | null, input: HTMLInputElement) {
    setError("");

    if (!files || files.length === 0) {
      setEvidenceFiles([]);
      return;
    }

    const selectedFiles = Array.from(files);
    if (selectedFiles.length > 3) {
      setEvidenceFiles([]);
      setError("Maksimal tiga foto bukti dapat dilampirkan.");
      input.value = "";
      return;
    }

    const invalidFile = selectedFiles.find((file) => validateEvidenceFile(file));
    if (invalidFile) {
      setEvidenceFiles([]);
      setError(`${invalidFile.name}: ${validateEvidenceFile(invalidFile)}`);
      input.value = "";
      return;
    }

    setEvidenceFiles(selectedFiles);
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setAttachmentWarning("");

    if (!selectedLaboratory) {
      setError("Pilih laboratorium tempat temuan terlebih dahulu.");
      return;
    }

    if (!hazardCategory || !title.trim() || !description.trim() || !location.trim()) {
      setError("Kategori bahaya, judul, deskripsi, dan lokasi wajib diisi.");
      return;
    }

    if (!occurredAt || Number.isNaN(new Date(occurredAt).getTime())) {
      setError("Tanggal dan waktu kejadian tidak valid.");
      return;
    }

    if (new Date(occurredAt).getTime() > new Date().getTime() + 5 * 60_000) {
      setError("Tanggal kejadian tidak boleh berada di masa depan.");
      return;
    }

    if (hazardActive === null) {
      setError("Pilih apakah kondisi berbahaya masih berlangsung.");
      return;
    }

    if (hazardActive && !immediateAction.trim()) {
      setError(
        "Jelaskan tindakan sementara atau tulis bahwa belum ada tindakan.",
      );
      return;
    }

    if (peopleAffected && !injuryDetails.trim()) {
      setError("Jelaskan kondisi orang yang terdampak atau cedera yang dialami.");
      return;
    }

    if (!hasCompleteRisk) {
      setError("Pilih nilai dampak, kemungkinan, dan frekuensi paparan.");
      return;
    }

    setSubmitting(true);

    let storageBucket: string | null = null;
    if (evidenceFiles.length > 0) {
      const bucketResult = await getReportEvidenceBucket();
      if (bucketResult.error || !bucketResult.bucket) {
        setError(
          bucketResult.error ??
            "Layanan unggah foto sedang tidak tersedia. Hubungi administrator.",
        );
        setSubmitting(false);
        return;
      }
      storageBucket = bucketResult.bucket;
    }

    const result = await createReport({
      assetId: selectedAsset?.id ?? null,
      laboratoryId: selectedLaboratory.id,
      title,
      description,
      location,
      reportType,
      hazardCategory,
      occurredAt: new Date(occurredAt).toISOString(),
      activityAtTime,
      hazardActive,
      immediateAction,
      picNotified,
      peopleAffected,
      injuryDetails,
      witnessDetails,
      isConfidential,
      riskInput: { severity, probability, exposure },
    });

    if (result.error || !result.report || !result.reporterId) {
      setError(result.error ?? "Laporan gagal disimpan. Silakan coba kembali.");
      setSubmitting(false);
      return;
    }

    if (evidenceFiles.length > 0 && storageBucket) {
      const uploadResults = await Promise.all(
        evidenceFiles.map((file) =>
          uploadReportEvidence({
            reportId: result.report!.id,
            reporterId: result.reporterId!,
            bucket: storageBucket,
            file,
          }),
        ),
      );
      setAttachmentWarning(
        uploadResults
          .map((uploadResult) => uploadResult.error)
          .filter(Boolean)
          .join(" "),
      );
    }

    setCreatedReportId(result.report.id);
    setSubmitting(false);
  }

  function resetForm() {
    setTitle("");
    setDescription("");
    setReportType("kondisi_tidak_aman");
    setHazardCategory("");
    setOccurredAt(localDateTimeValue());
    setActivityAtTime("");
    setHazardActive(null);
    setImmediateAction("");
    setPicNotified(false);
    setPeopleAffected(false);
    setInjuryDetails("");
    setWitnessDetails("");
    setIsConfidential(false);
    setSeverity(null);
    setProbability(null);
    setExposure(null);
    setEvidenceFiles([]);
    setError("");
    setAttachmentWarning("");
    setCreatedReportId("");
    invalidateAiState();
  }

  if (createdReportId) {
    return (
      <AppShell>
        <div className="mx-auto max-w-2xl space-y-6">
          <section className="rounded-lg border border-emerald-200 bg-white p-6 text-center shadow-sm">
            <CheckCircle2 className="mx-auto h-12 w-12 text-emerald-600" />
            <h1 className="mt-4 text-2xl font-bold text-slate-900">
              Laporan Berhasil Disimpan
            </h1>
            <p className="mt-2 text-sm text-slate-500">
              {reportTypeLabels[reportType]} di {selectedAsset?.name ?? selectedLaboratory?.name}
              {previewRisk
                ? ` telah disimpan dengan skor risiko ${previewRisk.score} (${previewRisk.category}).`
                : " telah disimpan."}
            </p>

            {attachmentWarning && (
              <p
                role="alert"
                className="mt-4 rounded-md border border-amber-200 bg-amber-50 p-3 text-left text-sm text-amber-800"
              >
                {attachmentWarning}
              </p>
            )}

            <div className="mt-6 grid gap-3 sm:grid-cols-3">
              <Link
                href={`/reports/${createdReportId}`}
                className="inline-flex min-h-11 items-center justify-center rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700"
              >
                Lihat Detail
              </Link>
              <button
                type="button"
                onClick={resetForm}
                className="inline-flex min-h-11 items-center justify-center rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Buat Laporan Baru
              </button>
              <Link
                href="/reports"
                className="inline-flex min-h-11 items-center justify-center rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Daftar Laporan
              </Link>
            </div>
          </section>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="mx-auto max-w-4xl space-y-6">
        <Link
          href="/reports"
          className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-emerald-600"
        >
          <ArrowLeft className="h-4 w-4" /> Kembali
        </Link>

        <div>
          <h1 className="text-2xl font-bold text-slate-900">Laporan Bahaya Baru</h1>
          <p className="mt-1 text-sm text-slate-500">
            Laporkan bahaya, kejadian nyaris celaka, kerusakan, atau insiden K3.
            Laporan ini merupakan pencatatan internal dan bukan pengganti pelaporan
            kecelakaan resmi.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <section className="space-y-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
            <div className="flex items-start gap-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-100 font-bold text-emerald-700">1</span>
              <div>
                <h2 className="text-lg font-semibold text-slate-900">Apa yang ditemukan?</h2>
                <p className="mt-1 text-sm text-slate-500">Pilih jenis kejadian dan berikan konteks yang dapat diverifikasi.</p>
              </div>
            </div>

            <fieldset>
              <legend className="text-sm font-semibold text-slate-800">Jenis laporan *</legend>
              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                {reportTypeOptions.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    aria-pressed={reportType === option.value}
                    onClick={() => {
                      setReportType(option.value);
                      if (option.value === "kecelakaan_cedera") setPeopleAffected(true);
                      invalidateAiState();
                    }}
                    className={`rounded-xl border p-3 text-left transition-colors ${
                      reportType === option.value
                        ? "border-emerald-500 bg-emerald-50 ring-2 ring-emerald-100"
                        : "border-slate-200 hover:border-emerald-300"
                    }`}
                  >
                    <span className="block text-sm font-semibold text-slate-900">{option.label}</span>
                    <span className="mt-1 block text-xs leading-5 text-slate-500">{option.description}</span>
                  </button>
                ))}
              </div>
            </fieldset>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block">
                <span className="mb-1 block text-sm font-medium text-slate-700">Aset terkait</span>
                <select
                  id="report-asset"
                  value={selectedAssetId}
                  onChange={(event) => handleAssetChange(event.target.value)}
                  disabled={assetsLoading}
                  className="min-h-11 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 disabled:bg-slate-100"
                >
                  <option value="">Area umum / tidak terkait aset</option>
                  {assets.map((asset) => (
                    <option key={asset.id} value={asset.id}>
                      {asset.name} ({asset.code})
                    </option>
                  ))}
                </select>
                <span className="mt-1 block text-xs text-slate-500">Opsional untuk temuan area, jalur evakuasi, ventilasi, atau fasilitas umum.</span>
              </label>

              <label className="block">
                <span className="mb-1 block text-sm font-medium text-slate-700">Laboratorium *</span>
                <select
                  value={selectedLaboratoryId}
                  onChange={(event) => {
                    setSelectedLaboratoryId(event.target.value);
                    const laboratory = laboratories.find((item) => item.id === event.target.value);
                    if (!selectedAsset) setLocation(laboratory?.location ?? "");
                    invalidateAiState();
                  }}
                  disabled={assetsLoading || Boolean(selectedAsset)}
                  required
                  className="min-h-11 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 disabled:bg-slate-100"
                >
                  <option value="">Pilih laboratorium...</option>
                  {laboratories.map((laboratory) => (
                    <option key={laboratory.id} value={laboratory.id}>{laboratory.name}</option>
                  ))}
                </select>
              </label>
            </div>

            {assetError && (
              <p className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                {assetError}
              </p>
            )}

            {selectedAsset && (
              <div className="rounded-xl border border-emerald-100 bg-emerald-50 p-4 text-sm">
                <p className="font-semibold text-emerald-900">{selectedAsset.name}</p>
                <p className="mt-1 text-emerald-800">
                  {selectedAsset.code} &middot; {selectedAsset.location ?? "Tanpa lokasi"}
                </p>
                <p className="mt-1 text-xs text-emerald-700">
                  Status: {selectedAsset.status.replaceAll("_", " ")}
                </p>
              </div>
            )}

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block">
                <span className="mb-1 flex items-center gap-1 text-sm font-medium text-slate-700"><Clock3 className="h-4 w-4" /> Waktu ditemukan/terjadi *</span>
                <input
                  type="datetime-local"
                  value={occurredAt}
                  max={localDateTimeValue()}
                  onChange={(event) => setOccurredAt(event.target.value)}
                  required
                  className="min-h-11 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                />
              </label>

              <label className="block">
                <span className="mb-1 block text-sm font-medium text-slate-700">Kategori bahaya *</span>
                <select
                  value={hazardCategory}
                  onChange={(event) => {
                    setHazardCategory(event.target.value as HazardCategory | "");
                    invalidateAiState();
                  }}
                  required
                  className="min-h-11 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                >
                  <option value="">Pilih kategori...</option>
                  {Object.entries(hazardCategoryLabels).map(([value, label]) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
              </label>
            </div>

            <div>
              <label
                htmlFor="report-title"
                className="mb-1 block text-sm font-medium text-slate-700"
              >
                Judul Laporan *
              </label>
              <input
                id="report-title"
                type="text"
                value={title}
                onChange={(event) => {
                  setTitle(event.target.value);
                  invalidateAiState();
                }}
                minLength={3}
                maxLength={160}
                placeholder="Contoh: Kabel mesin bor terkelupas"
                required
                className="min-h-11 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none placeholder:text-slate-400 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
              />
            </div>

            <div>
              <label
                htmlFor="report-description"
                className="mb-1 block text-sm font-medium text-slate-700"
              >
                Deskripsi *
              </label>
              <textarea
                id="report-description"
                value={description}
                onChange={(event) => {
                  setDescription(event.target.value);
                  invalidateAiState();
                }}
                minLength={10}
                maxLength={1200}
                rows={4}
                placeholder="Jelaskan apa yang terlihat, bagaimana kondisi terjadi, dan siapa yang berpotensi terdampak..."
                required
                className="w-full resize-none rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none placeholder:text-slate-400 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
              />
            </div>

            <div>
              <label
                htmlFor="report-location"
                className="mb-1 block text-sm font-medium text-slate-700"
              >
                Lokasi *
              </label>
              <input
                id="report-location"
                type="text"
                value={location}
                onChange={(event) => {
                  setLocation(event.target.value);
                  invalidateAiState();
                }}
                maxLength={160}
                required
                className="min-h-11 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
              />
            </div>

            <label className="block">
              <span className="mb-1 block text-sm font-medium text-slate-700">Aktivitas saat kejadian</span>
              <input
                type="text"
                value={activityAtTime}
                onChange={(event) => setActivityAtTime(event.target.value)}
                maxLength={500}
                placeholder="Contoh: Praktik pengeboran benda kerja"
                className="min-h-11 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
              />
            </label>
          </section>

          <section className="space-y-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
            <div className="flex items-start gap-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-amber-100 font-bold text-amber-700">2</span>
              <div>
                <h2 className="text-lg font-semibold text-slate-900">Apakah kondisi masih berbahaya?</h2>
                <p className="mt-1 text-sm text-slate-500">Utamakan keselamatan dan catat tindakan sementara yang sudah dilakukan.</p>
              </div>
            </div>

            <fieldset>
              <legend className="text-sm font-semibold text-slate-800">Bahaya masih berlangsung? *</legend>
              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                {[
                  { value: true, label: "Ya, masih aktif", description: "Orang masih dapat terpapar bahaya." },
                  { value: false, label: "Tidak / sudah diamankan", description: "Kondisi telah berhenti atau area sudah diisolasi." },
                ].map((option) => (
                  <button
                    key={String(option.value)}
                    type="button"
                    aria-pressed={hazardActive === option.value}
                    onClick={() => setHazardActive(option.value)}
                    className={`rounded-xl border p-3 text-left ${hazardActive === option.value ? "border-amber-500 bg-amber-50 ring-2 ring-amber-100" : "border-slate-200 hover:border-amber-300"}`}
                  >
                    <span className="block text-sm font-semibold text-slate-900">{option.label}</span>
                    <span className="mt-1 block text-xs text-slate-500">{option.description}</span>
                  </button>
                ))}
              </div>
            </fieldset>

            {hazardActive && (
              <div role="alert" className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
                <Siren className="mt-0.5 h-5 w-5 shrink-0" />
                <div><p className="font-semibold">Jangan menunggu laporan diproses.</p><p className="mt-1">Hentikan penggunaan alat bila aman dilakukan, jauhi area berbahaya, pasang pembatas, dan hubungi laboran/PIC.</p></div>
              </div>
            )}

            <label className="block">
              <span className="mb-1 block text-sm font-medium text-slate-700">Tindakan sementara yang sudah dilakukan {hazardActive ? "*" : ""}</span>
              <textarea
                value={immediateAction}
                onChange={(event) => setImmediateAction(event.target.value)}
                maxLength={1200}
                rows={3}
                placeholder="Contoh: Mesin dimatikan, sumber listrik dicabut, dan area diberi pembatas. Jika belum ada tindakan, tuliskan alasannya."
                className="w-full resize-none rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
              />
            </label>

            <div className="grid gap-3 sm:grid-cols-2">
              <label className="flex min-h-14 items-start gap-3 rounded-xl border border-slate-200 p-3">
                <input type="checkbox" checked={picNotified} onChange={(event) => setPicNotified(event.target.checked)} className="mt-1 h-4 w-4 accent-emerald-600" />
                <span><span className="block text-sm font-medium text-slate-800">Laboran/PIC sudah diberi tahu</span><span className="mt-1 block text-xs text-slate-500">Pilih jika pemberitahuan langsung sudah dilakukan.</span></span>
              </label>
              <label className="flex min-h-14 items-start gap-3 rounded-xl border border-slate-200 p-3">
                <input type="checkbox" checked={peopleAffected} onChange={(event) => { setPeopleAffected(event.target.checked); if (!event.target.checked) setInjuryDetails(""); }} className="mt-1 h-4 w-4 accent-emerald-600" />
                <span><span className="block text-sm font-medium text-slate-800">Ada orang terdampak atau cedera</span><span className="mt-1 block text-xs text-slate-500">Aktifkan untuk mencatat kondisi dan pertolongan.</span></span>
              </label>
            </div>

            {peopleAffected && (
              <label className="block">
                <span className="mb-1 flex items-center gap-1 text-sm font-medium text-slate-700"><Ambulance className="h-4 w-4" /> Kondisi orang terdampak *</span>
                <textarea value={injuryDetails} onChange={(event) => setInjuryDetails(event.target.value)} maxLength={1200} rows={3} placeholder="Jelaskan jumlah orang, jenis cedera/keluhan, dan pertolongan pertama yang diberikan." className="w-full resize-none rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100" />
              </label>
            )}

            <label className="block">
              <span className="mb-1 flex items-center gap-1 text-sm font-medium text-slate-700"><Users className="h-4 w-4" /> Saksi atau pihak yang mengetahui</span>
              <input type="text" value={witnessDetails} onChange={(event) => setWitnessDetails(event.target.value)} maxLength={500} placeholder="Nama atau keterangan saksi, jika ada" className="min-h-11 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100" />
            </label>

            <label className="flex items-start gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
              <input type="checkbox" checked={isConfidential} onChange={(event) => setIsConfidential(event.target.checked)} className="mt-1 h-4 w-4 accent-emerald-600" />
              <EyeOff className="mt-0.5 h-4 w-4 shrink-0 text-slate-500" />
              <span><span className="block text-sm font-medium text-slate-800">Tandai sebagai laporan rahasia</span><span className="mt-1 block text-xs text-slate-500">Identitas tetap tercatat untuk verifikasi dan hanya dapat dilihat oleh pengguna berwenang.</span></span>
            </label>
          </section>

          <section className="space-y-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
            <div className="flex items-start gap-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-blue-100 font-bold text-blue-700">3</span>
              <div>
                <h2 className="text-lg font-semibold text-slate-900">Penilaian risiko</h2>
                <p className="mt-1 text-sm text-slate-500">Tidak ada nilai default. Pilih berdasarkan kondisi yang benar-benar ditemukan.</p>
              </div>
            </div>

            <RiskFactorSelector id="severity" label="Dampak / keparahan" value={severity} guidance={severityGuidance} onChange={(value) => { setSeverity(value); invalidateAiState(); }} />
            <RiskFactorSelector id="probability" label="Kemungkinan terjadi" value={probability} guidance={probabilityGuidance} onChange={(value) => { setProbability(value); invalidateAiState(); }} />
            <RiskFactorSelector id="exposure" label="Frekuensi paparan" value={exposure} guidance={exposureGuidance} onChange={(value) => { setExposure(value); invalidateAiState(); }} />

            {previewRisk ? (
              <div className={`rounded-xl border p-4 ${previewRisk.category === "kritis" ? "border-red-200 bg-red-50" : "border-slate-200 bg-slate-50"}`}>
                <p className="text-sm text-slate-700">
                  Skor risiko: <strong>{previewRisk.score}</strong>{" "}
                  <span
                    className={`ml-1 inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                      previewRisk.category === "rendah"
                        ? "bg-green-100 text-green-800"
                        : previewRisk.category === "sedang"
                          ? "bg-yellow-100 text-yellow-800"
                          : previewRisk.category === "tinggi"
                            ? "bg-orange-100 text-orange-800"
                            : "bg-red-100 text-red-800"
                    }`}
                  >
                    {previewRisk.category.charAt(0).toUpperCase() + previewRisk.category.slice(1)}
                  </span>
                </p>
                <p className="mt-2 text-xs leading-5 text-slate-600">{previewRisk.recommendation}</p>
                {previewRisk.category === "kritis" && (
                  <p className="mt-3 flex items-start gap-2 text-sm font-medium text-red-800"><Siren className="mt-0.5 h-4 w-4 shrink-0" /> Prioritaskan pengamanan area dan hubungi laboran/PIC sebelum kegiatan dilanjutkan.</p>
                )}
              </div>
            ) : (
              <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-500">Skor akan tampil setelah ketiga faktor dipilih.</div>
            )}

            <div className="rounded-md border border-emerald-100 bg-emerald-50 p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-emerald-950">
                    Analisis Risiko dengan AI
                  </h3>
                  <p className="mt-1 text-xs text-emerald-800">
                    AI hanya memberi saran. Nilai akhir tetap dipilih dan ditinjau
                    pengguna.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleGenerateAiRecommendation}
                  disabled={aiLoading || aiRetrySeconds > 0 || submitting}
                  className="inline-flex min-h-10 items-center justify-center gap-2 rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-emerald-400"
                >
                  {aiLoading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" /> Menganalisis...
                    </>
                  ) : aiRetrySeconds > 0 ? (
                    `Coba lagi dalam ${aiRetrySeconds} detik`
                  ) : (
                    "Analisis Risiko dengan AI"
                  )}
                </button>
              </div>

              {aiError && (
                <p role="alert" className="mt-3 text-sm text-red-700">
                  {aiError}
                </p>
              )}

              {aiRetrySeconds > 0 && (
                <p role="alert" className="mt-3 text-sm text-amber-800">
                  Batas penggunaan AI tercapai. Coba kembali dalam {aiRetrySeconds} detik.
                </p>
              )}

              {aiSuggestion && (
                <div className="mt-4 space-y-4 rounded-md border border-emerald-200 bg-white p-4">
                  <div>
                    <h4 className="text-sm font-semibold text-slate-900">
                      Saran AI - perlu ditinjau pengguna
                    </h4>
                    <div className="mt-2 flex flex-wrap gap-2 text-xs">
                      <span className="rounded-full bg-emerald-100 px-2.5 py-1 font-medium text-emerald-800">
                        Saran kategori bahaya: {hazardCategoryLabels[aiSuggestion.hazardCategory]}
                      </span>
                    </div>
                    <p className="mt-2 text-xs text-slate-500">
                      Kategori bahaya ini hanya saran dan tidak disimpan ke laporan.
                    </p>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-4">
                    <div className="rounded-md bg-slate-50 p-3">
                      <p className="text-xs text-slate-500">Severity</p>
                      <p className="text-lg font-semibold text-slate-900">
                        {aiSuggestion.suggestedSeverity}
                      </p>
                    </div>
                    <div className="rounded-md bg-slate-50 p-3">
                      <p className="text-xs text-slate-500">Probability</p>
                      <p className="text-lg font-semibold text-slate-900">
                        {aiSuggestion.suggestedProbability}
                      </p>
                    </div>
                    <div className="rounded-md bg-slate-50 p-3">
                      <p className="text-xs text-slate-500">Exposure</p>
                      <p className="text-lg font-semibold text-slate-900">
                        {aiSuggestion.suggestedExposure}
                      </p>
                    </div>
                    <div className="rounded-md bg-slate-50 p-3">
                      <p className="text-xs text-slate-500">Skor Saran</p>
                      <p className="text-lg font-semibold text-slate-900">
                        {aiSuggestion.suggestedRiskScore}
                      </p>
                      <p className="text-xs capitalize text-slate-500">
                        {aiSuggestion.suggestedRiskCategory}
                      </p>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div>
                      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                        Rekomendasi tindakan awal
                      </p>
                      <p className="mt-1 text-sm text-slate-700">
                        {aiSuggestion.recommendation}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                        Alasan singkat
                      </p>
                      <p className="mt-1 text-sm text-slate-700">
                        {aiSuggestion.shortRationale}
                      </p>
                    </div>
                  </div>

                  {aiReviewDecision === "applied" && (
                    <p role="status" className="rounded-md bg-emerald-50 p-2 text-xs text-emerald-800">
                      Saran telah dimasukkan ke field risiko. Anda tetap dapat mengubah nilainya.
                    </p>
                  )}
                  {aiReviewDecision === "manual" && (
                    <p role="status" className="rounded-md bg-blue-50 p-2 text-xs text-blue-800">
                      Anda memilih review manual. Nilai form saat ini tetap dipertahankan.
                    </p>
                  )}

                  <div className="grid gap-2 sm:grid-cols-3">
                    <button
                      type="button"
                      onClick={handleApplyAiSuggestion}
                      className="inline-flex min-h-10 items-center justify-center rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700"
                    >
                      Gunakan Saran AI
                    </button>
                    <button
                      type="button"
                      onClick={handleManualAiReview}
                      className="inline-flex min-h-10 items-center justify-center rounded-md border border-blue-300 bg-white px-4 py-2 text-sm font-medium text-blue-700 hover:bg-blue-50"
                    >
                      Ubah Nilai
                    </button>
                    <button
                      type="button"
                      onClick={handleIgnoreAiSuggestion}
                      className="inline-flex min-h-10 items-center justify-center rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                    >
                      Abaikan Saran
                    </button>
                  </div>
                </div>
              )}
            </div>
          </section>

          <section className="space-y-3 rounded-lg border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
            <div className="flex items-center gap-2">
              <FileImage className="h-5 w-5 text-slate-600" />
              <h2 className="text-lg font-semibold text-slate-900">Foto Bukti</h2>
            </div>
            <p className="text-xs text-slate-500">
              Opsional. Maksimal tiga file JPG, PNG, atau WebP; masing-masing maksimal 5 MB.
            </p>
            <input
              id="report-evidence"
              type="file"
              multiple
              accept="image/jpeg,image/png,image/webp"
              onChange={(event) =>
                handleEvidenceChange(event.target.files, event.currentTarget)
              }
              className="block w-full text-sm text-slate-600 file:mr-3 file:rounded-md file:border-0 file:bg-emerald-50 file:px-3 file:py-2 file:text-sm file:font-medium file:text-emerald-700 hover:file:bg-emerald-100"
            />
            {evidenceFiles.length > 0 && (
              <div className="space-y-2">
                {evidenceFiles.map((file) => (
                  <div key={`${file.name}-${file.lastModified}`} className="flex min-w-0 items-center justify-between gap-3 rounded-xl bg-slate-50 p-3 text-sm text-slate-600">
                    <span className="min-w-0 break-all">{file.name} ({(file.size / 1024 / 1024).toFixed(2)} MB)</span>
                    <button type="button" aria-label={`Hapus ${file.name}`} onClick={() => setEvidenceFiles((current) => current.filter((item) => item !== file))} className="shrink-0 rounded-full p-1 text-slate-400 hover:bg-slate-200 hover:text-slate-700"><X className="h-4 w-4" /></button>
                  </div>
                ))}
              </div>
            )}
          </section>

          {error && (
            <p
              role="alert"
              className="flex items-start gap-2 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700"
            >
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /> {error}
            </p>
          )}

          <button
            type="submit"
            disabled={submitting || assetsLoading}
            className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-md bg-emerald-600 px-4 py-3 text-sm font-medium text-white transition-colors hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-emerald-400"
          >
            {submitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" /> Menyimpan...
              </>
            ) : (
              <>
                <Send className="h-4 w-4" /> Kirim Laporan
              </>
            )}
          </button>
        </form>
      </div>
    </AppShell>
  );
}
