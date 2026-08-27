"use client";

import { getCurrentUserProfile } from "@/lib/auth";
import {
  fetchLaboratories,
  type DatabaseAsset,
  type LaboratorySummary,
} from "@/lib/assets";
import type { DatabaseChecklistResult } from "@/lib/checklists";
import type { DatabaseReport } from "@/lib/reports";
import { calculateRiskScore } from "@/lib/risk-scoring";
import { fetchSupabaseSummary, type SupabaseSummary } from "@/lib/summary";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import type { AppUser, ReportStatus, RiskLevel } from "@/types";

export type AuditPeriodPreset = "30d" | "90d" | "year" | "all" | "custom";
export type AuditRunStatus = "draft" | "reviewed" | "approved";
export type AuditFindingClassification = "observation" | "minor" | "major" | "critical";

export interface AuditFollowUp {
  id: string;
  reportId: string;
  status: ReportStatus;
  note: string;
  createdAt: string;
}

export interface AuditCorrectiveAction {
  id: string;
  resultId: string;
  assetId: string;
  laboratoryId: string;
  description: string;
  controlHierarchy: string;
  assigneeName: string | null;
  dueAt: string;
  status: string;
  completionNote: string;
  completedAt: string | null;
  verifiedAt: string | null;
  createdAt: string;
}

export interface AuditWorkOrder {
  id: string;
  number: string;
  assetId: string;
  laboratoryId: string;
  maintenanceType: string;
  status: string;
  title: string;
  openedAt: string;
  scheduledAt: string | null;
  completedAt: string | null;
  verifiedAt: string | null;
  returnToService: boolean;
}

export interface AuditCertificate {
  id: string;
  assetId: string;
  laboratoryId: string;
  type: string;
  number: string;
  expiresAt: string | null;
}

export interface AuditInspectionReview {
  id: string;
  checklistResultId: string;
  assetId: string;
  laboratoryId: string;
  recommendedStatus: string;
  reviewStatus: string;
  createdAt: string;
  reviewedAt: string | null;
}

export interface AuditResultItem {
  resultId: string;
  answer: string;
  label: string;
  evidencePath: string | null;
}

export interface AuditAttachmentMetadata {
  reportId: string;
  createdAt: string;
}

export interface AuditRunSummary {
  id: string;
  auditNumber: string;
  laboratoryId: string | null;
  laboratoryName: string | null;
  periodStart: string | null;
  periodEnd: string | null;
  scope: string;
  status: AuditRunStatus;
  dataComplete: boolean;
  generatedByName: string | null;
  generatedAt: string;
  reviewedAt: string | null;
  approvedAt: string | null;
  snapshotHash: string;
}

export interface AuditRunDetail extends AuditRunSummary {
  criteria: string[];
  methodology: string;
  snapshot: {
    version?: number;
    generatedAt?: string;
    metrics?: Partial<AuditMetrics>;
    reportRisk?: Partial<Record<RiskLevel, number>>;
    reportStatus?: Partial<Record<ReportStatus, number>>;
    checklistRisk?: Partial<Record<RiskLevel, number>>;
    assetStatus?: Partial<Record<"layak" | "perlu_dicek" | "tidak_layak", number>>;
    trends?: AuditTrendPoint[];
    recommendations?: string[];
    dataQualityIssues?: string[];
  };
  findings: Array<{
    id: string;
    sourceType: string;
    sourceId: string | null;
    classification: AuditFindingClassification;
    title: string;
    description: string;
    recommendation: string;
    sourceStatus: string;
    owner: string;
    dueAt: string | null;
  }>;
  signoffs: Array<{
    id: string;
    type: "review" | "approval";
    signerName: string;
    note: string;
    createdAt: string;
  }>;
  generatedById: string;
  reviewedById: string | null;
}

export interface AuditData {
  summary: SupabaseSummary;
  laboratories: LaboratorySummary[];
  user: AppUser | null;
  followUps: AuditFollowUp[];
  correctiveActions: AuditCorrectiveAction[];
  workOrders: AuditWorkOrder[];
  certificates: AuditCertificate[];
  inspectionReviews: AuditInspectionReview[];
  resultItems: AuditResultItem[];
  attachments: AuditAttachmentMetadata[];
  auditRuns: AuditRunSummary[];
  auditStorageAvailable: boolean;
  errors: string[];
}

export interface AuditFilters {
  laboratoryId: string;
  periodStart: string;
  periodEnd: string;
}

export interface AuditTrendPoint {
  key: string;
  label: string;
  reports: number;
  checklists: number;
  highCritical: number;
}

export interface AuditPriorityFinding {
  id: string;
  sourceType: "report" | "checklist" | "asset" | "certificate" | "corrective_action";
  sourceId: string;
  classification: AuditFindingClassification;
  title: string;
  description: string;
  assetId: string | null;
  assetLabel: string;
  laboratoryId: string | null;
  laboratoryName: string;
  riskScore: number | null;
  riskCategory: RiskLevel | null;
  status: string;
  owner: string;
  dueAt: string | null;
  recommendation: string;
  href: string | null;
}

export interface AuditMetrics {
  totalAssets: number;
  totalReports: number;
  totalChecklists: number;
  highCriticalRisks: number;
  criticalRisks: number;
  openReports: number;
  activeHazards: number;
  restrictedAssets: number;
  overdueInspections: number;
  openActions: number;
  overdueActions: number;
  expiredCertificates: number;
  certificatesDueSoon: number;
  openWorkOrders: number;
  pendingInspectionReviews: number;
  medianResponseHours: number | null;
  medianClosureHours: number | null;
  inspectionScheduleCompliance: number | null;
  correctiveActionOnTimeRate: number | null;
  evidenceCoverage: number | null;
  repeatFindingAssets: number;
}

export interface AuditView {
  assets: DatabaseAsset[];
  reports: DatabaseReport[];
  checklists: DatabaseChecklistResult[];
  followUps: AuditFollowUp[];
  correctiveActions: AuditCorrectiveAction[];
  workOrders: AuditWorkOrder[];
  certificates: AuditCertificate[];
  inspectionReviews: AuditInspectionReview[];
  metrics: AuditMetrics;
  reportRisk: Record<RiskLevel, number>;
  reportStatus: Record<ReportStatus, number>;
  checklistRisk: Record<RiskLevel, number>;
  assetStatus: Record<"layak" | "perlu_dicek" | "tidak_layak", number>;
  trends: AuditTrendPoint[];
  priorityFindings: AuditPriorityFinding[];
  recommendations: string[];
  dataQualityIssues: string[];
}

interface RelationName {
  full_name?: string | null;
  name?: string | null;
}

interface AuditRunRow {
  id: string;
  audit_number: string;
  laboratory_id: string | null;
  period_start: string | null;
  period_end: string | null;
  scope: string;
  status: AuditRunStatus;
  data_complete: boolean;
  generated_at: string;
  reviewed_at: string | null;
  approved_at: string | null;
  snapshot_hash: string;
  laboratory: RelationName | RelationName[] | null;
  generator: RelationName | RelationName[] | null;
}

const CLOSED_ACTION_STATUSES = new Set(["selesai", "dibatalkan"]);

function one<T>(value: T | T[] | null): T | null {
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

function emptyRisk(): Record<RiskLevel, number> {
  return { rendah: 0, sedang: 0, tinggi: 0, kritis: 0 };
}

function emptyStatus(): Record<ReportStatus, number> {
  return { baru: 0, diverifikasi: 0, dalam_penanganan: 0, selesai: 0, ditolak: 0 };
}

function toTime(value: string | null | undefined): number | null {
  if (!value) return null;
  const result = new Date(value).getTime();
  return Number.isNaN(result) ? null : result;
}

function inPeriod(value: string, filters: AuditFilters): boolean {
  const timestamp = toTime(value);
  if (timestamp === null) return false;
  const start = filters.periodStart ? new Date(`${filters.periodStart}T00:00:00`).getTime() : null;
  const end = filters.periodEnd ? new Date(`${filters.periodEnd}T23:59:59.999`).getTime() : null;
  return (start === null || timestamp >= start) && (end === null || timestamp <= end);
}

function matchesLab(laboratoryId: string | null | undefined, selected: string): boolean {
  return !selected || laboratoryId === selected;
}

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[middle - 1] + sorted[middle]) / 2
    : sorted[middle];
}

function percentage(numerator: number, denominator: number): number | null {
  return denominator === 0 ? null : Math.round((numerator / denominator) * 100);
}

function localDateInputValue(value: Date): string {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function riskClassification(level: RiskLevel): AuditFindingClassification {
  if (level === "kritis") return "critical";
  if (level === "tinggi") return "major";
  if (level === "sedang") return "minor";
  return "observation";
}

function mapAuditRun(row: AuditRunRow): AuditRunSummary {
  return {
    id: row.id,
    auditNumber: row.audit_number,
    laboratoryId: row.laboratory_id,
    laboratoryName: one(row.laboratory)?.name ?? null,
    periodStart: row.period_start,
    periodEnd: row.period_end,
    scope: row.scope,
    status: row.status,
    dataComplete: row.data_complete,
    generatedByName: one(row.generator)?.full_name ?? null,
    generatedAt: row.generated_at,
    reviewedAt: row.reviewed_at,
    approvedAt: row.approved_at,
    snapshotHash: row.snapshot_hash,
  };
}

export function getDefaultAuditPeriod(): Pick<AuditFilters, "periodStart" | "periodEnd"> {
  const end = new Date();
  const start = new Date(end);
  start.setDate(start.getDate() - 29);
  return {
    periodStart: localDateInputValue(start),
    periodEnd: localDateInputValue(end),
  };
}

export function resolveAuditPreset(preset: AuditPeriodPreset): Pick<AuditFilters, "periodStart" | "periodEnd"> {
  if (preset === "all") return { periodStart: "", periodEnd: "" };
  const end = new Date();
  const start = new Date(end);
  if (preset === "30d") start.setDate(start.getDate() - 29);
  if (preset === "90d") start.setDate(start.getDate() - 89);
  if (preset === "year") start.setMonth(0, 1);
  return {
    periodStart: localDateInputValue(start),
    periodEnd: localDateInputValue(end),
  };
}

export async function fetchAuditData(): Promise<AuditData> {
  const supabase = createSupabaseBrowserClient();
  const [summaryResult, labResult, profileResult, followUps, actions, workOrders, certificates, reviews, resultItems, attachments, runs] =
    await Promise.all([
      fetchSupabaseSummary(),
      fetchLaboratories(),
      getCurrentUserProfile(),
      supabase.from("report_followups").select("id,report_id,status,note,created_at").order("created_at"),
      supabase.from("checklist_corrective_actions").select(`
        id,result_id,asset_id,laboratory_id,description,control_hierarchy,due_at,status,
        completion_note,completed_at,verified_at,created_at,
        assignee:user_profiles!checklist_corrective_actions_assigned_to_fkey(full_name)
      `),
      supabase.from("asset_work_orders").select("id,work_order_number,asset_id,laboratory_id,maintenance_type,status,title,opened_at,scheduled_at,completed_at,verified_at,return_to_service"),
      supabase.from("asset_certificates").select("id,asset_id,laboratory_id,certificate_type,certificate_number,expires_at"),
      supabase.from("asset_inspection_reviews").select("id,checklist_result_id,asset_id,laboratory_id,recommended_status,review_status,created_at,reviewed_at"),
      supabase
        .from("checklist_result_items")
        .select("result_id,answer,item_label_snapshot,evidence_path")
        .eq("answer", "tidak"),
      supabase.from("report_attachments").select("report_id,created_at"),
      supabase.from("audit_runs").select(`
        id,audit_number,laboratory_id,period_start,period_end,scope,status,data_complete,snapshot_hash,
        generated_at,reviewed_at,approved_at,
        laboratory:laboratories(name),
        generator:user_profiles!audit_runs_generated_by_fkey(full_name)
      `).order("generated_at", { ascending: false }).limit(8),
    ]);

  const errors = [...summaryResult.errors];
  if (labResult.error) errors.push("Daftar laboratorium tidak dapat dimuat.");
  if (profileResult.error || !profileResult.user) errors.push("Profil pembuat audit tidak dapat diverifikasi.");
  if (followUps.error) errors.push("Riwayat tindak lanjut laporan tidak dapat dimuat.");
  if (actions.error) errors.push("Tindakan korektif checklist tidak dapat dimuat.");
  if (workOrders.error) errors.push("Perintah kerja aset tidak dapat dimuat.");
  if (certificates.error) errors.push("Sertifikat aset tidak dapat dimuat.");
  if (reviews.error) errors.push("Peninjauan hasil inspeksi tidak dapat dimuat.");
  if (resultItems.error) errors.push("Detail item checklist tidak dapat dimuat.");
  if (attachments.error) errors.push("Metadata bukti laporan tidak dapat dimuat.");

  return {
    summary: summaryResult.summary,
    laboratories: labResult.laboratories,
    user: profileResult.user,
    followUps: ((followUps.data ?? []) as Array<Record<string, unknown>>).map((row) => ({
      id: String(row.id),
      reportId: String(row.report_id),
      status: row.status as ReportStatus,
      note: String(row.note ?? ""),
      createdAt: String(row.created_at),
    })),
    correctiveActions: ((actions.data ?? []) as Array<Record<string, unknown>>).map((row) => ({
      id: String(row.id),
      resultId: String(row.result_id),
      assetId: String(row.asset_id),
      laboratoryId: String(row.laboratory_id),
      description: String(row.description),
      controlHierarchy: String(row.control_hierarchy),
      assigneeName: one(row.assignee as RelationName | RelationName[] | null)?.full_name ?? null,
      dueAt: String(row.due_at),
      status: String(row.status),
      completionNote: String(row.completion_note ?? ""),
      completedAt: row.completed_at ? String(row.completed_at) : null,
      verifiedAt: row.verified_at ? String(row.verified_at) : null,
      createdAt: String(row.created_at),
    })),
    workOrders: ((workOrders.data ?? []) as Array<Record<string, unknown>>).map((row) => ({
      id: String(row.id),
      number: String(row.work_order_number),
      assetId: String(row.asset_id),
      laboratoryId: String(row.laboratory_id),
      maintenanceType: String(row.maintenance_type),
      status: String(row.status),
      title: String(row.title),
      openedAt: String(row.opened_at),
      scheduledAt: row.scheduled_at ? String(row.scheduled_at) : null,
      completedAt: row.completed_at ? String(row.completed_at) : null,
      verifiedAt: row.verified_at ? String(row.verified_at) : null,
      returnToService: Boolean(row.return_to_service),
    })),
    certificates: ((certificates.data ?? []) as Array<Record<string, unknown>>).map((row) => ({
      id: String(row.id),
      assetId: String(row.asset_id),
      laboratoryId: String(row.laboratory_id),
      type: String(row.certificate_type),
      number: String(row.certificate_number ?? ""),
      expiresAt: row.expires_at ? String(row.expires_at) : null,
    })),
    inspectionReviews: ((reviews.data ?? []) as Array<Record<string, unknown>>).map((row) => ({
      id: String(row.id),
      checklistResultId: String(row.checklist_result_id),
      assetId: String(row.asset_id),
      laboratoryId: String(row.laboratory_id),
      recommendedStatus: String(row.recommended_status),
      reviewStatus: String(row.review_status),
      createdAt: String(row.created_at),
      reviewedAt: row.reviewed_at ? String(row.reviewed_at) : null,
    })),
    resultItems: ((resultItems.data ?? []) as Array<Record<string, unknown>>).map((row) => ({
      resultId: String(row.result_id),
      answer: String(row.answer),
      label: String(row.item_label_snapshot ?? "Item checklist"),
      evidencePath: row.evidence_path ? String(row.evidence_path) : null,
    })),
    attachments: ((attachments.data ?? []) as Array<{ report_id: string; created_at: string }>).map((row) => ({
      reportId: row.report_id,
      createdAt: row.created_at,
    })),
    auditRuns: runs.error ? [] : ((runs.data ?? []) as unknown as AuditRunRow[]).map(mapAuditRun),
    auditStorageAvailable: !runs.error,
    errors: [...new Set(errors)],
  };
}

function makeTrends(reports: DatabaseReport[], checklists: DatabaseChecklistResult[], periodEnd: string): AuditTrendPoint[] {
  const end = periodEnd ? new Date(`${periodEnd}T12:00:00`) : new Date();
  const points: AuditTrendPoint[] = [];
  for (let offset = 5; offset >= 0; offset -= 1) {
    const date = new Date(end.getFullYear(), end.getMonth() - offset, 1);
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
    points.push({
      key,
      label: date.toLocaleDateString("id-ID", { month: "short", year: "2-digit" }),
      reports: 0,
      checklists: 0,
      highCritical: 0,
    });
  }
  const byKey = new Map(points.map((point) => [point.key, point]));
  for (const report of reports) {
    const date = new Date(report.reportedAt);
    const point = byKey.get(`${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`);
    if (point) {
      point.reports += 1;
      if (["tinggi", "kritis"].includes(report.riskCategory)) point.highCritical += 1;
    }
  }
  for (const checklist of checklists) {
    const date = new Date(checklist.completedAt);
    const point = byKey.get(`${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`);
    if (point) {
      point.checklists += 1;
      if (checklist.riskCategory && ["tinggi", "kritis"].includes(checklist.riskCategory)) point.highCritical += 1;
    }
  }
  return points;
}

export function buildAuditView(data: AuditData, filters: AuditFilters): AuditView {
  const now = Date.now();
  const dueSoon = now + 30 * 86_400_000;
  const assets = data.summary.assets.filter((asset) => matchesLab(asset.laboratoryId, filters.laboratoryId));
  const scopedReports = data.summary.reports.filter(
    (report) => matchesLab(report.laboratoryId, filters.laboratoryId),
  );
  const scopedChecklists = data.summary.checklistResults.filter(
    (checklist) => matchesLab(checklist.laboratoryId, filters.laboratoryId),
  );
  const reports = scopedReports.filter((report) => inPeriod(report.reportedAt, filters));
  const activeScopedReports = scopedReports.filter(
    (report) =>
      !["selesai", "ditolak"].includes(report.status),
  );
  const periodUnresolvedReports = reports.filter(
    (report) => !["selesai", "ditolak"].includes(report.status),
  );
  const checklists = scopedChecklists.filter((checklist) => inPeriod(checklist.completedAt, filters));
  const reportIds = new Set(reports.map((report) => report.id));
  const followUps = data.followUps.filter((item) => reportIds.has(item.reportId));
  const scopedCorrectiveActions = data.correctiveActions.filter((item) =>
    matchesLab(item.laboratoryId, filters.laboratoryId),
  );
  const correctiveActions = scopedCorrectiveActions.filter((item) => {
    if (!CLOSED_ACTION_STATUSES.has(item.status)) return true;
    return inPeriod(item.completedAt ?? item.createdAt, filters);
  });
  const workOrders = data.workOrders.filter((item) => matchesLab(item.laboratoryId, filters.laboratoryId));
  const certificates = data.certificates.filter((item) => matchesLab(item.laboratoryId, filters.laboratoryId));
  const inspectionReviews = data.inspectionReviews.filter((item) => matchesLab(item.laboratoryId, filters.laboratoryId));
  const reportRisk = emptyRisk();
  const reportStatus = emptyStatus();
  const checklistRisk = emptyRisk();
  const assetStatus = { layak: 0, perlu_dicek: 0, tidak_layak: 0 };
  reports.forEach((report) => {
    reportRisk[report.riskCategory] += 1;
    reportStatus[report.status] += 1;
  });
  checklists.forEach((checklist) => {
    if (checklist.riskCategory) checklistRisk[checklist.riskCategory] += 1;
  });
  assets.forEach((asset) => { assetStatus[asset.status] += 1; });

  const indicatorEnd = toTime(`${filters.periodEnd}T23:59:59`) ?? now;
  const indicatorStartDate = new Date(indicatorEnd);
  indicatorStartDate.setDate(1);
  indicatorStartDate.setMonth(indicatorStartDate.getMonth() - 5);
  indicatorStartDate.setHours(0, 0, 0, 0);
  const indicatorStart = indicatorStartDate.getTime();
  const inIndicatorWindow = (value: string | null) => {
    const time = toTime(value);
    return time !== null && time >= indicatorStart && time <= indicatorEnd;
  };
  const indicatorReports = scopedReports.filter((report) => inIndicatorWindow(report.reportedAt));
  const indicatorChecklists = scopedChecklists.filter((checklist) => inIndicatorWindow(checklist.completedAt));
  const indicatorReportIds = new Set(indicatorReports.map((report) => report.id));
  const indicatorChecklistIds = new Set(indicatorChecklists.map((checklist) => checklist.id));
  const indicatorFollowUps = data.followUps.filter(
    (item) => indicatorReportIds.has(item.reportId) && inIndicatorWindow(item.createdAt),
  );
  const completedActions = scopedCorrectiveActions.filter(
    (item) =>
      item.status === "selesai" &&
      item.completedAt !== null &&
      inIndicatorWindow(item.completedAt),
  );
  const indicatorItems = data.resultItems.filter((item) => indicatorChecklistIds.has(item.resultId));
  const indicatorAttachments = data.attachments.filter(
    (item) => indicatorReportIds.has(item.reportId) && inIndicatorWindow(item.createdAt),
  );

  const firstFollowUpByReport = new Map<string, AuditFollowUp>();
  for (const followUp of indicatorFollowUps) {
    if (!firstFollowUpByReport.has(followUp.reportId)) firstFollowUpByReport.set(followUp.reportId, followUp);
  }
  const responseHours = indicatorReports.flatMap((report) => {
    const first = firstFollowUpByReport.get(report.id);
    const start = toTime(report.reportedAt);
    const finish = toTime(first?.createdAt);
    return start !== null && finish !== null && finish >= start ? [(finish - start) / 3_600_000] : [];
  });
  const closureHours = indicatorReports.flatMap((report) => {
    const history = indicatorFollowUps.filter((followUp) => followUp.reportId === report.id);
    const lastFollowUp = history.at(-1);
    if (!lastFollowUp || !["selesai", "ditolak"].includes(lastFollowUp.status)) return [];
    const start = toTime(report.reportedAt);
    const finish = toTime(lastFollowUp.createdAt);
    return start !== null && finish !== null && finish >= start ? [(finish - start) / 3_600_000] : [];
  });

  const scheduledAssets = assets.filter((asset) => asset.nextInspectionAt);
  const onScheduleAssets = scheduledAssets.filter((asset) => (toTime(asset.nextInspectionAt) ?? 0) >= now);
  const onTimeActions = completedActions.filter((action) => (toTime(action.completedAt) ?? Infinity) <= (toTime(action.dueAt) ?? -Infinity));
  const highRiskReports = indicatorReports.filter((report) => ["tinggi", "kritis"].includes(report.riskCategory));
  const failedItems = indicatorItems.filter((item) => item.answer === "tidak");
  const evidenceRequiredCount = highRiskReports.length + failedItems.length;
  const evidenceProvided = highRiskReports.filter((report) => indicatorAttachments.some((attachment) => attachment.reportId === report.id)).length + failedItems.filter((item) => item.evidencePath).length;

  const assetFindingCount = new Map<string, number>();
  reports.forEach((report) => {
    if (report.assetId) assetFindingCount.set(report.assetId, (assetFindingCount.get(report.assetId) ?? 0) + 1);
  });
  checklists.forEach((checklist) => {
    if (checklist.assetId && checklist.hasRiskFinding) assetFindingCount.set(checklist.assetId, (assetFindingCount.get(checklist.assetId) ?? 0) + 1);
  });

  const priorityFindings: AuditPriorityFinding[] = [];
  for (const report of activeScopedReports.filter((item) => ["tinggi", "kritis"].includes(item.riskCategory))) {
    priorityFindings.push({
      id: `report-${report.id}`,
      sourceType: "report",
      sourceId: report.id,
      classification: riskClassification(report.riskCategory),
      title: report.title,
      description: report.description,
      assetId: report.assetId,
      assetLabel: report.asset ? `${report.asset.code} - ${report.asset.name}` : "Tanpa aset",
      laboratoryId: report.laboratoryId,
      laboratoryName: report.laboratory?.name ?? "Laboratorium tidak tersedia",
      riskScore: report.riskScore,
      riskCategory: report.riskCategory,
      status: report.status,
      owner: "Teknisi/Kepala laboratorium",
      dueAt: null,
      recommendation: report.recommendation,
      href: `/reports/${report.id}`,
    });
  }
  const representedActionIds = new Set<string>();
  for (const checklist of checklists.filter((item) => item.riskCategory && ["tinggi", "kritis"].includes(item.riskCategory))) {
    const resultActions = scopedCorrectiveActions.filter((item) => item.resultId === checklist.id);
    const action = resultActions.find((item) => !CLOSED_ACTION_STATUSES.has(item.status));
    if (!action && resultActions.length > 0) continue;
    if (action) representedActionIds.add(action.id);
    priorityFindings.push({
      id: `checklist-${checklist.id}`,
      sourceType: "checklist",
      sourceId: checklist.id,
      classification: riskClassification(checklist.riskCategory as RiskLevel),
      title: checklist.template?.title ?? "Temuan checklist K3",
      description: checklist.overallNote || "Temuan inspeksi memerlukan tindak lanjut.",
      assetId: checklist.assetId,
      assetLabel: checklist.asset ? `${checklist.asset.code} - ${checklist.asset.name}` : "Tanpa aset",
      laboratoryId: checklist.laboratoryId,
      laboratoryName: checklist.laboratory?.name ?? "Laboratorium tidak tersedia",
      riskScore: checklist.riskScore,
      riskCategory: checklist.riskCategory,
      status: action?.status ?? "belum_ada_tindakan",
      owner: action?.assigneeName ?? "Belum ditetapkan",
      dueAt: action?.dueAt ?? null,
      recommendation: checklist.recommendation ?? "Tentukan pengendalian dan PIC tindakan korektif.",
      href: `/checklists/${checklist.id}`,
    });
  }
  for (const asset of assets.filter((item) => item.status === "tidak_layak" || item.operationalState !== "aktif")) {
    priorityFindings.push({
      id: `asset-${asset.id}`,
      sourceType: "asset",
      sourceId: asset.id,
      classification: asset.status === "tidak_layak" || asset.operationalState === "dikarantina" ? "critical" : "major",
      title: `Pembatasan operasional ${asset.code}`,
      description: asset.isolationReason || `Status aset ${asset.status}; kondisi operasional ${asset.operationalState}.`,
      assetId: asset.id,
      assetLabel: `${asset.code} - ${asset.name}`,
      laboratoryId: asset.laboratoryId,
      laboratoryName: asset.laboratory?.name ?? "Laboratorium tidak tersedia",
      riskScore: null,
      riskCategory: null,
      status: asset.operationalState,
      owner: "PIC aset",
      dueAt: asset.nextInspectionAt,
      recommendation: "Pertahankan isolasi/pembatasan sampai pemeriksaan, perbaikan, dan verifikasi laik operasi selesai.",
      href: `/assets/${asset.code}`,
    });
  }
  for (const action of scopedCorrectiveActions.filter(
    (item) =>
      !representedActionIds.has(item.id) &&
      !CLOSED_ACTION_STATUSES.has(item.status) &&
      (toTime(item.dueAt) ?? Infinity) < now,
  )) {
    const checklist = data.summary.checklistResults.find((item) => item.id === action.resultId);
    const actionAsset = assets.find((item) => item.id === action.assetId);
    const actionLab = data.laboratories.find((item) => item.id === action.laboratoryId);
    priorityFindings.push({
      id: `action-${action.id}`,
      sourceType: "corrective_action",
      sourceId: action.id,
      classification: "major",
      title: "Tindakan korektif terlambat",
      description: action.description,
      assetId: action.assetId,
      assetLabel: checklist?.asset
        ? `${checklist.asset.code} - ${checklist.asset.name}`
        : actionAsset
          ? `${actionAsset.code} - ${actionAsset.name}`
          : "Aset terkait checklist",
      laboratoryId: action.laboratoryId,
      laboratoryName: checklist?.laboratory?.name ?? actionLab?.name ?? "Laboratorium tidak tersedia",
      riskScore: checklist?.riskScore ?? null,
      riskCategory: checklist?.riskCategory ?? null,
      status: action.status,
      owner: action.assigneeName ?? "Belum ditetapkan",
      dueAt: action.dueAt,
      recommendation: "Eskalasi kepada kepala laboratorium dan verifikasi efektivitas setelah tindakan selesai.",
      href: `/checklists/${action.resultId}`,
    });
  }
  priorityFindings.sort((left, right) => {
    const weight = { critical: 0, major: 1, minor: 2, observation: 3 };
    return weight[left.classification] - weight[right.classification] || (toTime(left.dueAt) ?? Infinity) - (toTime(right.dueAt) ?? Infinity);
  });

  const dataQualityIssues: string[] = [];
  const assetsById = new Map(assets.map((asset) => [asset.id, asset]));
  for (const report of reports) {
    const calculated = calculateRiskScore({ severity: report.severity, probability: report.probability, exposure: report.exposure });
    if (report.riskScore !== calculated.score || report.riskCategory !== calculated.category) dataQualityIssues.push(`${report.reportNumber}: skor/kategori risiko tidak konsisten.`);
    if (!report.laboratoryId) dataQualityIssues.push(`${report.reportNumber}: laboratorium belum terhubung.`);
    const relatedAsset = report.assetId ? assetsById.get(report.assetId) : null;
    if (relatedAsset && relatedAsset.laboratoryId !== report.laboratoryId) dataQualityIssues.push(`${report.reportNumber}: laboratorium laporan berbeda dari aset terkait.`);
    if ((toTime(report.occurredAt) ?? 0) > (toTime(report.reportedAt) ?? Infinity)) dataQualityIssues.push(`${report.reportNumber}: waktu kejadian lebih baru daripada waktu pelaporan.`);
  }
  for (const checklist of checklists) {
    if (checklist.hasRiskFinding) {
      if (checklist.severity === null || checklist.probability === null || checklist.exposure === null) {
        dataQualityIssues.push(`Checklist ${checklist.id.slice(0, 8)}: faktor risiko belum lengkap.`);
      } else {
        const calculated = calculateRiskScore({ severity: checklist.severity, probability: checklist.probability, exposure: checklist.exposure });
        if (checklist.riskScore !== calculated.score || checklist.riskCategory !== calculated.category) dataQualityIssues.push(`Checklist ${checklist.id.slice(0, 8)}: skor/kategori risiko tidak konsisten.`);
      }
    } else if (
      checklist.severity !== null ||
      checklist.probability !== null ||
      checklist.exposure !== null ||
      checklist.riskScore !== null ||
      checklist.riskCategory !== null ||
      checklist.recommendation !== null
    ) {
      dataQualityIssues.push(`Checklist ${checklist.id.slice(0, 8)}: field risiko harus kosong saat tidak ada temuan.`);
    }
    if (!checklist.assetId || !checklist.laboratoryId) dataQualityIssues.push(`Checklist ${checklist.id.slice(0, 8)}: konteks aset/laboratorium belum lengkap.`);
    const relatedAsset = checklist.assetId ? assetsById.get(checklist.assetId) : null;
    if (relatedAsset && relatedAsset.laboratoryId !== checklist.laboratoryId) dataQualityIssues.push(`Checklist ${checklist.id.slice(0, 8)}: laboratorium hasil berbeda dari aset terkait.`);
  }
  const invalidSnapshotPeriods = data.auditRuns.filter((run) => matchesLab(run.laboratoryId, filters.laboratoryId)).filter((run) => {
    if (run.periodStart && run.periodEnd && run.periodStart > run.periodEnd) return true;
    if (!run.periodEnd) return false;
    const generatedDate = localDateInputValue(new Date(run.generatedAt));
    return run.periodEnd > generatedDate;
  }).length;
  if (invalidSnapshotPeriods > 0) {
    dataQualityIssues.push(`${invalidSnapshotPeriods} arsip audit memiliki periode yang melampaui tanggal pembuatannya.`);
  }
  const invalidReviewTimes = inspectionReviews.filter(
    (review) =>
      review.reviewedAt !== null &&
      (toTime(review.reviewedAt) ?? Infinity) < (toTime(review.createdAt) ?? -Infinity),
  ).length;
  if (invalidReviewTimes > 0) {
    dataQualityIssues.push(`${invalidReviewTimes} peninjauan inspeksi memiliki waktu keputusan sebelum catatan peninjauan dibuat.`);
  }

  const metrics: AuditMetrics = {
    totalAssets: assets.length,
    totalReports: reports.length,
    totalChecklists: checklists.length,
    highCriticalRisks: reportRisk.tinggi + reportRisk.kritis + checklistRisk.tinggi + checklistRisk.kritis,
    criticalRisks: reportRisk.kritis + checklistRisk.kritis,
    openReports: periodUnresolvedReports.length,
    activeHazards: activeScopedReports.filter((report) => report.hazardActive).length,
    restrictedAssets: assets.filter((asset) => asset.status === "tidak_layak" || asset.operationalState !== "aktif").length,
    overdueInspections: assets.filter((asset) => asset.nextInspectionAt && (toTime(asset.nextInspectionAt) ?? Infinity) < now && asset.operationalState !== "dipensiunkan").length,
    openActions: scopedCorrectiveActions.filter((action) => !CLOSED_ACTION_STATUSES.has(action.status)).length,
    overdueActions: scopedCorrectiveActions.filter((action) => !CLOSED_ACTION_STATUSES.has(action.status) && (toTime(action.dueAt) ?? Infinity) < now).length,
    expiredCertificates: certificates.filter((certificate) => certificate.expiresAt && (toTime(certificate.expiresAt) ?? Infinity) < now).length,
    certificatesDueSoon: certificates.filter((certificate) => {
      const time = toTime(certificate.expiresAt);
      return time !== null && time >= now && time <= dueSoon;
    }).length,
    openWorkOrders: workOrders.filter((workOrder) => !["selesai", "dibatalkan"].includes(workOrder.status)).length,
    pendingInspectionReviews: inspectionReviews.filter((review) => review.reviewStatus === "menunggu").length,
    medianResponseHours: median(responseHours),
    medianClosureHours: median(closureHours),
    inspectionScheduleCompliance: percentage(onScheduleAssets.length, scheduledAssets.length),
    correctiveActionOnTimeRate: percentage(onTimeActions.length, completedActions.length),
    evidenceCoverage: percentage(evidenceProvided, evidenceRequiredCount),
    repeatFindingAssets: [...assetFindingCount.values()].filter((count) => count >= 2).length,
  };

  const recommendations: string[] = [];
  if (metrics.criticalRisks > 0 || metrics.activeHazards > 0) recommendations.push("Eliminasi atau isolasi sumber bahaya kritis sebelum kegiatan praktik dilanjutkan; gunakan rekayasa teknik sebelum mengandalkan kontrol administratif atau APD.");
  if (metrics.overdueActions > 0) recommendations.push("Eskalasi tindakan korektif yang melewati tenggat, tetapkan PIC, lalu verifikasi efektivitas sebelum dinyatakan selesai.");
  if (metrics.restrictedAssets > 0 || metrics.openWorkOrders > 0) recommendations.push("Pertahankan pembatasan aset sampai perintah kerja selesai, diverifikasi, dan keputusan laik operasi terdokumentasi.");
  if (metrics.overdueInspections > 0) recommendations.push("Jadwalkan inspeksi aset yang terlambat dan evaluasi kecukupan interval inspeksi berdasarkan tingkat bahayanya.");
  if (metrics.expiredCertificates > 0 || metrics.certificatesDueSoon > 0) recommendations.push("Perbarui sertifikat, kalibrasi, atau riksa uji sebelum masa berlaku berakhir dan blokir penggunaan bila bukti wajib sudah kedaluwarsa.");
  if (metrics.repeatFindingAssets > 0) recommendations.push("Lakukan analisis akar penyebab untuk aset dengan temuan berulang; tindakan sementara saja tidak cukup mencegah kejadian kembali.");
  if (recommendations.length === 0) recommendations.push("Kondisi K3 terpantau baik. Pertahankan inspeksi berkala, preventive maintenance, dan pelibatan civitas akademika dalam pelaporan bahaya.");

  return {
    assets,
    reports,
    checklists,
    followUps,
    correctiveActions,
    workOrders,
    certificates,
    inspectionReviews,
    metrics,
    reportRisk,
    reportStatus,
    checklistRisk,
    assetStatus,
    trends: makeTrends(scopedReports, scopedChecklists, filters.periodEnd),
    priorityFindings,
    recommendations,
    dataQualityIssues: [...new Set(dataQualityIssues)],
  };
}

export async function createAuditSnapshot(input: {
  filters: AuditFilters;
  scope: string;
  criteria: string[];
  methodology: string;
  dataComplete: boolean;
  view: AuditView;
}): Promise<{ auditRunId: string | null; error: string | null }> {
  const supabase = createSupabaseBrowserClient();
  const findings = input.view.priorityFindings.map((finding) => ({
    sourceType: finding.sourceType,
    sourceId: finding.sourceId,
    assetId: finding.assetId,
    laboratoryId: finding.laboratoryId,
    classification: finding.classification,
    title: finding.title,
    description: finding.description,
    recommendation: finding.recommendation,
    status: finding.status,
    owner: finding.owner,
    dueAt: finding.dueAt,
  }));
  const snapshot = {
    version: 1,
    generatedAt: new Date().toISOString(),
    filters: input.filters,
    metrics: input.view.metrics,
    reportRisk: input.view.reportRisk,
    reportStatus: input.view.reportStatus,
    checklistRisk: input.view.checklistRisk,
    assetStatus: input.view.assetStatus,
    trends: input.view.trends,
    recommendations: input.view.recommendations,
    dataQualityIssues: input.view.dataQualityIssues,
    sourceIds: {
      assets: input.view.assets.map((item) => item.id),
      reports: input.view.reports.map((item) => item.id),
      checklists: input.view.checklists.map((item) => item.id),
    },
  };
  const { data, error } = await supabase.rpc("create_audit_snapshot", {
    laboratory_scope_id: input.filters.laboratoryId || null,
    audit_period_start: input.filters.periodStart || null,
    audit_period_end: input.filters.periodEnd || null,
    audit_scope: input.scope,
    audit_criteria: input.criteria,
    audit_methodology: input.methodology,
    snapshot_payload: snapshot,
    finding_payload: findings,
    source_data_complete: input.dataComplete,
  });
  return {
    auditRunId: typeof data === "string" ? data : null,
    error: error ? "Draf audit belum berhasil disimpan. Pastikan cakupan sesuai kewenangan Anda." : null,
  };
}

export async function signOffAuditRun(
  auditRunId: string,
  action: "review" | "approve",
  note: string,
): Promise<string | null> {
  const supabase = createSupabaseBrowserClient();
  const { error } = await supabase.rpc("signoff_audit_run", {
    target_audit_run_id: auditRunId,
    signoff_action: action,
    signoff_note: note,
  });
  return error ? "Status audit belum berhasil diperbarui." : null;
}

export async function fetchAuditRunDetail(
  auditRunId: string,
): Promise<{ detail: AuditRunDetail | null; error: string | null }> {
  try {
    const supabase = createSupabaseBrowserClient();
    const [runResponse, findingResponse, signoffResponse] = await Promise.all([
      supabase
        .from("audit_runs")
        .select(`
          id,audit_number,laboratory_id,period_start,period_end,scope,criteria,methodology,
          status,data_complete,snapshot,snapshot_hash,generated_by,generated_at,
          reviewed_by,reviewed_at,approved_at,
          laboratory:laboratories(name),
          generator:user_profiles!audit_runs_generated_by_fkey(full_name)
        `)
        .eq("id", auditRunId)
        .maybeSingle(),
      supabase
        .from("audit_findings")
        .select("id,source_type,source_id,classification,title,description,recommendation,source_status,owner_snapshot,due_at")
        .eq("audit_run_id", auditRunId)
        .order("created_at"),
      supabase
        .from("audit_signoffs")
        .select("id,signoff_type,note,created_at,signer:user_profiles!audit_signoffs_signer_id_fkey(full_name)")
        .eq("audit_run_id", auditRunId)
        .order("created_at"),
    ]);

    if (runResponse.error || !runResponse.data) {
      return { detail: null, error: "Arsip audit tidak ditemukan atau tidak dapat diakses." };
    }
    if (findingResponse.error || signoffResponse.error) {
      return { detail: null, error: "Detail arsip audit belum dapat dimuat lengkap." };
    }

    const row = runResponse.data as Record<string, unknown>;
    const summary = mapAuditRun(row as unknown as AuditRunRow);
    return {
      detail: {
        ...summary,
        criteria: Array.isArray(row.criteria) ? row.criteria.filter((item): item is string => typeof item === "string") : [],
        methodology: String(row.methodology ?? ""),
        snapshot: (row.snapshot && typeof row.snapshot === "object" ? row.snapshot : {}) as AuditRunDetail["snapshot"],
        generatedById: String(row.generated_by),
        reviewedById: row.reviewed_by ? String(row.reviewed_by) : null,
        findings: ((findingResponse.data ?? []) as Array<Record<string, unknown>>).map((finding) => ({
          id: String(finding.id),
          sourceType: String(finding.source_type),
          sourceId: finding.source_id ? String(finding.source_id) : null,
          classification: finding.classification as AuditFindingClassification,
          title: String(finding.title),
          description: String(finding.description),
          recommendation: String(finding.recommendation ?? ""),
          sourceStatus: String(finding.source_status ?? ""),
          owner: String(finding.owner_snapshot ?? "Belum ditetapkan"),
          dueAt: finding.due_at ? String(finding.due_at) : null,
        })),
        signoffs: ((signoffResponse.data ?? []) as Array<Record<string, unknown>>).map((signoff) => ({
          id: String(signoff.id),
          type: signoff.signoff_type as "review" | "approval",
          signerName: one(signoff.signer as RelationName | RelationName[] | null)?.full_name ?? "Penanda tangan",
          note: String(signoff.note ?? ""),
          createdAt: String(signoff.created_at),
        })),
      },
      error: null,
    };
  } catch {
    return { detail: null, error: "Detail arsip audit belum dapat dimuat." };
  }
}
