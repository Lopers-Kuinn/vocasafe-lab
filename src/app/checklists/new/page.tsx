"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  AlertCircle,
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  FileImage,
  Loader2,
  Save,
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

const CHECKLIST_DRAFT_KEY = "vocasafe_checklist_draft_v1";

interface ChecklistDraft {
  templateId: string;
  selectedAssetId: string;
  responses: Record<string, AnswerState>;
  overallNote: string;
  hasRiskFinding: boolean;
  severity: number;
  probability: number;
  exposure: number;
  measurements: Record<string, string>;
  inspectorAttestation: boolean;
  mobilePhase: 1 | 2 | 3;
  mobileItemIndex: number;
}

function readChecklistDraft(): ChecklistDraft | null {
  try {
    const rawDraft = window.localStorage.getItem(CHECKLIST_DRAFT_KEY);
    if (!rawDraft) return null;

    const value = JSON.parse(rawDraft) as Partial<ChecklistDraft>;
    if (!value || typeof value !== "object") return null;

    const scaleValue = (input: unknown) =>
      typeof input === "number" && input >= 0 && input <= 5 ? input : 0;

    return {
      templateId: typeof value.templateId === "string" ? value.templateId : "",
      selectedAssetId:
        typeof value.selectedAssetId === "string" ? value.selectedAssetId : "",
      responses:
        value.responses && typeof value.responses === "object"
          ? value.responses
          : {},
      overallNote:
        typeof value.overallNote === "string" ? value.overallNote : "",
      hasRiskFinding: value.hasRiskFinding === true,
      severity: scaleValue(value.severity),
      probability: scaleValue(value.probability),
      exposure: scaleValue(value.exposure),
      measurements:
        value.measurements && typeof value.measurements === "object"
          ? value.measurements
          : {},
      inspectorAttestation: value.inspectorAttestation === true,
      mobilePhase:
        value.mobilePhase === 2 || value.mobilePhase === 3
          ? value.mobilePhase
          : 1,
      mobileItemIndex:
        typeof value.mobileItemIndex === "number" && value.mobileItemIndex >= 0
          ? Math.floor(value.mobileItemIndex)
          : 0,
    };
  } catch {
    window.localStorage.removeItem(CHECKLIST_DRAFT_KEY);
    return null;
  }
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
  const [mobilePhase, setMobilePhase] = useState<1 | 2 | 3>(1);
  const [mobileItemIndex, setMobileItemIndex] = useState(0);
  const draftReadyRef = useRef(false);

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

        const draft = readChecklistDraft();
        let initialTemplate = templateResult.templates[0] ?? null;
        if (draft?.templateId && !presetTemplateId) {
          initialTemplate =
            templateResult.templates.find(
              (template) => template.id === draft.templateId,
            ) ?? initialTemplate;
        }
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

        if (initialTemplate) {
          setActiveTemplate(initialTemplate);

          if (draft?.templateId === initialTemplate.id) {
            const itemIds = new Set(initialTemplate.items.map((item) => item.id));
            const restoredResponses = Object.fromEntries(
              Object.entries(draft.responses).filter(
                ([itemId, response]) =>
                  itemIds.has(itemId) &&
                  (response.answer === "ya" ||
                    response.answer === "tidak" ||
                    response.answer === "tidak_berlaku") &&
                  typeof response.note === "string",
              ),
            );
            const restoredMeasurements = Object.fromEntries(
              Object.entries(draft.measurements).filter(
                ([itemId, measurement]) =>
                  itemIds.has(itemId) && typeof measurement === "string",
              ),
            );

            setResponses(restoredResponses);
            setMeasurements(restoredMeasurements);
            setOverallNote(draft.overallNote);
            setHasRiskFinding(draft.hasRiskFinding);
            setSeverity(draft.severity);
            setProbability(draft.probability);
            setExposure(draft.exposure);
            setInspectorAttestation(draft.inspectorAttestation);
            setMobilePhase(draft.mobilePhase);
            setMobileItemIndex(
              Math.min(
                draft.mobileItemIndex,
                Math.max(0, initialTemplate.items.length - 1),
              ),
            );
          }
        }

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
        } else if (draft?.selectedAssetId) {
          const draftAsset = assetResult.assets.find(
            (asset) => asset.id === draft.selectedAssetId,
          );
          if (
            draftAsset &&
            (!initialTemplate?.assetKind ||
              initialTemplate.assetKind === draftAsset.kind)
          ) {
            setSelectedAssetId(draftAsset.id);
          }
        }

        draftReadyRef.current = true;
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

  useEffect(() => {
    if (!draftReadyRef.current || loading || createdResultId) return;

    const draft: ChecklistDraft = {
      templateId: activeTemplate?.id ?? "",
      selectedAssetId,
      responses,
      overallNote,
      hasRiskFinding,
      severity,
      probability,
      exposure,
      measurements,
      inspectorAttestation,
      mobilePhase,
      mobileItemIndex,
    };

    window.localStorage.setItem(CHECKLIST_DRAFT_KEY, JSON.stringify(draft));
  }, [
    activeTemplate?.id,
    createdResultId,
    exposure,
    hasRiskFinding,
    inspectorAttestation,
    loading,
    measurements,
    mobileItemIndex,
    mobilePhase,
    overallNote,
    probability,
    responses,
    selectedAssetId,
    severity,
  ]);

  function validateCurrentMobileItem() {
    const item = checklistItems[mobileItemIndex];
    if (!item) return true;
    const response = responses[item.id];
    if (!response) {
      setError(`Jawab item ${mobileItemIndex + 1} sebelum melanjutkan.`);
      return false;
    }
    if (response.answer === "tidak" && !response.note.trim()) {
      setError("Catatan wajib diisi untuk jawaban Tidak.");
      return false;
    }
    if (
      response.answer === "tidak" &&
      (item.isCritical || item.evidenceRequired) &&
      !evidenceFiles[item.id]
    ) {
      setError("Foto bukti wajib untuk temuan kritis ini.");
      return false;
    }
    return true;
  }

  function advanceChecklistMobile() {
    setError("");
    if (mobilePhase === 1) {
      if (!activeTemplate?.id) {
        setError("Template checklist aktif tidak ditemukan.");
        return;
      }
      if (!selectedAssetId || !selectedAsset) {
        setError("Pilih aset terlebih dahulu.");
        return;
      }
      setMobilePhase(2);
      setMobileItemIndex(0);
    } else if (mobilePhase === 2) {
      if (!validateCurrentMobileItem()) return;
      if (mobileItemIndex < checklistItems.length - 1) {
        setMobileItemIndex((current) => current + 1);
      } else {
        setMobilePhase(3);
      }
    }
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

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
      setMobilePhase(1);
      setError("Template checklist aktif tidak ditemukan.");
      return;
    }

    if (checklistItems.length === 0) {
      setMobilePhase(1);
      setError("Item checklist belum tersedia.");
      return;
    }

    if (!selectedAssetId || !selectedAsset) {
      setMobilePhase(1);
      setError("Pilih aset terlebih dahulu.");
      return;
    }

    const unanswered = checklistItems.filter((item) => !responses[item.id]);
    if (unanswered.length > 0) {
      setMobilePhase(2);
      setMobileItemIndex(Math.max(0, checklistItems.findIndex((item) => !responses[item.id])));
      setError(`${unanswered.length} item checklist belum dijawab.`);
      return;
    }

    const negativeWithoutNote = checklistItems.some(
      (item) =>
        responses[item.id]?.answer === "tidak" &&
        !responses[item.id]?.note.trim(),
    );
    if (negativeWithoutNote) {
      setMobilePhase(2);
      setMobileItemIndex(Math.max(0, checklistItems.findIndex((item) => responses[item.id]?.answer === "tidak" && !responses[item.id]?.note.trim())));
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
      setMobilePhase(2);
      setMobileItemIndex(Math.max(0, checklistItems.findIndex((item) => responses[item.id]?.answer === "tidak" && (item.isCritical || item.evidenceRequired) && !evidenceFiles[item.id])));
      setError("Foto bukti wajib untuk setiap temuan kritis.");
      return;
    }

    if (riskFindingActive && !riskFactorsComplete) {
      setMobilePhase(3);
      setError("Pilih severity, probability, dan exposure untuk temuan risiko.");
      return;
    }

    if (!inspectorAttestation) {
      setMobilePhase(3);
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
      window.localStorage.removeItem(CHECKLIST_DRAFT_KEY);
      setSubmitting(false);
      return;
    }

    if (result.error) {
      setError(result.error);
      setSubmitting(false);
      return;
    }

    setCreatedResultId(result.resultId ?? "saved");
    window.localStorage.removeItem(CHECKLIST_DRAFT_KEY);
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
    setMobilePhase(1);
    setMobileItemIndex(0);
    window.localStorage.removeItem(CHECKLIST_DRAFT_KEY);
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
            <section className="rounded-[24px] border border-emerald-100 bg-white/90 p-4 shadow-sm md:hidden" aria-label="Progres checklist">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-emerald-700">Tahap {mobilePhase} dari 3</p>
                  <p className="mt-1 text-sm font-bold text-slate-950">{mobilePhase === 1 ? "Persiapan inspeksi" : mobilePhase === 2 ? `Pemeriksaan ${Math.min(mobileItemIndex + 1, checklistItems.length)} dari ${checklistItems.length}` : "Temuan & konfirmasi"}</p>
                </div>
                <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-800">{mobilePhase === 1 ? "33%" : mobilePhase === 2 ? `${Math.round(((mobileItemIndex + 1) / Math.max(1, checklistItems.length)) * 66)}%` : "100%"}</span>
              </div>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-teal-600 transition-[width] duration-300" style={{ width: mobilePhase === 1 ? "33%" : mobilePhase === 2 ? `${33 + ((mobileItemIndex + 1) / Math.max(1, checklistItems.length)) * 34}%` : "100%" }} /></div>
              <p className="mt-3 flex items-center gap-1.5 text-[10px] font-semibold text-slate-500"><Save className="h-3.5 w-3.5 text-emerald-700" /> Draft tersimpan otomatis di perangkat ini</p>
            </section>

            <section className={`${mobilePhase === 1 ? "block" : "hidden md:block"} space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6`}>
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
              <section className={`${mobilePhase === 2 ? "block" : "hidden md:block"} space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6`}>
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
                      className={`${mobileItemIndex === index ? "block" : "hidden md:block"} rounded-2xl border p-4 ${
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

                      <div className="grid gap-2 min-[380px]:grid-cols-3">
                        {answerOptions.map((option) => (
                          <label
                            key={option.value}
                            className={`flex min-h-12 cursor-pointer items-center justify-center rounded-xl border px-3 py-2 text-xs font-bold transition-colors ${
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

                <div className="rounded-2xl bg-slate-50 p-3 text-xs text-slate-600 md:hidden">
                  {Object.keys(responses).length} dari {checklistItems.length} item telah dijawab. Jawaban dapat ditinjau kembali dengan tombol Kembali.
                </div>
              </section>
            )}

            <section className={`${mobilePhase === 3 ? "block" : "hidden md:block"} space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6`}>
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

            <label className={`${mobilePhase === 3 ? "flex" : "hidden md:flex"} items-start gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-950`}>
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

            <section className={`${mobilePhase === 3 ? "block" : "hidden md:block"} rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6`}>
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
              className="hidden min-h-12 w-full items-center justify-center gap-2 rounded-md bg-emerald-600 px-4 py-3 text-sm font-medium text-white transition-colors hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-emerald-400 md:inline-flex"
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

            <div className="sticky bottom-[calc(6.8rem+env(safe-area-inset-bottom))] z-30 -mx-2 flex gap-2 rounded-[22px] border border-slate-200/80 bg-white/95 p-2 shadow-[0_14px_40px_rgba(15,23,42,0.18)] backdrop-blur-xl md:hidden">
              {(mobilePhase > 1 || mobileItemIndex > 0) && (
                <button type="button" onClick={() => { setError(""); if (mobilePhase === 3) { setMobilePhase(2); setMobileItemIndex(Math.max(0, checklistItems.length - 1)); } else if (mobilePhase === 2 && mobileItemIndex > 0) { setMobileItemIndex((current) => current - 1); } else { setMobilePhase(1); } window.scrollTo({ top: 0, behavior: "smooth" }); }} className="inline-flex min-h-12 flex-1 items-center justify-center gap-1 rounded-2xl border border-slate-200 bg-white px-3 text-sm font-bold text-slate-700">
                  <ChevronLeft className="h-4 w-4" /> Kembali
                </button>
              )}
              {mobilePhase < 3 ? (
                <button type="button" onClick={advanceChecklistMobile} className="inline-flex min-h-12 flex-[1.4] items-center justify-center gap-1 rounded-2xl bg-[#08775a] px-4 text-sm font-bold text-white shadow-lg">
                  {mobilePhase === 2 && mobileItemIndex < checklistItems.length - 1 ? "Item berikutnya" : "Lanjutkan"} <ChevronRight className="h-4 w-4" />
                </button>
              ) : (
                <button type="submit" disabled={submitting} className="inline-flex min-h-12 flex-[1.4] items-center justify-center gap-2 rounded-2xl bg-[#08775a] px-4 text-sm font-bold text-white shadow-lg disabled:opacity-60">
                  {submitting ? <><Loader2 className="h-4 w-4 animate-spin" /> Menyimpan...</> : <><Send className="h-4 w-4" /> Simpan</>}
                </button>
              )}
            </div>
          </form>
        )}
      </div>
    </AppShell>
  );
}
