"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  AlertCircle,
  ArrowLeft,
  CalendarClock,
  CheckCircle2,
  Clock,
  EyeOff,
  ExternalLink,
  ImageIcon,
  Loader2,
  Save,
  ShieldCheck,
  Siren,
  UserCheck,
  Users,
} from "lucide-react";
import AppShell from "@/components/AppShell";
import { getCurrentUserProfile } from "@/lib/auth";
import { canEditReportStatus } from "@/lib/role-access";
import {
  fetchReportById,
  fetchReportFollowUps,
  fetchReportResponseAssignees,
  HAZARD_CATEGORY_LABELS,
  planReportResponse,
  REPORT_TYPE_LABELS,
  saveReportFollowUp,
  type DatabaseReport,
  type ReportFollowUp,
  type ReportResponseAssignee,
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

function toLocalDateTimeInput(value: string | null): string {
  const date = value ? new Date(value) : new Date(Date.now() + 24 * 60 * 60 * 1000);
  if (Number.isNaN(date.getTime())) return "";
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

function formatOperationalDate(value: string | null): string {
  if (!value) return "Belum ditetapkan";
  return new Date(value).toLocaleString("id-ID", {
    dateStyle: "long",
    timeStyle: "short",
  });
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
  const [assignees, setAssignees] = useState<ReportResponseAssignee[]>([]);
  const [responseUnavailable, setResponseUnavailable] = useState(false);
  const [responseError, setResponseError] = useState("");
  const [responseAssigneeId, setResponseAssigneeId] = useState("");
  const [responseDueAt, setResponseDueAt] = useState("");
  const [responseNote, setResponseNote] = useState("");
  const [responseSaving, setResponseSaving] = useState(false);
  const [responseFeedback, setResponseFeedback] = useState("");
  const [responseFeedbackKind, setResponseFeedbackKind] = useState<"success" | "error">(
    "success",
  );
  const [currentTimestamp, setCurrentTimestamp] = useState(0);

  useEffect(() => {
    let active = true;

    void Promise.all([
      fetchReportById(id),
      fetchReportFollowUps(id),
      getCurrentUserProfile(),
    ]).then(([result, followUpResult, profileResult]) => {
      if (!active) return;
      setReport(result.report);
      if (result.report) {
        setSelectedStatus(result.report.status);
        setResponseAssigneeId(result.report.assignedTo ?? "");
        setResponseDueAt(toLocalDateTimeInput(result.report.responseDueAt));
      }
      setNotFound(!result.report && !result.error);
      setError(
        result.error
          ? "Laporan belum dapat dimuat. Silakan coba kembali."
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
      setCurrentTimestamp(Date.now());
      setLoading(false);

      if (
        result.report &&
        profileResult.user &&
        canEditReportStatus(profileResult.user.role)
      ) {
        void fetchReportResponseAssignees(result.report.id).then((assigneeResult) => {
          if (!active) return;
          setAssignees(assigneeResult.assignees);
          setResponseUnavailable(assigneeResult.unavailable);
          setResponseError(assigneeResult.error ?? "");
        });
      }
    });

    return () => {
      active = false;
    };
  }, [id]);

  useEffect(() => {
    const interval = window.setInterval(() => setCurrentTimestamp(Date.now()), 60_000);
    return () => window.clearInterval(interval);
  }, []);

  const canUpdate = currentUser ? canEditReportStatus(currentUser.role) : false;
  const reportClosed = report?.status === "selesai" || report?.status === "ditolak";
  const responseOverdue = Boolean(
    report?.responseDueAt &&
      !reportClosed &&
      new Date(report.responseDueAt).getTime() < currentTimestamp,
  );

  async function handlePlanResponse(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setResponseFeedback("");

    if (!report || !canUpdate || reportClosed) return;
    if (!responseAssigneeId) {
      setResponseFeedbackKind("error");
      setResponseFeedback("Pilih PIC respons terlebih dahulu.");
      return;
    }
    if (!responseDueAt) {
      setResponseFeedbackKind("error");
      setResponseFeedback("Tentukan tenggat respons terlebih dahulu.");
      return;
    }
    if (responseNote.trim().length < 5) {
      setResponseFeedbackKind("error");
      setResponseFeedback("Catatan acknowledgement minimal 5 karakter.");
      return;
    }

    setResponseSaving(true);
    const saveResult = await planReportResponse({
      reportId: report.id,
      assigneeId: responseAssigneeId,
      dueAt: responseDueAt,
      note: responseNote,
    });

    if (saveResult.error) {
      setResponseFeedbackKind("error");
      setResponseFeedback(saveResult.error);
      setResponseSaving(false);
      return;
    }

    const [reportResult, followUpResult] = await Promise.all([
      fetchReportById(report.id),
      fetchReportFollowUps(report.id),
    ]);
    if (reportResult.report) {
      setReport(reportResult.report);
      setSelectedStatus(reportResult.report.status);
      setResponseAssigneeId(reportResult.report.assignedTo ?? "");
      setResponseDueAt(toLocalDateTimeInput(reportResult.report.responseDueAt));
    }
    setFollowUps(followUpResult.followUps);
    setFollowUpError(
      followUpResult.error
        ? `Riwayat tindak lanjut tidak dapat dimuat: ${followUpResult.error}`
        : "",
    );
    setResponseNote("");
    setResponseFeedbackKind(reportResult.error ? "error" : "success");
    setResponseFeedback(
      reportResult.error
        ? "Rencana tersimpan, tetapi detail laporan belum dapat dimuat ulang."
        : "Laporan sudah diakui, PIC dan tenggat respons berhasil ditetapkan.",
    );
    setResponseSaving(false);
  }

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

        <section className={`rounded-[26px] border p-5 shadow-sm md:hidden ${report.riskCategory === "kritis" || report.hazardActive ? "border-red-200 bg-red-50" : "border-emerald-200 bg-emerald-50"}`}>
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">Status keputusan</p>
          <div className="mt-2 flex flex-wrap gap-2">
            <span className={`rounded-full px-3 py-1 text-xs font-bold ${riskColors[report.riskCategory]}`}>{capitalize(report.riskCategory)} · {report.riskScore}</span>
            <span className={`rounded-full px-3 py-1 text-xs font-bold ${statusColors[report.status]}`}>{statusLabels[report.status]}</span>
            {report.hazardActive && report.status !== "selesai" && <span className="rounded-full bg-red-700 px-3 py-1 text-xs font-bold text-white">Bahaya aktif</span>}
          </div>
          <h1 className="mt-4 break-words text-xl font-bold tracking-[-0.03em] text-slate-950">{report.title}</h1>
          <p className="mt-2 text-sm leading-6 text-slate-700">{report.recommendation}</p>
          {report.hazardActive && report.status !== "selesai" && <p className="mt-4 rounded-2xl bg-white/80 p-3 text-sm font-semibold leading-5 text-red-800">Amankan area dan jangan melanjutkan aktivitas sampai petugas menyatakan kondisi aman.</p>}
        </section>

        <section className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.16em] text-emerald-700">
                Operational Response
              </p>
              <h2 className="mt-1 flex items-center gap-2 text-lg font-bold text-slate-900">
                <UserCheck className="h-5 w-5 text-emerald-600" /> Acknowledgement & PIC
              </h2>
              <p className="mt-1 text-sm leading-6 text-slate-500">
                Pastikan laporan memiliki penanggung jawab dan batas waktu respons yang jelas.
              </p>
            </div>
            {responseOverdue && (
              <span className="inline-flex w-fit items-center gap-1.5 rounded-full bg-red-100 px-3 py-1.5 text-xs font-bold text-red-800">
                <CalendarClock className="h-3.5 w-3.5" /> Tenggat terlewati
              </span>
            )}
          </div>

          <dl className="mt-5 grid gap-3 sm:grid-cols-3">
            <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
              <dt className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Acknowledgement</dt>
              <dd className="mt-2 text-sm font-semibold text-slate-800">
                {report.acknowledgedAt ? "Sudah diakui" : "Belum diakui"}
              </dd>
              <p className="mt-1 text-xs leading-5 text-slate-500">
                {report.acknowledgedAt
                  ? formatOperationalDate(report.acknowledgedAt)
                  : "Menunggu petugas menerima laporan."}
              </p>
            </div>
            <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
              <dt className="text-[10px] font-bold uppercase tracking-wide text-slate-500">PIC respons</dt>
              <dd className="mt-2 break-words text-sm font-semibold text-slate-800">
                {report.assignee?.fullName ?? "Belum ditetapkan"}
              </dd>
              {report.assignee && (
                <p className="mt-1 text-xs capitalize text-slate-500">
                  {report.assignee.role.replace("_", " ")}
                </p>
              )}
            </div>
            <div className={`rounded-2xl border p-4 ${responseOverdue ? "border-red-200 bg-red-50" : "border-slate-100 bg-slate-50"}`}>
              <dt className={`text-[10px] font-bold uppercase tracking-wide ${responseOverdue ? "text-red-700" : "text-slate-500"}`}>Tenggat respons</dt>
              <dd className={`mt-2 text-sm font-semibold ${responseOverdue ? "text-red-900" : "text-slate-800"}`}>
                {formatOperationalDate(report.responseDueAt)}
              </dd>
            </div>
          </dl>

          {canUpdate && !reportClosed && (
            <form onSubmit={handlePlanResponse} className="mt-6 space-y-4 border-t border-slate-200 pt-5">
              <div>
                <h3 className="font-bold text-slate-900">Akui dan rencanakan respons</h3>
                <p className="mt-1 text-sm text-slate-500">
                  Penetapan ini tercatat sebagai tindak lanjut dan memberi notifikasi kepada PIC.
                </p>
              </div>

              {responseUnavailable ? (
                <p className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-800">
                  Operational Response siap digunakan setelah migration 015 diterapkan.
                </p>
              ) : (
                <>
                  {responseError && (
                    <p role="alert" className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                      {responseError}
                    </p>
                  )}
                  <div className="grid gap-4 sm:grid-cols-2">
                    <label className="text-sm font-semibold text-slate-700">
                      PIC respons
                      <select
                        value={responseAssigneeId}
                        onChange={(event) => setResponseAssigneeId(event.target.value)}
                        required
                        disabled={responseSaving || assignees.length === 0}
                        className="mt-2 min-h-12 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 disabled:bg-slate-100"
                      >
                        <option value="">Pilih teknisi atau admin</option>
                        {assignees.map((assignee) => (
                          <option key={assignee.id} value={assignee.id}>
                            {assignee.fullName} - {assignee.role === "teknisi" ? "Teknisi/Laboran" : "Admin"}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="text-sm font-semibold text-slate-700">
                      Tenggat respons
                      <input
                        type="datetime-local"
                        value={responseDueAt}
                        onChange={(event) => setResponseDueAt(event.target.value)}
                        min={toLocalDateTimeInput(new Date(currentTimestamp + 60_000).toISOString())}
                        required
                        disabled={responseSaving}
                        className="mt-2 min-h-12 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 disabled:bg-slate-100"
                      />
                    </label>
                  </div>
                  <label className="block text-sm font-semibold text-slate-700">
                    Catatan acknowledgement
                    <textarea
                      value={responseNote}
                      onChange={(event) => setResponseNote(event.target.value)}
                      minLength={5}
                      maxLength={1000}
                      rows={3}
                      required
                      disabled={responseSaving}
                      placeholder="Contoh: Laporan diterima. PIC akan mengisolasi area dan melakukan pemeriksaan awal."
                      className="mt-2 w-full resize-y rounded-xl border border-slate-300 bg-white px-3 py-3 text-sm outline-none placeholder:text-slate-400 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 disabled:bg-slate-100"
                    />
                  </label>

                  {responseFeedback && (
                    <p
                      role={responseFeedbackKind === "error" ? "alert" : "status"}
                      className={`flex items-start gap-2 rounded-2xl border p-4 text-sm ${responseFeedbackKind === "error" ? "border-red-200 bg-red-50 text-red-700" : "border-emerald-200 bg-emerald-50 text-emerald-700"}`}
                    >
                      {responseFeedbackKind === "error" ? <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /> : <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />}
                      {responseFeedback}
                    </p>
                  )}

                  <button
                    type="submit"
                    disabled={responseSaving || !responseAssigneeId || !responseDueAt || responseNote.trim().length < 5}
                    className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-emerald-700 px-4 py-3 text-sm font-bold text-white transition hover:bg-emerald-800 disabled:cursor-not-allowed disabled:bg-emerald-300 sm:w-auto"
                  >
                    {responseSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserCheck className="h-4 w-4" />}
                    {responseSaving ? "Menyimpan rencana..." : "Akui & Tetapkan Respons"}
                  </button>
                </>
              )}
            </form>
          )}
        </section>

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
              {report.isConfidential && (
                <span className="inline-flex items-center gap-1 rounded-full bg-violet-100 px-2.5 py-0.5 text-xs font-medium text-violet-800"><EyeOff className="h-3 w-3" /> Rahasia</span>
              )}
              {report.hazardActive && report.status !== "selesai" && (
                <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-medium text-red-800"><Siren className="h-3 w-3" /> Bahaya aktif</span>
              )}
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
              <dt className="font-medium text-slate-700">Jenis laporan</dt>
              <dd className="mt-1 text-slate-600">{REPORT_TYPE_LABELS[report.reportType]}</dd>
            </div>
            <div>
              <dt className="font-medium text-slate-700">Kategori bahaya</dt>
              <dd className="mt-1 text-slate-600">{HAZARD_CATEGORY_LABELS[report.hazardCategory]}</dd>
            </div>
            <div>
              <dt className="font-medium text-slate-700">Waktu ditemukan/terjadi</dt>
              <dd className="mt-1 text-slate-600">{new Date(report.occurredAt).toLocaleString("id-ID", { dateStyle: "long", timeStyle: "short" })}</dd>
            </div>
            <div>
              <dt className="font-medium text-slate-700">Laboratorium</dt>
              <dd className="mt-1 text-slate-600">{report.laboratory?.name ?? "Tidak tersedia"}</dd>
            </div>
            <div>
              <dt className="font-medium text-slate-700">Lokasi</dt>
              <dd className="mt-1 text-slate-600">{report.location}</dd>
            </div>
            {report.activityAtTime && (
              <div className="sm:col-span-2">
                <dt className="font-medium text-slate-700">Aktivitas saat kejadian</dt>
                <dd className="mt-1 text-slate-600">{report.activityAtTime}</dd>
              </div>
            )}
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

          {report.hazardActive && report.status !== "selesai" && (
            <div role="alert" className="mt-5 flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
              <Siren className="mt-0.5 h-5 w-5 shrink-0" />
              <div><p className="font-semibold">Laporan menyatakan bahaya masih aktif.</p><p className="mt-1">Pastikan area diamankan dan petugas laboratorium segera melakukan verifikasi.</p></div>
            </div>
          )}

          <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-4">
            <div className="flex items-center gap-2"><ShieldCheck className="h-5 w-5 text-emerald-600" /><h2 className="font-semibold text-slate-800">Pengamanan awal</h2></div>
            <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
              <div><dt className="font-medium text-slate-700">Kondisi saat dilaporkan</dt><dd className="mt-1 text-slate-600">{report.hazardActive ? "Masih berbahaya" : "Sudah berhenti atau diamankan"}</dd></div>
              <div><dt className="font-medium text-slate-700">Laboran/PIC diberi tahu</dt><dd className="mt-1 text-slate-600">{report.picNotified ? "Sudah" : "Belum / tidak dicatat"}</dd></div>
              <div className="sm:col-span-2"><dt className="font-medium text-slate-700">Tindakan sementara</dt><dd className="mt-1 whitespace-pre-wrap text-slate-600">{report.immediateAction || "Belum ada tindakan yang dicatat."}</dd></div>
              <div><dt className="font-medium text-slate-700">Orang terdampak</dt><dd className="mt-1 text-slate-600">{report.peopleAffected ? "Ada" : "Tidak ada"}</dd></div>
              {report.peopleAffected && <div><dt className="font-medium text-slate-700">Kondisi/pertolongan</dt><dd className="mt-1 whitespace-pre-wrap text-slate-600">{report.injuryDetails}</dd></div>}
              {report.witnessDetails && <div className="sm:col-span-2"><dt className="flex items-center gap-1 font-medium text-slate-700"><Users className="h-4 w-4" /> Saksi/pihak yang mengetahui</dt><dd className="mt-1 text-slate-600">{report.witnessDetails}</dd></div>}
            </dl>
          </div>

          <div className="mt-5 rounded-md bg-slate-50 p-4">
            <h2 className="font-semibold text-slate-800">Ringkasan Risiko</h2>
            <div className="mt-2 grid grid-cols-1 gap-2 text-sm text-slate-600 min-[360px]:grid-cols-2 sm:grid-cols-4">
              <p>Dampak: {report.severity}</p>
              <p>Kemungkinan: {report.probability}</p>
              <p>Paparan: {report.exposure}</p>
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
              Hanya teknisi atau admin yang dapat memperbarui status dan
              menambah tindak lanjut.
            </p>
          )}
        </section>
      </div>
    </AppShell>
  );
}
