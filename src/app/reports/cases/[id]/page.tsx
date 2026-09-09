"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { AlertCircle, ArrowLeft, CheckCircle2, ChevronRight, Clock3, FolderKanban, Loader2, RotateCcw, ShieldCheck, UserRoundCheck, Users } from "lucide-react";
import AppShell from "@/components/AppShell";
import { getCurrentUserProfile, getRoleLabel } from "@/lib/auth";
import { canConfirmReportCase, canCreateReportCase } from "@/lib/role-access";
import {
  fetchReportCaseEvents,
  fetchReportCases,
  fetchReportContributors,
  fetchReports,
  transitionReportCase,
  type DatabaseReport,
  type ReportCaseEvent,
  type ReportCaseStatus,
  type ReportCaseSummary,
  type ReportContributor,
} from "@/lib/reports";
import type { AppUser, RiskLevel } from "@/types";

const statusLabels: Record<ReportCaseStatus, string> = {
  terverifikasi: "Terverifikasi",
  dalam_penanganan: "Dalam Penanganan",
  menunggu_konfirmasi: "Menunggu Konfirmasi",
  selesai: "Selesai",
  dibuka_kembali: "Dikembalikan",
};

const eventLabels: Record<ReportCaseEvent["eventType"], string> = {
  dibuat: "Kasus dibuat",
  mulai_ditangani: "Penanganan dimulai",
  diajukan_konfirmasi: "Diajukan untuk konfirmasi",
  dikonfirmasi: "Penyelesaian dikonfirmasi",
  dikembalikan: "Dikembalikan untuk penanganan",
};

const riskColors: Record<RiskLevel, string> = {
  rendah: "bg-green-100 text-green-800",
  sedang: "bg-yellow-100 text-yellow-800",
  tinggi: "bg-orange-100 text-orange-800",
  kritis: "bg-red-100 text-red-800",
};

async function getCasePageData(id: string) {
  const [caseResult, reportResult, eventResult, profileResult] = await Promise.all([
    fetchReportCases(),
    fetchReports(),
    fetchReportCaseEvents(id),
    getCurrentUserProfile(),
  ]);
  const selectedCase = caseResult.cases.find((item) => item.id === id) ?? null;
  const memberIds = selectedCase?.memberReportIds ?? [];
  const visibleReports = reportResult.reports.filter((report) => memberIds.includes(report.id));
  const contributorResult = await fetchReportContributors(visibleReports.map((report) => report.id));
  return {
    selectedCase,
    visibleReports,
    contributors: contributorResult.contributors,
    events: eventResult.events,
    currentUser: profileResult.user,
    error: caseResult.error || reportResult.error || eventResult.error || contributorResult.error || "",
  };
}

export default function ReportCaseDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [reportCase, setReportCase] = useState<ReportCaseSummary | null>(null);
  const [reports, setReports] = useState<DatabaseReport[]>([]);
  const [contributors, setContributors] = useState<ReportContributor[]>([]);
  const [events, setEvents] = useState<ReportCaseEvent[]>([]);
  const [currentUser, setCurrentUser] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [transitionNote, setTransitionNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [feedbackKind, setFeedbackKind] = useState<"success" | "error">("success");

  useEffect(() => {
    let active = true;
    void getCasePageData(id).then((result) => {
      if (!active) return;
      setReportCase(result.selectedCase);
      setReports(result.visibleReports);
      setContributors(result.contributors);
      setEvents(result.events);
      setCurrentUser(result.currentUser);
      setError(result.error);
      setLoading(false);
    });
    return () => { active = false; };
  }, [id]);

  const contributorByReportId = useMemo(
    () => new Map(contributors.map((contributor) => [contributor.reportId, contributor])),
    [contributors],
  );
  const canOperate = Boolean(currentUser && canCreateReportCase(currentUser.role));
  const canConfirm = Boolean(currentUser && canConfirmReportCase(currentUser.role));

  async function changeStatus(status: ReportCaseStatus) {
    if (!reportCase) return;
    setFeedback("");
    setSaving(true);
    const result = await transitionReportCase({ caseId: reportCase.id, status, note: transitionNote });
    if (result.error) {
      setFeedbackKind("error");
      setFeedback(result.error);
    } else {
      setTransitionNote("");
      setFeedbackKind("success");
      setFeedback("Status Kasus Induk dan seluruh laporan terkait berhasil diperbarui.");
      const refreshed = await getCasePageData(id);
      setReportCase(refreshed.selectedCase);
      setReports(refreshed.visibleReports);
      setContributors(refreshed.contributors);
      setEvents(refreshed.events);
      setError(refreshed.error);
    }
    setSaving(false);
  }

  if (loading) return <AppShell><div className="flex min-h-64 items-center justify-center text-sm text-slate-500"><Loader2 className="mr-2 h-5 w-5 animate-spin text-emerald-600" />Memuat Kasus Induk...</div></AppShell>;

  if (!reportCase) return <AppShell><div className="mx-auto max-w-3xl rounded-2xl border border-slate-200 bg-white p-8 text-center"><FolderKanban className="mx-auto h-10 w-10 text-slate-300" /><p className="mt-3 text-slate-600">Kasus tidak ditemukan atau tidak dapat diakses.</p>{error && <p className="mt-2 text-sm text-red-600">{error}</p>}<Link href="/reports" className="mt-4 inline-flex text-sm font-semibold text-emerald-700">Kembali ke laporan</Link></div></AppShell>;

  return (
    <AppShell>
      <div className="mx-auto max-w-5xl space-y-6">
        <Link href="/reports" className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-emerald-700"><ArrowLeft className="h-4 w-4" /> Kembali ke laporan</Link>

        <section className="overflow-hidden rounded-[28px] bg-emerald-950 text-white shadow-xl">
          <div className="p-5 sm:p-7">
            <div className="flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
              <div className="min-w-0"><p className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.15em] text-emerald-300"><FolderKanban className="h-4 w-4" /> Kasus Induk terverifikasi</p><h1 className="mt-3 break-words text-2xl font-black tracking-[-0.03em] sm:text-3xl">{reportCase.title}</h1><p className="mt-2 text-sm text-emerald-100">{reportCase.caseNumber} · {reportCase.assetName} ({reportCase.assetCode})</p></div>
              <div className="flex flex-wrap gap-2 text-xs font-bold"><span className="rounded-full bg-white/10 px-3 py-1.5">{statusLabels[reportCase.status]}</span><span className={`rounded-full px-3 py-1.5 ${riskColors[reportCase.highestRiskCategory]}`}>Risiko tertinggi {reportCase.highestRiskScore}</span></div>
            </div>
            <div className="mt-6 grid gap-3 sm:grid-cols-3"><div className="rounded-2xl bg-white/10 p-4"><p className="text-xs text-emerald-200">Laporan terkait</p><p className="mt-1 text-2xl font-black">{reportCase.memberCount}</p></div><div className="rounded-2xl bg-white/10 p-4"><p className="text-xs text-emerald-200">Pelapor</p><p className="mt-1 text-2xl font-black">{reportCase.reporterCount}</p></div><div className="rounded-2xl bg-white/10 p-4"><p className="text-xs text-emerald-200">Laboratorium</p><p className="mt-1 text-sm font-bold">{reportCase.laboratoryName}</p></div></div>
          </div>
          <div className="border-t border-white/10 bg-white/5 px-5 py-4 text-sm leading-6 text-emerald-50 sm:px-7"><span className="font-bold">Alasan pengelompokan:</span> {reportCase.groupingReason}</div>
        </section>

        {error && <p role="alert" className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />{error}</p>}

        <section className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-xs font-bold uppercase tracking-[0.14em] text-emerald-700">Bukti asli tetap terpisah</p><h2 className="mt-1 text-xl font-bold text-slate-950">Laporan dalam kasus</h2></div><p className="text-xs text-slate-500">Terlihat {reports.length} dari {reportCase.memberCount} sesuai hak akses</p></div>
          <div className="mt-5 space-y-3">{reports.map((report) => { const contributor = contributorByReportId.get(report.id); return <Link key={report.id} href={`/reports/${report.id}`} className="flex min-w-0 items-start gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 transition hover:border-emerald-300 hover:bg-emerald-50"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-white text-emerald-700 shadow-sm"><Users className="h-4 w-4" /></span><span className="min-w-0 flex-1"><span className="block break-words font-bold text-slate-900">{report.title}</span><span className="mt-1 block text-xs text-slate-500">{contributor?.fullName ?? "Pelapor"}{contributor?.role ? ` · ${getRoleLabel(contributor.role)}` : ""} · {new Date(report.reportedAt).toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" })}</span><span className="mt-2 block text-xs text-slate-600">{report.reportNumber} · Risiko {report.riskScore} ({report.riskCategory}) · {report.status.replaceAll("_", " ")}</span></span><ChevronRight className="mt-1 h-4 w-4 shrink-0 text-slate-400" /></Link>; })}</div>
        </section>

        <section className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <div className="flex items-center gap-2"><Clock3 className="h-5 w-5 text-emerald-700" /><h2 className="text-xl font-bold text-slate-950">Timeline Kasus</h2></div>
          <ol className="mt-5 space-y-4">{events.map((event) => <li key={event.id} className="relative border-l-2 border-emerald-200 pb-1 pl-5"><span className="absolute -left-[6px] top-1 h-2.5 w-2.5 rounded-full bg-emerald-600" /><div className="flex flex-wrap items-center gap-2"><p className="font-bold text-slate-900">{eventLabels[event.eventType]}</p><time className="text-xs text-slate-400">{new Date(event.createdAt).toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" })}</time></div><p className="mt-1 text-xs font-semibold text-emerald-700">{event.actorName}{event.actorRole ? ` · ${getRoleLabel(event.actorRole)}` : ""}</p><p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-600">{event.note}</p></li>)}</ol>
        </section>

        {reportCase.status !== "selesai" && ((canOperate && reportCase.status !== "menunggu_konfirmasi") || (canConfirm && reportCase.status === "menunggu_konfirmasi")) && (
          <section className="rounded-[24px] border border-emerald-200 bg-emerald-50 p-5 shadow-sm sm:p-6">
            <div className="flex items-start gap-3"><ShieldCheck className="mt-0.5 h-6 w-6 shrink-0 text-emerald-700" /><div><h2 className="text-lg font-bold text-emerald-950">Keputusan Kasus Induk</h2><p className="mt-1 text-sm leading-6 text-emerald-800">Penyelesaian kasus akan memperbarui seluruh laporan terkait, tanpa mengubah isi asli laporan.</p></div></div>
            <textarea value={transitionNote} onChange={(event) => setTransitionNote(event.target.value)} rows={4} maxLength={1000} placeholder="Catatan tindakan, bukti pemeriksaan, atau alasan pengembalian..." className="mt-4 w-full resize-y rounded-xl border border-emerald-200 bg-white p-3 text-sm outline-none focus:border-emerald-500" />
            {feedback && <p role={feedbackKind === "error" ? "alert" : "status"} className={`mt-3 rounded-xl bg-white p-3 text-sm ${feedbackKind === "error" ? "text-red-700" : "text-emerald-800"}`}>{feedback}</p>}
            <div className="mt-4 flex flex-col gap-2 sm:flex-row">
              {canOperate && ["terverifikasi", "dibuka_kembali"].includes(reportCase.status) && <button type="button" disabled={saving || transitionNote.trim().length < 5} onClick={() => void changeStatus("dalam_penanganan")} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-emerald-700 px-4 text-sm font-bold text-white disabled:bg-emerald-300"><UserRoundCheck className="h-4 w-4" /> Mulai Penanganan</button>}
              {canOperate && reportCase.status === "dalam_penanganan" && <button type="button" disabled={saving || transitionNote.trim().length < 5} onClick={() => void changeStatus("menunggu_konfirmasi")} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-emerald-700 px-4 text-sm font-bold text-white disabled:bg-emerald-300"><CheckCircle2 className="h-4 w-4" /> Ajukan Konfirmasi</button>}
              {canConfirm && reportCase.status === "menunggu_konfirmasi" && <><button type="button" disabled={saving || transitionNote.trim().length < 5} onClick={() => void changeStatus("selesai")} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-emerald-700 px-4 text-sm font-bold text-white disabled:bg-emerald-300"><CheckCircle2 className="h-4 w-4" /> Konfirmasi Selesai</button><button type="button" disabled={saving || transitionNote.trim().length < 5} onClick={() => void changeStatus("dibuka_kembali")} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-amber-300 bg-white px-4 text-sm font-bold text-amber-800 disabled:text-slate-400"><RotateCcw className="h-4 w-4" /> Kembalikan</button></>}
            </div>
          </section>
        )}
      </div>
    </AppShell>
  );
}
