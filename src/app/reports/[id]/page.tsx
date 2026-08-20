"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  Clock,
  ExternalLink,
  ImageIcon,
  Loader2,
  Save,
} from "lucide-react";
import AppShell from "@/components/AppShell";
import { getCurrentUserProfile } from "@/lib/auth";
import {
  fetchReportById,
  fetchReportFollowUps,
  saveReportFollowUp,
  type DatabaseReport,
  type ReportFollowUp,
} from "@/lib/reports";
import type { AppUser, ReportStatus, RiskLevel } from "@/types";

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

const statusOptions: { value: ReportStatus; label: string }[] = [
  { value: "baru", label: "Baru" },
  { value: "diverifikasi", label: "Diverifikasi" },
  { value: "dalam_penanganan", label: "Dalam Penanganan" },
  { value: "selesai", label: "Selesai" },
  { value: "ditolak", label: "Ditolak" },
];

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function formatFileSize(bytes: number | null): string {
  if (bytes === null) return "Ukuran tidak tersedia";
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

export default function ReportDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const [report, setReport] = useState<DatabaseReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [error, setError] = useState("");
  const [attachmentError, setAttachmentError] = useState("");
  const [followUps, setFollowUps] = useState<ReportFollowUp[]>([]);
  const [followUpError, setFollowUpError] = useState("");
  const [currentUser, setCurrentUser] = useState<AppUser | null>(null);
  const [selectedStatus, setSelectedStatus] = useState<ReportStatus>("baru");
  const [followUpNote, setFollowUpNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [feedbackKind, setFeedbackKind] = useState<"success" | "error">(
    "success",
  );

  useEffect(() => {
    let active = true;

    void Promise.all([
      fetchReportById(id),
      fetchReportFollowUps(id),
      getCurrentUserProfile(),
    ]).then(([result, followUpResult, profileResult]) => {
      if (!active) return;
      setReport(result.report);
      if (result.report) setSelectedStatus(result.report.status);
      setNotFound(!result.report && !result.error);
      setError(
        result.error
          ? `Laporan tidak dapat dimuat dari Supabase: ${result.error}`
          : "",
      );
      setAttachmentError(
        result.attachmentError
          ? `Foto bukti tidak dapat ditampilkan: ${result.attachmentError}`
          : "",
      );
      setFollowUps(followUpResult.followUps);
      setFollowUpError(
        followUpResult.error
          ? `Riwayat tindak lanjut tidak dapat dimuat: ${followUpResult.error}`
          : "",
      );
      setCurrentUser(profileResult.user);
      setLoading(false);
    });

    return () => {
      active = false;
    };
  }, [id]);

  const canUpdate = currentUser
    ? ["teknisi", "kepala_lab", "admin"].includes(currentUser.role)
    : false;

  async function handleSaveFollowUp(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFeedback("");

    if (!report || !canUpdate) return;
    if (!followUpNote.trim()) {
      setFeedbackKind("error");
      setFeedback("Catatan tindak lanjut wajib diisi.");
      return;
    }

    setSaving(true);
    const saveResult = await saveReportFollowUp({
      reportId: report.id,
      status: selectedStatus,
      note: followUpNote,
    });
    let refreshError = "";

    if (saveResult.statusUpdated) {
      const [reportResult, followUpResult] = await Promise.all([
        fetchReportById(report.id),
        fetchReportFollowUps(report.id),
      ]);

      if (reportResult.report) {
        setReport(reportResult.report);
        setSelectedStatus(reportResult.report.status);
      }
      if (reportResult.error) {
        refreshError = `Status tersimpan, tetapi detail gagal dimuat ulang: ${reportResult.error}`;
      }
      setAttachmentError(
        reportResult.attachmentError
          ? `Foto bukti tidak dapat ditampilkan: ${reportResult.attachmentError}`
          : "",
      );
      setFollowUps(followUpResult.followUps);
      setFollowUpError(
        followUpResult.error
          ? `Riwayat tindak lanjut tidak dapat dimuat: ${followUpResult.error}`
          : "",
      );
      if (!refreshError && followUpResult.error) {
        refreshError = `Tindak lanjut tersimpan, tetapi riwayat gagal dimuat ulang: ${followUpResult.error}`;
      }
    }

    if (saveResult.error) {
      setFeedbackKind("error");
      setFeedback(saveResult.error);
    } else if (refreshError) {
      setFollowUpNote("");
      setFeedbackKind("error");
      setFeedback(refreshError);
    } else {
      setFollowUpNote("");
      setFeedbackKind("success");
      setFeedback("Status dan tindak lanjut berhasil disimpan.");
    }

    setSaving(false);
  }

  if (loading) {
    return (
      <AppShell>
        <div className="flex min-h-64 items-center justify-center">
          <Loader2 className="mr-2 h-5 w-5 animate-spin text-emerald-600" />
          <span className="text-sm text-slate-500">Memuat detail laporan...</span>
        </div>
      </AppShell>
    );
  }

  if (error) {
    return (
      <AppShell>
        <div className="mx-auto max-w-3xl space-y-4">
          <div
            role="alert"
            className="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700"
          >
            <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
            <p>{error}</p>
          </div>
          <Link href="/reports" className="text-sm text-emerald-600 hover:underline">
            Kembali ke daftar laporan
          </Link>
        </div>
      </AppShell>
    );
  }

  if (notFound || !report) {
    return (
      <AppShell>
        <div className="py-12 text-center">
          <p className="text-slate-500">Laporan tidak ditemukan.</p>
          <Link
            href="/reports"
            className="mt-2 inline-block text-emerald-600 hover:underline"
          >
            Kembali ke daftar laporan
          </Link>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="mx-auto max-w-3xl space-y-6">
        <Link
          href="/reports"
          className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-emerald-600"
        >
          <ArrowLeft className="h-4 w-4" /> Kembali
        </Link>

        <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <h1 className="text-2xl font-bold text-slate-900">{report.title}</h1>
              <p className="mt-1 break-all text-sm text-slate-500">
                {report.reportNumber} &middot;{" "}
                {new Date(report.reportedAt).toLocaleDateString("id-ID", {
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </p>
            </div>
            <div className="flex flex-wrap gap-2 sm:justify-end">
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

          <dl className="mt-5 grid gap-4 text-sm sm:grid-cols-2">
            <div>
              <dt className="font-medium text-slate-700">Lokasi</dt>
              <dd className="mt-1 text-slate-600">{report.location}</dd>
            </div>
            <div>
              <dt className="font-medium text-slate-700">Aset terkait</dt>
              <dd className="mt-1 text-slate-600">
                {report.asset ? (
                  <Link
                    href={`/assets/${encodeURIComponent(report.asset.code)}`}
                    className="text-emerald-600 hover:underline"
                  >
                    {report.asset.name} ({report.asset.code})
                  </Link>
                ) : (
                  "Tidak tersedia"
                )}
              </dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="font-medium text-slate-700">Deskripsi</dt>
              <dd className="mt-1 whitespace-pre-wrap text-slate-600">
                {report.description}
              </dd>
            </div>
          </dl>

          <div className="mt-5 rounded-md bg-slate-50 p-4">
            <h2 className="font-semibold text-slate-800">Ringkasan Risiko</h2>
            <div className="mt-2 grid grid-cols-1 gap-2 text-sm text-slate-600 min-[360px]:grid-cols-2 sm:grid-cols-4">
              <p>Severity: {report.severity}</p>
              <p>Probability: {report.probability}</p>
              <p>Exposure: {report.exposure}</p>
              <p>Skor: {report.riskScore}</p>
            </div>
            <p className="mt-3 text-sm text-slate-600">{report.recommendation}</p>
          </div>
        </section>

        <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <div className="mb-4 flex items-center gap-2">
            <ImageIcon className="h-5 w-5 text-slate-600" />
            <h2 className="text-lg font-semibold text-slate-900">Foto Bukti</h2>
          </div>

          {attachmentError && (
            <p
              role="alert"
              className="mb-4 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800"
            >
              {attachmentError}
            </p>
          )}

          {report.attachments.length === 0 ? (
            <p className="text-sm text-slate-500">Tidak ada foto bukti.</p>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              {report.attachments.map((attachment) => (
                <article
                  key={attachment.id}
                  className="overflow-hidden rounded-lg border border-slate-200"
                >
                  {attachment.signedUrl ? (
                    <a
                      href={attachment.signedUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="block bg-slate-100"
                    >
                      {/* Signed URLs are dynamic and cannot use a fixed Next Image host config. */}
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={attachment.signedUrl}
                        alt={`Foto bukti ${attachment.fileName}`}
                        className="h-52 w-full object-cover"
                      />
                    </a>
                  ) : (
                    <div className="flex h-32 items-center justify-center bg-slate-100 text-sm text-slate-500">
                      Preview tidak tersedia
                    </div>
                  )}
                  <div className="p-3">
                    <p className="break-all text-sm font-medium text-slate-800">
                      {attachment.fileName}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      {formatFileSize(attachment.sizeBytes)}
                    </p>
                    {attachment.signedUrl && (
                      <a
                        href={attachment.signedUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-emerald-600 hover:underline"
                      >
                        Buka foto <ExternalLink className="h-3 w-3" />
                      </a>
                    )}
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>

        <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <div className="mb-4 flex items-center gap-2">
            <Clock className="h-5 w-5 text-slate-600" />
            <h2 className="text-lg font-semibold text-slate-900">Tindak Lanjut</h2>
          </div>

          {followUpError && (
            <p
              role="alert"
              className="mb-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700"
            >
              {followUpError}
            </p>
          )}

          {followUps.length === 0 ? (
            <div className="rounded-md border border-dashed border-slate-300 bg-slate-50 p-4 text-center">
              <p className="text-sm text-slate-500">Belum ada tindak lanjut.</p>
            </div>
          ) : (
            <ol className="space-y-3">
              {followUps.map((followUp) => (
                <li
                  key={followUp.id}
                  className="border-l-2 border-emerald-200 py-1 pl-4"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${statusColors[followUp.status]}`}
                    >
                      {statusLabels[followUp.status]}
                    </span>
                    <time className="text-xs text-slate-400">
                      {new Date(followUp.createdAt).toLocaleDateString("id-ID", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </time>
                  </div>
                  <p className="mt-2 whitespace-pre-wrap text-sm text-slate-600">
                    {followUp.note}
                  </p>
                </li>
              ))}
            </ol>
          )}

          {canUpdate ? (
            <form
              onSubmit={handleSaveFollowUp}
              className="mt-6 space-y-4 border-t border-slate-200 pt-5"
            >
              <h3 className="font-semibold text-slate-800">
                Tambah Tindak Lanjut
              </h3>

              <div>
                <label
                  htmlFor="report-status"
                  className="mb-1 block text-sm font-medium text-slate-700"
                >
                  Status Laporan
                </label>
                <select
                  id="report-status"
                  value={selectedStatus}
                  onChange={(event) =>
                    setSelectedStatus(event.target.value as ReportStatus)
                  }
                  disabled={saving}
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 disabled:bg-slate-100"
                >
                  {statusOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label
                  htmlFor="follow-up-note"
                  className="mb-1 block text-sm font-medium text-slate-700"
                >
                  Catatan Tindak Lanjut
                </label>
                <textarea
                  id="follow-up-note"
                  value={followUpNote}
                  onChange={(event) => setFollowUpNote(event.target.value)}
                  rows={4}
                  required
                  disabled={saving}
                  placeholder="Tuliskan tindakan yang sudah atau akan dilakukan..."
                  className="w-full resize-none rounded-md border border-slate-300 px-3 py-2 text-sm outline-none placeholder:text-slate-400 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 disabled:bg-slate-100"
                />
              </div>

              {feedback && (
                <p
                  role={feedbackKind === "error" ? "alert" : "status"}
                  className={`flex items-start gap-2 rounded-md border p-3 text-sm ${
                    feedbackKind === "error"
                      ? "border-red-200 bg-red-50 text-red-700"
                      : "border-emerald-200 bg-emerald-50 text-emerald-700"
                  }`}
                >
                  {feedbackKind === "success" ? (
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
                  ) : (
                    <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                  )}
                  {feedback}
                </p>
              )}

              <button
                type="submit"
                disabled={saving || !followUpNote.trim()}
                className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-emerald-400 sm:w-auto"
              >
                {saving ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" /> Menyimpan...
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4" /> Simpan Tindak Lanjut
                  </>
                )}
              </button>
            </form>
          ) : (
            <p className="mt-5 border-t border-slate-200 pt-4 text-sm text-slate-500">
              Hanya teknisi, kepala laboratorium, atau admin yang dapat
              memperbarui status dan menambah tindak lanjut.
            </p>
          )}
        </section>
      </div>
    </AppShell>
  );
}
