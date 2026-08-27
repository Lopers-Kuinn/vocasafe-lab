"use client";

import { calculateRiskScore } from "@/lib/risk-scoring";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { canEditReportStatus } from "@/lib/role-access";
import type {
  HazardCategory,
  ReportStatus,
  ReportType,
  RiskLevel,
  RiskScoringInput,
  UserRole,
} from "@/types";

export const REPORT_EVIDENCE_MAX_BYTES = 5 * 1024 * 1024;
export const REPORT_EVIDENCE_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;

export const REPORT_TYPE_LABELS: Record<ReportType, string> = {
  kondisi_tidak_aman: "Kondisi tidak aman",
  near_miss: "Nyaris celaka",
  kecelakaan_cedera: "Kecelakaan / cedera",
  kerusakan_aset: "Kerusakan alat",
  kebakaran_ledakan: "Kebakaran / ledakan",
  tumpahan_bahan: "Tumpahan bahan",
  keluhan_kesehatan: "Keluhan kesehatan",
};

export const HAZARD_CATEGORY_LABELS: Record<HazardCategory, string> = {
  listrik: "Listrik",
  mekanik: "Mekanik",
  kebakaran: "Kebakaran",
  bahan_kimia: "Bahan kimia",
  ergonomi: "Ergonomi",
  fasilitas_k3: "Fasilitas K3",
  lingkungan: "Lingkungan",
  lainnya: "Lainnya",
};

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const REPORT_SELECT = `
  id,
  report_number,
  asset_id,
  laboratory_id,
  reporter_id,
  title,
  description,
  location,
  report_type,
  hazard_category,
  occurred_at,
  activity_at_time,
  hazard_active,
  immediate_action,
  pic_notified,
  people_affected,
  injury_details,
  witness_details,
  is_confidential,
  status,
  severity,
  probability,
  exposure,
  risk_score,
  risk_category,
  recommendation,
  reported_at,
  created_at,
  updated_at,
  asset:assets(id,code,name,location),
  laboratory:laboratories(id,code,name)
`;

interface ReportAssetRow {
  id: string;
  code: string;
  name: string;
  location: string | null;
}

interface ReportLaboratoryRow {
  id: string;
  code: string;
  name: string;
}

interface ReportRow {
  id: string;
  report_number: string;
  asset_id: string | null;
  laboratory_id: string | null;
  reporter_id: string | null;
  title: string;
  description: string;
  location: string | null;
  report_type: ReportType;
  hazard_category: HazardCategory;
  occurred_at: string | null;
  activity_at_time: string | null;
  hazard_active: boolean;
  immediate_action: string | null;
  pic_notified: boolean;
  people_affected: boolean;
  injury_details: string | null;
  witness_details: string | null;
  is_confidential: boolean;
  status: ReportStatus;
  severity: number;
  probability: number;
  exposure: number;
  risk_score: number;
  risk_category: RiskLevel;
  recommendation: string | null;
  reported_at: string | null;
  created_at: string;
  updated_at: string;
  asset: ReportAssetRow | ReportAssetRow[] | null;
  laboratory: ReportLaboratoryRow | ReportLaboratoryRow[] | null;
}

interface AttachmentRow {
  id: string;
  report_id: string;
  bucket: string;
  path: string;
  file_name: string | null;
  mime_type: string | null;
  size_bytes: number | null;
  uploaded_by: string | null;
  created_at: string;
}

interface FollowUpRow {
  id: string;
  report_id: string;
  status: ReportStatus;
  note: string | null;
  created_by: string | null;
  created_at: string;
}

interface ProfileRoleRow {
  role: UserRole;
  is_active: boolean;
}

export interface ReportAssetSummary {
  id: string;
  code: string;
  name: string;
  location: string | null;
}

export interface ReportAttachment {
  id: string;
  reportId: string;
  bucket: string;
  path: string;
  fileName: string;
  mimeType: string | null;
  sizeBytes: number | null;
  uploadedBy: string | null;
  createdAt: string;
  signedUrl: string | null;
}

export interface ReportFollowUp {
  id: string;
  reportId: string;
  status: ReportStatus;
  note: string;
  createdBy: string | null;
  createdAt: string;
}

export interface DatabaseReport {
  id: string;
  reportNumber: string;
  assetId: string | null;
  laboratoryId: string | null;
  reporterId: string | null;
  title: string;
  description: string;
  location: string;
  reportType: ReportType;
  hazardCategory: HazardCategory;
  occurredAt: string;
  activityAtTime: string;
  hazardActive: boolean;
  immediateAction: string;
  picNotified: boolean;
  peopleAffected: boolean;
  injuryDetails: string;
  witnessDetails: string;
  isConfidential: boolean;
  status: ReportStatus;
  severity: number;
  probability: number;
  exposure: number;
  riskScore: number;
  riskCategory: RiskLevel;
  recommendation: string;
  reportedAt: string;
  createdAt: string;
  updatedAt: string;
  asset: ReportAssetSummary | null;
  laboratory: ReportLaboratoryRow | null;
  attachments: ReportAttachment[];
}

export interface CreateReportInput {
  assetId: string | null;
  laboratoryId: string;
  title: string;
  description: string;
  location: string;
  reportType: ReportType;
  hazardCategory: HazardCategory;
  occurredAt: string;
  activityAtTime: string;
  hazardActive: boolean;
  immediateAction: string;
  picNotified: boolean;
  peopleAffected: boolean;
  injuryDetails: string;
  witnessDetails: string;
  isConfidential: boolean;
  riskInput: RiskScoringInput;
}

function firstRelation<T>(value: T | T[] | null): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value;
}

function mapReport(row: ReportRow): DatabaseReport {
  const asset = firstRelation(row.asset);
  const laboratory = firstRelation(row.laboratory);
  const calculatedRisk = calculateRiskScore({
    severity: row.severity,
    probability: row.probability,
    exposure: row.exposure,
  });

  return {
    id: row.id,
    reportNumber: row.report_number,
    assetId: row.asset_id,
    laboratoryId: row.laboratory_id,
    reporterId: row.reporter_id,
    title: row.title,
    description: row.description,
    location: row.location ?? asset?.location ?? "Lokasi tidak tersedia",
    reportType: row.report_type,
    hazardCategory: row.hazard_category,
    occurredAt: row.occurred_at ?? row.reported_at ?? row.created_at,
    activityAtTime: row.activity_at_time ?? "",
    hazardActive: row.hazard_active,
    immediateAction: row.immediate_action ?? "",
    picNotified: row.pic_notified,
    peopleAffected: row.people_affected,
    injuryDetails: row.injury_details ?? "",
    witnessDetails: row.witness_details ?? "",
    isConfidential: row.is_confidential,
    status: row.status,
    severity: row.severity,
    probability: row.probability,
    exposure: row.exposure,
    riskScore: row.risk_score,
    riskCategory: row.risk_category,
    recommendation: row.recommendation ?? calculatedRisk.recommendation,
    reportedAt: row.reported_at ?? row.created_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    asset: asset
      ? {
          id: asset.id,
          code: asset.code,
          name: asset.name,
          location: asset.location,
        }
      : null,
    laboratory: laboratory
      ? {
          id: laboratory.id,
          code: laboratory.code,
          name: laboratory.name,
        }
      : null,
    attachments: [],
  };
}

function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return "Data laporan belum dapat diproses. Silakan coba kembali.";
}

function generateReportNumber(): string {
  const now = new Date();
  const date = now.toISOString().slice(0, 10).replaceAll("-", "");
  const unique = crypto.randomUUID().slice(0, 8).toUpperCase();
  return `VSL-${date}-${unique}`;
}

function safeFileName(fileName: string): string {
  const normalized = fileName
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

  return normalized || "evidence-image";
}

function mapFollowUp(row: FollowUpRow): ReportFollowUp {
  return {
    id: row.id,
    reportId: row.report_id,
    status: row.status,
    note: row.note ?? "Tanpa catatan tindak lanjut.",
    createdBy: row.created_by,
    createdAt: row.created_at,
  };
}

export function validateEvidenceFile(file: File): string | null {
  if (!REPORT_EVIDENCE_TYPES.includes(file.type as (typeof REPORT_EVIDENCE_TYPES)[number])) {
    return "Foto harus berformat JPG, PNG, atau WebP.";
  }

  if (file.size > REPORT_EVIDENCE_MAX_BYTES) {
    return "Ukuran foto maksimal 5 MB.";
  }

  return null;
}

export async function fetchReports(): Promise<{
  reports: DatabaseReport[];
  error: string | null;
}> {
  try {
    const supabase = createSupabaseBrowserClient();
    const { data, error } = await supabase
      .from("reports")
      .select(REPORT_SELECT)
      .order("reported_at", { ascending: false });

    if (error) return { reports: [], error: error.message };

    return {
      reports: ((data ?? []) as unknown as ReportRow[]).map(mapReport),
      error: null,
    };
  } catch (error) {
    return { reports: [], error: errorMessage(error) };
  }
}

export async function fetchReportById(id: string): Promise<{
  report: DatabaseReport | null;
  error: string | null;
  attachmentError: string | null;
}> {
  if (!UUID_PATTERN.test(id)) {
    return { report: null, error: null, attachmentError: null };
  }

  try {
    const supabase = createSupabaseBrowserClient();
    const { data, error } = await supabase
      .from("reports")
      .select(REPORT_SELECT)
      .eq("id", id)
      .maybeSingle();

    if (error) return { report: null, error: error.message, attachmentError: null };
    if (!data) return { report: null, error: null, attachmentError: null };

    const report = mapReport(data as unknown as ReportRow);
    const { data: attachmentData, error: attachmentQueryError } = await supabase
      .from("report_attachments")
      .select(
        "id,report_id,bucket,path,file_name,mime_type,size_bytes,uploaded_by,created_at",
      )
      .eq("report_id", id)
      .order("created_at", { ascending: true });

    if (attachmentQueryError) {
      return {
        report,
        error: null,
        attachmentError: attachmentQueryError.message,
      };
    }

    let signedUrlError: string | null = null;
    report.attachments = await Promise.all(
      ((attachmentData ?? []) as AttachmentRow[]).map(async (attachment) => {
        const { data: signedData, error: signedError } = await supabase.storage
          .from(attachment.bucket)
          .createSignedUrl(attachment.path, 60 * 60);

        if (signedError && !signedUrlError) signedUrlError = signedError.message;

        return {
          id: attachment.id,
          reportId: attachment.report_id,
          bucket: attachment.bucket,
          path: attachment.path,
          fileName: attachment.file_name ?? "Foto bukti",
          mimeType: attachment.mime_type,
          sizeBytes: attachment.size_bytes,
          uploadedBy: attachment.uploaded_by,
          createdAt: attachment.created_at,
          signedUrl: signedData?.signedUrl ?? null,
        };
      }),
    );

    return { report, error: null, attachmentError: signedUrlError };
  } catch (error) {
    return {
      report: null,
      error: errorMessage(error),
      attachmentError: null,
    };
  }
}

export async function fetchReportFollowUps(reportId: string): Promise<{
  followUps: ReportFollowUp[];
  error: string | null;
}> {
  if (!UUID_PATTERN.test(reportId)) {
    return { followUps: [], error: null };
  }

  try {
    const supabase = createSupabaseBrowserClient();
    const { data, error } = await supabase
      .from("report_followups")
      .select("id,report_id,status,note,created_by,created_at")
      .eq("report_id", reportId)
      .order("created_at", { ascending: true });

    if (error) return { followUps: [], error: error.message };

    return {
      followUps: ((data ?? []) as FollowUpRow[]).map(mapFollowUp),
      error: null,
    };
  } catch (error) {
    return { followUps: [], error: errorMessage(error) };
  }
}

const VALID_REPORT_STATUSES = new Set<ReportStatus>([
  "baru",
  "diverifikasi",
  "dalam_penanganan",
  "selesai",
  "ditolak",
]);

export async function saveReportFollowUp(input: {
  reportId: string;
  status: ReportStatus;
  note: string;
}): Promise<{
  followUp: ReportFollowUp | null;
  statusUpdated: boolean;
  error: string | null;
}> {
  const note = input.note.trim();

  if (!UUID_PATTERN.test(input.reportId)) {
    return {
      followUp: null,
      statusUpdated: false,
      error: "ID laporan tidak valid.",
    };
  }

  if (!VALID_REPORT_STATUSES.has(input.status)) {
    return {
      followUp: null,
      statusUpdated: false,
      error: "Status laporan tidak valid.",
    };
  }

  if (!note) {
    return {
      followUp: null,
      statusUpdated: false,
      error: "Catatan tindak lanjut wajib diisi.",
    };
  }

  try {
    const supabase = createSupabaseBrowserClient();
    const { data: authData, error: authError } = await supabase.auth.getUser();

    if (authError || !authData.user) {
      return {
        followUp: null,
        statusUpdated: false,
        error: authError?.message ?? "Sesi login tidak ditemukan.",
      };
    }

    const { data: profileData, error: profileError } = await supabase
      .from("user_profiles")
      .select("role,is_active")
      .eq("id", authData.user.id)
      .single();

    if (profileError || !profileData) {
      return {
        followUp: null,
        statusUpdated: false,
        error: profileError?.message ?? "Profil pengguna tidak ditemukan.",
      };
    }

    const profile = profileData as ProfileRoleRow;
    if (
      !profile.is_active ||
      !canEditReportStatus(profile.role)
    ) {
      return {
        followUp: null,
        statusUpdated: false,
        error:
          "Hanya teknisi atau admin yang dapat memperbarui laporan.",
      };
    }

    const { data: followUpData, error: followUpError } = await supabase.rpc(
      "save_report_followup_atomic",
      {
        target_report_id: input.reportId,
        next_status: input.status,
        followup_note: note,
      },
    );

    const followUp = Array.isArray(followUpData) ? followUpData[0] : followUpData;
    if (followUpError || !followUp) {
      return {
        followUp: null,
        statusUpdated: false,
        error: `Status dan tindak lanjut gagal disimpan: ${followUpError?.message ?? "Laporan tidak ditemukan atau tidak dapat diakses."}`,
      };
    }

    return {
      followUp: mapFollowUp(followUp as FollowUpRow),
      statusUpdated: true,
      error: null,
    };
  } catch (error) {
    return {
      followUp: null,
      statusUpdated: false,
      error: errorMessage(error),
    };
  }
}

export async function createReport(input: CreateReportInput): Promise<{
  report: DatabaseReport | null;
  reporterId: string | null;
  error: string | null;
}> {
  try {
    const supabase = createSupabaseBrowserClient();
    const { data: authData, error: authError } = await supabase.auth.getUser();

    if (authError || !authData.user) {
      return {
        report: null,
        reporterId: null,
        error: authError?.message ?? "Sesi login tidak ditemukan.",
      };
    }

    const risk = calculateRiskScore(input.riskInput);
    const { data, error } = await supabase
      .from("reports")
      .insert({
        report_number: generateReportNumber(),
        asset_id: input.assetId,
        laboratory_id: input.laboratoryId,
        reporter_id: authData.user.id,
        title: input.title.trim(),
        description: input.description.trim(),
        location: input.location.trim(),
        report_type: input.reportType,
        hazard_category: input.hazardCategory,
        occurred_at: input.occurredAt,
        activity_at_time: input.activityAtTime.trim() || null,
        hazard_active: input.hazardActive,
        immediate_action: input.immediateAction.trim() || null,
        pic_notified: input.picNotified,
        people_affected: input.peopleAffected,
        injury_details: input.peopleAffected
          ? input.injuryDetails.trim()
          : null,
        witness_details: input.witnessDetails.trim() || null,
        is_confidential: input.isConfidential,
        status: "baru",
        severity: input.riskInput.severity,
        probability: input.riskInput.probability,
        exposure: input.riskInput.exposure,
        risk_score: risk.score,
        risk_category: risk.category,
        recommendation: risk.recommendation,
      })
      .select(REPORT_SELECT)
      .single();

    if (error) {
      return { report: null, reporterId: authData.user.id, error: error.message };
    }

    return {
      report: mapReport(data as unknown as ReportRow),
      reporterId: authData.user.id,
      error: null,
    };
  } catch (error) {
    return { report: null, reporterId: null, error: errorMessage(error) };
  }
}

export async function uploadReportEvidence(input: {
  reportId: string;
  reporterId: string;
  bucket: string;
  file: File;
}): Promise<{ error: string | null }> {
  const validationError = validateEvidenceFile(input.file);
  if (validationError) return { error: validationError };

  try {
    const supabase = createSupabaseBrowserClient();
    const path = `reports/${input.reportId}/${Date.now()}-${crypto.randomUUID().slice(0, 8)}-${safeFileName(input.file.name)}`;
    const { error: uploadError } = await supabase.storage
      .from(input.bucket)
      .upload(path, input.file, {
        cacheControl: "3600",
        contentType: input.file.type,
        upsert: false,
      });

    if (uploadError) {
      return {
        error: `Laporan tersimpan, tetapi foto gagal diunggah: ${uploadError.message}`,
      };
    }

    const { error: metadataError } = await supabase
      .from("report_attachments")
      .insert({
        report_id: input.reportId,
        bucket: input.bucket,
        path,
        file_name: input.file.name,
        mime_type: input.file.type,
        size_bytes: input.file.size,
        uploaded_by: input.reporterId,
      });

    if (metadataError) {
      await supabase.storage.from(input.bucket).remove([path]);
      return {
        error: `Laporan tersimpan, tetapi metadata foto gagal disimpan: ${metadataError.message}`,
      };
    }

    return { error: null };
  } catch (error) {
    return {
      error: `Laporan tersimpan, tetapi foto gagal diproses: ${errorMessage(error)}`,
    };
  }
}
