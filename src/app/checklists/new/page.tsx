"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  FileImage,
  Loader2,
  Send,
} from "lucide-react";
import AppShell from "@/components/AppShell";
import { fetchAssets, type DatabaseAsset } from "@/lib/assets";
import {
  createChecklistResult,
  fetchActiveChecklistTemplates,
  type DatabaseChecklistTemplate,
} from "@/lib/checklists";
import { uploadChecklistEvidence } from "@/lib/checklist-v2";
import { calculateRiskScore } from "@/lib/risk-scoring";
import type { ChecklistAnswer } from "@/types";

interface AnswerState {
  answer: ChecklistAnswer;
  note: string;
}

const answerOptions: { value: ChecklistAnswer; label: string }[] = [
  { value: "ya", label: "Ya" },
  { value: "tidak", label: "Tidak" },
  { value: "tidak_berlaku", label: "Tidak Berlaku" },
];

function ChecklistFormFallback() {
  return (
    <AppShell>
      <div className="flex min-h-64 items-center justify-center">
        <Loader2 className="mr-2 h-5 w-5 animate-spin text-emerald-600" />
        <span className="text-sm text-slate-500">Memuat checklist...</span>
      </div>
    </AppShell>
  );
}

export default function ChecklistFormPage() {
  return (
    <Suspense fallback={<ChecklistFormFallback />}>
      <ChecklistForm />
    </Suspense>
  );
}

function ChecklistForm() {
  const searchParams = useSearchParams();
  const presetTemplateId = searchParams.get("checklistId")?.trim() ?? "";
  const presetAssetId = searchParams.get("assetId")?.trim() ?? "";
  const [templates, setTemplates] = useState<DatabaseChecklistTemplate[]>([]);
  const [assets, setAssets] = useState<DatabaseAsset[]>([]);
  const [loading, setLoading] = useState(true);
  const [setupError, setSetupError] = useState("");
  const [setupWarning, setSetupWarning] = useState("");
  const [activeTemplate, setActiveTemplate] =
    useState<DatabaseChecklistTemplate | null>(null);
  const [selectedAssetId, setSelectedAssetId] = useState("");
  const [responses, setResponses] = useState<Record<string, AnswerState>>({});
  const [overallNote, setOverallNote] = useState("");
  const [hasRiskFinding, setHasRiskFinding] = useState(false);
  const [severity, setSeverity] = useState(0);
  const [probability, setProbability] = useState(0);
  const [exposure, setExposure] = useState(0);
  const [evidenceFiles, setEvidenceFiles] = useState<Record<string, File | null>>({});
  const [measurements, setMeasurements] = useState<Record<string, string>>({});
  const [inspectorAttestation, setInspectorAttestation] = useState(false);
  const startedAtRef = useRef(new Date().toISOString());
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [createdResultId, setCreatedResultId] = useState("");
  const [submissionWarning, setSubmissionWarning] = useState("");

  useEffect(() => {
    let active = true;

    void Promise.all([fetchActiveChecklistTemplates(), fetchAssets()]).then(
      ([templateResult, assetResult]) => {
        if (!active) return;

        setTemplates(templateResult.templates);
        setAssets(assetResult.assets);
        setLoading(false);

        const errors = [templateResult.error, assetResult.error].filter(Boolean);
        if (errors.length > 0) {
          setSetupError(`Data form tidak dapat dimuat: ${errors.join("; ")}`);
          return;
        }

        let initialTemplate = templateResult.templates[0] ?? null;
        if (presetTemplateId) {
          const matchedTemplate = templateResult.templates.find(
            (template) => template.id === presetTemplateId,
          );
          if (matchedTemplate) {
            initialTemplate = matchedTemplate;
          } else {
            setSetupWarning(
              "Template dari URL tidak ditemukan. Template aktif pertama digunakan.",
            );
          }
        }

        if (initialTemplate) setActiveTemplate(initialTemplate);

        if (presetAssetId) {
          const matchedAsset = assetResult.assets.find(
            (asset) =>
              asset.id === presetAssetId ||
              asset.code.toLowerCase() === presetAssetId.toLowerCase(),
          );
          if (matchedAsset) {
            setSelectedAssetId(matchedAsset.id);
          } else {
            setSetupWarning((current) =>
              [current, `Aset ${presetAssetId} tidak ditemukan. Pilih aset manual.`]
                .filter(Boolean)
                .join(" "),
            );
          }
        }
      },
    );

    return () => {
      active = false;
    };
  }, [presetAssetId, presetTemplateId]);

  const checklistItems = activeTemplate?.items ?? [];
  const filteredAssets = activeTemplate?.assetKind
    ? assets.filter((asset) => asset.kind === activeTemplate.assetKind)
    : assets;
  const selectedAsset =
    assets.find((asset) => asset.id === selectedAssetId) ?? null;
  const hasNegativeAnswer = Object.values(responses).some(
    (response) => response.answer === "tidak",
  );
  const riskFindingActive = hasRiskFinding || hasNegativeAnswer;
  const riskFactorsComplete = severity > 0 && probability > 0 && exposure > 0;
  const riskPreview = riskFindingActive && riskFactorsComplete
    ? calculateRiskScore({ severity, probability, exposure })
    : null;

  function handleTemplateChange(nextTemplateId: string) {
    const nextTemplate = templates.find(
      (template) => template.id === nextTemplateId,
    ) ?? null;
    setActiveTemplate(nextTemplate);
    setResponses({});
    setEvidenceFiles({});
    setMeasurements({});
    setError("");

    if (
      nextTemplate?.assetKind &&
      selectedAsset &&
      selectedAsset.kind !== nextTemplate.assetKind
    ) {
      setSelectedAssetId("");
    }
  }

  function handleAnswerChange(itemId: string, answer: ChecklistAnswer) {
    setResponses((current) => ({
      ...current,
      [itemId]: {
        answer,
        note: current[itemId]?.note ?? "",
      },
    }));
    setError("");
  }

  function handleNoteChange(itemId: string, note: string) {
    setResponses((current) => ({
      ...current,
      [itemId]: {
        answer: current[itemId].answer,
        note,
      },
    }));
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    if (!activeTemplate?.id) {
      setError("Template checklist aktif tidak ditemukan.");
      return;
    }

    if (checklistItems.length === 0) {
      setError("Item checklist belum tersedia.");
      return;
    }

    if (!selectedAssetId || !selectedAsset) {
      setError("Pilih aset terlebih dahulu.");
      return;
    }

    const unanswered = checklistItems.filter((item) => !responses[item.id]);
    if (unanswered.length > 0) {
      setError(`${unanswered.length} item checklist belum dijawab.`);
      return;
    }

    const negativeWithoutNote = checklistItems.some(
      (item) =>
        responses[item.id]?.answer === "tidak" &&
        !responses[item.id]?.note.trim(),
    );
    if (negativeWithoutNote) {
      setError("Catatan wajib diisi untuk setiap jawaban Tidak.");
      return;
    }

    const criticalWithoutEvidence = checklistItems.some(
      (item) =>
        responses[item.id]?.answer === "tidak" &&
        (item.isCritical || item.evidenceRequired) &&
        !evidenceFiles[item.id],
    );
    if (criticalWithoutEvidence) {
      setError("Foto bukti wajib untuk setiap temuan kritis.");
      return;
    }

    if (riskFindingActive && !riskFactorsComplete) {
      setError("Pilih severity, probability, dan exposure untuk temuan risiko.");
      return;
    }

    if (!inspectorAttestation) {
      setError("Konfirmasi pernyataan pemeriksa sebelum menyimpan checklist.");
      return;
    }

    setSubmitting(true);
    const result = await createChecklistResult({
      templateId: activeTemplate.id,
      assetId: selectedAssetId,
      laboratoryId: selectedAsset.laboratoryId,
      overallNote,
      hasRiskFinding: riskFindingActive,
      riskInput: { severity, probability, exposure },
      answers: checklistItems.map((item) => ({
        itemId: item.id,
        answer: responses[item.id].answer,
        note: responses[item.id].note,
      })),
      startedAt: startedAtRef.current,
      inspectorAttestation,
    });

    if (result.resultSaved && result.resultId) {
      const evidenceErrors = await Promise.all(
        checklistItems
          .filter((item) => evidenceFiles[item.id])
          .map(async (item) => {
            const measurement = Number(measurements[item.id]);
            return uploadChecklistEvidence(
              result.resultId as string,
              item.id,
              evidenceFiles[item.id] as File,
              Number.isFinite(measurement) && measurements[item.id] !== "" ? measurement : null,
            );
          }),
      );
      const failedEvidenceCount = evidenceErrors.filter((upload) => upload.error).length;
      const warnings = [
        result.error,
        failedEvidenceCount > 0
          ? `${failedEvidenceCount} bukti belum berhasil diunggah. Hasil checklist tetap tersimpan.`
          : null,
      ].filter(Boolean);
      setSubmissionWarning(warnings.join(" "));
      setCreatedResultId(result.resultId ?? "saved");
      setSubmitting(false);
      return;
    }

    if (result.error) {
      setError(result.error);
      setSubmitting(false);
      return;
    }

    setCreatedResultId(result.resultId ?? "saved");
    setSubmitting(false);
  }

  function resetForm() {
    setResponses({});
    setOverallNote("");
    setHasRiskFinding(false);
    setSeverity(0);
    setProbability(0);
    setExposure(0);
    setEvidenceFiles({});
    setMeasurements({});
    setInspectorAttestation(false);
    startedAtRef.current = new Date().toISOString();
    setError("");
    setSubmissionWarning("");
    setCreatedResultId("");
  }

  if (createdResultId) {
    return (
      <AppShell>
        <div className="mx-auto max-w-2xl">
          <section className="rounded-lg border border-emerald-200 bg-white p-6 text-center shadow-sm">
            <CheckCircle2 className="mx-auto h-12 w-12 text-emerald-600" />
            <h1 className="mt-4 text-2xl font-bold text-slate-900">
              Checklist Berhasil Disimpan
            </h1>
            <p className="mt-2 text-sm text-slate-500">
              Hasil {activeTemplate?.title} untuk {selectedAsset?.name} telah
              dicatat sebagai hasil inspeksi.
            </p>
            {riskPreview && (
              <p className="mt-2 text-sm font-medium text-slate-700">
                Skor risiko {riskPreview.score} ({riskPreview.category})
              </p>
            )}
            {submissionWarning && (
              <p
                role="alert"
                className="mt-4 rounded-md border border-amber-200 bg-amber-50 p-3 text-left text-sm text-amber-800"
              >
                {submissionWarning}
              </p>
            )}
            <div className="mt-6 grid gap-3 sm:grid-cols-3">
              <button
                type="button"
                onClick={resetForm}
                className="inline-flex min-h-11 items-center justify-center rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Isi Checklist Baru
              </button>
              <Link
                href={`/checklists/${createdResultId}`}
                className="inline-flex min-h-11 items-center justify-center rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
              >
                Lihat Detail Hasil
              </Link>
              <Link
                href="/checklists"
                className="inline-flex min-h-11 items-center justify-center rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700"
              >
                Lihat Daftar Checklist
              </Link>
            </div>
          </section>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="mx-auto max-w-2xl space-y-6">
        <Link
          href="/checklists"
          className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-emerald-600"
        >
          <ArrowLeft className="h-4 w-4" /> Kembali
        </Link>

        <div>
          <h1 className="text-2xl font-bold text-slate-900">Isi Checklist K3</h1>
          <p className="mt-1 text-sm text-slate-500">
            Isi template aktif dan simpan hasil pemeriksaan.
          </p>
        </div>

        {loading ? (
          <div className="flex min-h-48 items-center justify-center rounded-lg border border-slate-200 bg-white">
            <Loader2 className="mr-2 h-5 w-5 animate-spin text-emerald-600" />
            <span className="text-sm text-slate-500">Memuat template dan aset...</span>
          </div>
        ) : setupError ? (
          <div
            role="alert"
            className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700"
          >
            <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" /> {setupError}
          </div>
        ) : templates.length === 0 ? (
          <div className="rounded-lg border border-slate-200 bg-white p-8 text-center text-slate-500">
            Belum ada template checklist aktif yang dapat digunakan.
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-6">
            <section className="space-y-4 rounded-lg border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
              <div>
                <label
                  htmlFor="checklist-template"
                  className="mb-1 block text-sm font-medium text-slate-700"
                >
                  Template Checklist *
                </label>
                <select
                  id="checklist-template"
                  value={activeTemplate?.id ?? ""}
                  onChange={(event) => handleTemplateChange(event.target.value)}
                  required
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                >
                  <option value="">Pilih template...</option>
                  {templates.map((template) => (
                    <option key={template.id} value={template.id}>
                      {template.title}
                    </option>
                  ))}
                </select>
              </div>

              {selectedAsset && (
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <p className="font-semibold text-slate-900">{selectedAsset.name} ({selectedAsset.code})</p>
                      <p className="mt-1 text-xs text-slate-500">{selectedAsset.location ?? "Lokasi belum dicatat"}</p>
                    </div>
                    <span className="self-start rounded-full bg-white px-2.5 py-1 text-xs font-bold text-slate-700">
                      {selectedAsset.operationalState.replaceAll("_", " ")}
                    </span>
                  </div>
                  {selectedAsset.requiredCompetency && (
                    <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
                      Kompetensi pemeriksa yang diperlukan: <strong>{selectedAsset.requiredCompetency}</strong>.
                      Pastikan pemeriksaan teknis dilakukan oleh personel yang kompeten dan berwenang.
                    </p>
                  )}
                </div>
              )}

              <div>
                <label
                  htmlFor="checklist-asset"
                  className="mb-1 block text-sm font-medium text-slate-700"
                >
                  Aset Terkait *
                </label>
                <select
                  id="checklist-asset"
                  value={selectedAssetId}
                  onChange={(event) => setSelectedAssetId(event.target.value)}
                  required
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                >
                  <option value="">Pilih aset...</option>
                  {filteredAssets.map((asset) => (
                    <option key={asset.id} value={asset.id}>
                      {asset.name} ({asset.code})
                    </option>
                  ))}
                </select>
              </div>

              {setupWarning && (
                <p className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                  {setupWarning}
                </p>
              )}

            </section>

            {activeTemplate && (
              <section className="space-y-4 rounded-lg border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
                <div>
                  <h2 className="text-lg font-semibold text-slate-900">
                    {activeTemplate.title}
                  </h2>
                  <p className="mt-1 text-sm text-slate-500">
                    Versi {activeTemplate.version} · {checklistItems.length} item pemeriksaan
                  </p>
                  {activeTemplate.regulatoryReference && (
                    <p className="mt-1 text-xs text-slate-500">
                      Acuan: {activeTemplate.regulatoryReference}
                    </p>
                  )}
                </div>

                {checklistItems.map((item, index) => {
                  const response = responses[item.id];
                  return (
                    <fieldset
                      key={item.id}
                      className={`rounded-md border p-4 ${
                        item.isCritical
                          ? "border-red-200 bg-red-50/40"
                          : "border-slate-200"
                      }`}
                    >
                      <legend className="px-1 text-sm font-semibold text-slate-800">
                        {index + 1}. {item.label}
                      </legend>
                      {item.guidance && (
                        <p className="mb-3 mt-1 text-xs text-slate-500">
                          {item.guidance}
                        </p>
                      )}

                      <div className="grid gap-2 sm:grid-cols-3">
                        {answerOptions.map((option) => (
                          <label
                            key={option.value}
                            className={`flex min-h-10 cursor-pointer items-center justify-center rounded-md border px-3 py-2 text-xs font-medium transition-colors ${
                              response?.answer === option.value
                                ? option.value === "ya"
                                  ? "border-green-600 bg-green-600 text-white"
                                  : option.value === "tidak"
                                    ? "border-red-600 bg-red-600 text-white"
                                    : "border-slate-600 bg-slate-600 text-white"
                                : "border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100"
                            }`}
                          >
                            <input
                              type="radio"
                              name={`answer-${item.id}`}
                              value={option.value}
                              checked={response?.answer === option.value}
                              onChange={() => handleAnswerChange(item.id, option.value)}
                              className="sr-only"
                            />
                            {option.label}
                          </label>
                        ))}
                      </div>

                      <label
                        htmlFor={`note-${item.id}`}
                        className="mt-3 block text-xs font-medium text-slate-600"
                      >
                        Catatan {response?.answer === "tidak" ? "*" : "(opsional)"}
                      </label>
                      <input
                        id={`note-${item.id}`}
                        type="text"
                        value={response?.note ?? ""}
                        onChange={(event) =>
                          handleNoteChange(item.id, event.target.value)
                        }
                        required={response?.answer === "tidak"}
                        disabled={!response}
                        placeholder={
                          response?.answer === "tidak"
                            ? "Jelaskan temuan yang perlu ditindaklanjuti"
                            : "Catatan item"
                        }
                        className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none placeholder:text-slate-400 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                      />

                      {item.measurementType && (
                        <label className="mt-3 block text-xs font-medium text-slate-600">
                          Nilai pengukuran {item.measurementUnit ? `(${item.measurementUnit})` : ""}
                          <input
                            type="number"
                            step="any"
                            value={measurements[item.id] ?? ""}
                            onChange={(event) =>
                              setMeasurements((current) => ({
                                ...current,
                                [item.id]: event.target.value,
                              }))
                            }
                            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                          />
                        </label>
                      )}

                      {(response?.answer === "tidak" || item.evidenceRequired) && (
                        <label className="mt-3 block text-xs font-medium text-slate-600">
                          Foto bukti {(response?.answer === "tidak" && item.isCritical) || item.evidenceRequired ? "*" : "(opsional)"}
                          <span className="mt-1 flex min-h-11 items-center gap-2 rounded-md border border-dashed border-slate-300 bg-white px-3 py-2 text-sm text-slate-600">
                            <FileImage className="h-4 w-4 shrink-0" />
                            <span className="min-w-0 truncate">
                              {evidenceFiles[item.id]?.name ?? "Pilih JPG, PNG, atau WebP (maks. 5 MB)"}
                            </span>
                          </span>
                          <input
                            type="file"
                            accept="image/jpeg,image/png,image/webp"
                            className="sr-only"
                            onChange={(event) =>
                              setEvidenceFiles((current) => ({
                                ...current,
                                [item.id]: event.target.files?.[0] ?? null,
                              }))
                            }
                          />
                        </label>
                      )}

                      {response?.answer === "tidak" && item.failureAction && (
                        <p className="mt-3 rounded-md bg-red-100 p-2 text-xs font-medium text-red-800">
                          Tindakan sementara: {item.failureAction}
                        </p>
                      )}
                    </fieldset>
                  );
                })}
              </section>
            )}

            <section className="space-y-4 rounded-lg border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
              <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
                <input
                  type="checkbox"
                  checked={hasRiskFinding}
                  onChange={(event) => setHasRiskFinding(event.target.checked)}
                  className="h-4 w-4 accent-emerald-600"
                />
                Ada temuan risiko tambahan?
              </label>

              {hasNegativeAnswer && (
                <p className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                  Temuan risiko otomatis aktif karena terdapat jawaban Tidak.
                </p>
              )}

              {riskFindingActive && (
                <div className="space-y-4">
                  <div className="grid gap-4 sm:grid-cols-3">
                    <div>
                      <label htmlFor="severity" className="mb-1 block text-sm font-medium text-slate-700">
                        Severity (1-5)
                      </label>
                      <select
                        id="severity"
                        value={severity}
                        onChange={(event) => setSeverity(Number(event.target.value))}
                        className="min-h-11 w-full rounded-md border border-slate-300 px-3 py-2"
                      >
                        <option value={0}>Pilih...</option>
                        {[1, 2, 3, 4, 5].map((value) => <option key={value} value={value}>{value}</option>)}
                      </select>
                    </div>
                    <div>
                      <label htmlFor="probability" className="mb-1 block text-sm font-medium text-slate-700">
                        Probability (1-5)
                      </label>
                      <select
                        id="probability"
                        value={probability}
                        onChange={(event) => setProbability(Number(event.target.value))}
                        className="min-h-11 w-full rounded-md border border-slate-300 px-3 py-2"
                      >
                        <option value={0}>Pilih...</option>
                        {[1, 2, 3, 4, 5].map((value) => <option key={value} value={value}>{value}</option>)}
                      </select>
                    </div>
                    <div>
                      <label htmlFor="exposure" className="mb-1 block text-sm font-medium text-slate-700">
                        Exposure (1-5)
                      </label>
                      <select
                        id="exposure"
                        value={exposure}
                        onChange={(event) => setExposure(Number(event.target.value))}
                        className="min-h-11 w-full rounded-md border border-slate-300 px-3 py-2"
                      >
                        <option value={0}>Pilih...</option>
                        {[1, 2, 3, 4, 5].map((value) => <option key={value} value={value}>{value}</option>)}
                      </select>
                    </div>
                  </div>

                  {riskPreview && (
                    <div className="rounded-md bg-slate-50 p-4">
                      <p className="text-sm text-slate-600">
                        Skor Risiko: <strong>{riskPreview.score}</strong>{" "}
                        <span
                          className={`ml-1 inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                            riskPreview.category === "rendah"
                              ? "bg-green-100 text-green-800"
                              : riskPreview.category === "sedang"
                                ? "bg-yellow-100 text-yellow-800"
                                : riskPreview.category === "tinggi"
                                  ? "bg-orange-100 text-orange-800"
                                  : "bg-red-100 text-red-800"
                          }`}
                        >
                          {riskPreview.category.charAt(0).toUpperCase() +
                            riskPreview.category.slice(1)}
                        </span>
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        {riskPreview.recommendation}
                      </p>
                    </div>
                  )}
                </div>
              )}
            </section>

            <label className="flex items-start gap-3 rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-950">
              <input
                type="checkbox"
                checked={inspectorAttestation}
                onChange={(event) => setInspectorAttestation(event.target.checked)}
                className="mt-0.5 h-4 w-4 accent-emerald-700"
              />
              <span>
                Saya menyatakan pemeriksaan dilakukan sesuai kondisi aktual, catatan temuan lengkap,
                dan tindakan sementara telah dilakukan bila kondisi tidak aman.
              </span>
            </label>

            <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
              <label
                htmlFor="overall-note"
                className="mb-1 block text-sm font-medium text-slate-700"
              >
                Catatan Keseluruhan
              </label>
              <textarea
                id="overall-note"
                value={overallNote}
                onChange={(event) => setOverallNote(event.target.value)}
                rows={3}
                placeholder="Catatan umum hasil inspeksi..."
                className="w-full resize-none rounded-md border border-slate-300 px-3 py-2 text-sm outline-none placeholder:text-slate-400 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
              />
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
              disabled={submitting}
              className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-md bg-emerald-600 px-4 py-3 text-sm font-medium text-white transition-colors hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-emerald-400"
            >
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> Menyimpan...
                </>
              ) : (
                <>
                  <Send className="h-4 w-4" /> Simpan Hasil Checklist
                </>
              )}
            </button>
          </form>
        )}
      </div>
    </AppShell>
  );
}
