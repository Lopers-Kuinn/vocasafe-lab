"use client";

import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import type {
  AssetOperationalState,
  DatabaseAssetStatus,
} from "@/lib/assets";

export type SafetyControlType =
  | "guard"
  | "interlock"
  | "emergency_stop"
  | "grounding"
  | "ventilasi"
  | "alarm"
  | "isolasi_energi"
  | "lainnya";
export type SafetyControlStatus =
  | "baik"
  | "perlu_dicek"
  | "tidak_berfungsi"
  | "tidak_berlaku";
export type CertificateType =
  | "riksa_uji"
  | "kalibrasi"
  | "izin_operasi"
  | "sertifikat_lainnya";
export type WorkOrderType =
  | "preventif"
  | "korektif"
  | "inspeksi_khusus"
  | "kalibrasi";
export type WorkOrderStatus =
  | "terbuka"
  | "dijadwalkan"
  | "dalam_pengerjaan"
  | "menunggu_verifikasi"
  | "selesai"
  | "dibatalkan";
export type AssetDocumentType =
  | "manual"
  | "datasheet"
  | "foto"
  | "diagram"
  | "dokumen_lainnya";

export interface AssetSafetyControl {
  id: string;
  controlType: SafetyControlType;
  name: string;
  status: SafetyControlStatus;
  lastVerifiedAt: string | null;
  note: string | null;
}

export interface AssetCertificate {
  id: string;
  certificateType: CertificateType;
  certificateNumber: string | null;
  issuer: string | null;
  issuedAt: string | null;
  expiresAt: string | null;
  bucket: string | null;
  path: string | null;
  fileName: string | null;
  note: string | null;
}

export interface AssetWorkOrder {
  id: string;
  workOrderNumber: string;
  maintenanceType: WorkOrderType;
  status: WorkOrderStatus;
  title: string;
  description: string | null;
  findings: string | null;
  partsReplaced: string | null;
  assignedTo: string | null;
  openedAt: string;
  scheduledAt: string | null;
  completedAt: string | null;
  verificationNote: string | null;
  returnToService: boolean;
}

export interface AssetDocument {
  id: string;
  documentType: AssetDocumentType;
  title: string;
  bucket: string;
  path: string;
  fileName: string;
  mimeType: string | null;
  sizeBytes: number | null;
  note: string | null;
  createdAt: string;
}

export interface AssetInspectionReview {
  id: string;
  checklistResultId: string;
  recommendedStatus: DatabaseAssetStatus;
  reviewStatus: "menunggu" | "diterapkan" | "ditolak";
  reviewNote: string | null;
  createdAt: string;
}

export interface AssetSafetyBundle {
  controls: AssetSafetyControl[];
  certificates: AssetCertificate[];
  workOrders: AssetWorkOrder[];
  documents: AssetDocument[];
  inspectionReviews: AssetInspectionReview[];
}

export interface AssetComplianceCounts {
  expiredCertificates: number;
  certificatesDueSoon: number;
  openWorkOrders: number;
  pendingReviews: number;
}

export interface SaveSafetyProfileInput {
  assetId: string;
  manufacturer: string;
  model: string;
  serialNumber: string;
  manufactureYear: number | null;
  acquiredAt: string | null;
  technicalSpecs: Record<string, string>;
  energySources: string[];
  requiredCompetency: string;
  regulatoryReference: string;
  inspectionIntervalDays: number;
  operationalState: AssetOperationalState;
  isolationReason: string;
}

export interface SaveSafetyControlInput {
  id?: string | null;
  assetId: string;
  controlType: SafetyControlType;
  name: string;
  status: SafetyControlStatus;
  lastVerifiedAt: string | null;
  note: string;
}

export interface SaveCertificateInput {
  id?: string | null;
  assetId: string;
  certificateType: CertificateType;
  certificateNumber: string;
  issuer: string;
  issuedAt: string | null;
  expiresAt: string | null;
  note: string;
  file?: File | null;
}

export interface SaveWorkOrderInput {
  id?: string | null;
  assetId: string;
  maintenanceType: WorkOrderType;
  status: WorkOrderStatus;
  title: string;
  description: string;
  findings: string;
  partsReplaced: string;
  assignedTo: string | null;
  openedAt: string | null;
  scheduledAt: string | null;
  completedAt: string | null;
  verificationNote: string;
  returnToService: boolean;
}

export interface SaveAssetDocumentInput {
  assetId: string;
  documentType: AssetDocumentType;
  title: string;
  note: string;
  file: File;
}

interface SafetyControlRow {
  id: string;
  control_type: SafetyControlType;
  name: string;
  status: SafetyControlStatus;
  last_verified_at: string | null;
  note: string | null;
}

interface CertificateRow {
  id: string;
  certificate_type: CertificateType;
  certificate_number: string | null;
  issuer: string | null;
  issued_at: string | null;
  expires_at: string | null;
  bucket: string | null;
  path: string | null;
  file_name: string | null;
  note: string | null;
}

interface WorkOrderRow {
  id: string;
  work_order_number: string;
  maintenance_type: WorkOrderType;
  status: WorkOrderStatus;
  title: string;
  description: string | null;
  findings: string | null;
  parts_replaced: string | null;
  assigned_to: string | null;
  opened_at: string;
  scheduled_at: string | null;
  completed_at: string | null;
  verification_note: string | null;
  return_to_service: boolean;
}

interface DocumentRow {
  id: string;
  document_type: AssetDocumentType;
  title: string;
  bucket: string;
  path: string;
  file_name: string;
  mime_type: string | null;
  size_bytes: number | null;
  note: string | null;
  created_at: string;
}

interface ReviewRow {
  id: string;
  checklist_result_id: string;
  recommended_status: DatabaseAssetStatus;
  review_status: AssetInspectionReview["reviewStatus"];
  review_note: string | null;
  created_at: string;
}

const ASSET_DOCUMENTS_BUCKET = "asset-documents";
const MAX_DOCUMENT_BYTES = 10 * 1024 * 1024;
const ALLOWED_MIME_TYPES = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
]);

function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return "Data keselamatan aset tidak dapat diproses.";
}

function safeFileName(fileName: string): string {
  const dotIndex = fileName.lastIndexOf(".");
  const extension = dotIndex >= 0 ? fileName.slice(dotIndex).toLowerCase() : "";
  const base = (dotIndex >= 0 ? fileName.slice(0, dotIndex) : fileName)
    .normalize("NFKD")
    .replace(/[^a-zA-Z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "dokumen";
  return `${base}${extension}`;
}

async function uploadAssetFile(assetId: string, file: File) {
  if (!ALLOWED_MIME_TYPES.has(file.type)) {
    return { path: null, error: "File harus PDF, JPG, PNG, atau WebP." };
  }
  if (file.size > MAX_DOCUMENT_BYTES) {
    return { path: null, error: "Ukuran file maksimal 10 MB." };
  }

  const supabase = createSupabaseBrowserClient();
  const path = `assets/${assetId}/${crypto.randomUUID()}-${safeFileName(file.name)}`;
  const { error } = await supabase.storage
    .from(ASSET_DOCUMENTS_BUCKET)
    .upload(path, file, { contentType: file.type, upsert: false });

  return { path: error ? null : path, error: error?.message ?? null };
}

async function removeUploadedFile(path: string) {
  const supabase = createSupabaseBrowserClient();
  await supabase.storage.from(ASSET_DOCUMENTS_BUCKET).remove([path]);
}

export async function fetchAssetSafetyBundle(
  assetId: string,
): Promise<{ bundle: AssetSafetyBundle; error: string | null }> {
  const empty: AssetSafetyBundle = {
    controls: [],
    certificates: [],
    workOrders: [],
    documents: [],
    inspectionReviews: [],
  };

  try {
    const supabase = createSupabaseBrowserClient();
    const [controls, certificates, workOrders, documents, reviews] = await Promise.all([
      supabase
        .from("asset_safety_controls")
        .select("id,control_type,name,status,last_verified_at,note")
        .eq("asset_id", assetId)
        .order("name"),
      supabase
        .from("asset_certificates")
        .select("id,certificate_type,certificate_number,issuer,issued_at,expires_at,bucket,path,file_name,note")
        .eq("asset_id", assetId)
        .order("expires_at", { ascending: true, nullsFirst: false }),
      supabase
        .from("asset_work_orders")
        .select("id,work_order_number,maintenance_type,status,title,description,findings,parts_replaced,assigned_to,opened_at,scheduled_at,completed_at,verification_note,return_to_service")
        .eq("asset_id", assetId)
        .order("opened_at", { ascending: false }),
      supabase
        .from("asset_documents")
        .select("id,document_type,title,bucket,path,file_name,mime_type,size_bytes,note,created_at")
        .eq("asset_id", assetId)
        .order("created_at", { ascending: false }),
      supabase
        .from("asset_inspection_reviews")
        .select("id,checklist_result_id,recommended_status,review_status,review_note,created_at")
        .eq("asset_id", assetId)
        .order("created_at", { ascending: false }),
    ]);

    const errors = [controls.error, certificates.error, workOrders.error, documents.error, reviews.error]
      .filter(Boolean)
      .map((error) => error?.message)
      .filter((message): message is string => Boolean(message));

    return {
      bundle: {
        controls: ((controls.data ?? []) as SafetyControlRow[]).map((row) => ({
          id: row.id,
          controlType: row.control_type,
          name: row.name,
          status: row.status,
          lastVerifiedAt: row.last_verified_at,
          note: row.note,
        })),
        certificates: ((certificates.data ?? []) as CertificateRow[]).map((row) => ({
          id: row.id,
          certificateType: row.certificate_type,
          certificateNumber: row.certificate_number,
          issuer: row.issuer,
          issuedAt: row.issued_at,
          expiresAt: row.expires_at,
          bucket: row.bucket,
          path: row.path,
          fileName: row.file_name,
          note: row.note,
        })),
        workOrders: ((workOrders.data ?? []) as WorkOrderRow[]).map((row) => ({
          id: row.id,
          workOrderNumber: row.work_order_number,
          maintenanceType: row.maintenance_type,
          status: row.status,
          title: row.title,
          description: row.description,
          findings: row.findings,
          partsReplaced: row.parts_replaced,
          assignedTo: row.assigned_to,
          openedAt: row.opened_at,
          scheduledAt: row.scheduled_at,
          completedAt: row.completed_at,
          verificationNote: row.verification_note,
          returnToService: row.return_to_service,
        })),
        documents: ((documents.data ?? []) as DocumentRow[]).map((row) => ({
          id: row.id,
          documentType: row.document_type,
          title: row.title,
          bucket: row.bucket,
          path: row.path,
          fileName: row.file_name,
          mimeType: row.mime_type,
          sizeBytes: row.size_bytes,
          note: row.note,
          createdAt: row.created_at,
        })),
        inspectionReviews: ((reviews.data ?? []) as ReviewRow[]).map((row) => ({
          id: row.id,
          checklistResultId: row.checklist_result_id,
          recommendedStatus: row.recommended_status,
          reviewStatus: row.review_status,
          reviewNote: row.review_note,
          createdAt: row.created_at,
        })),
      },
      error: errors.length > 0 ? errors.join("; ") : null,
    };
  } catch (error) {
    return { bundle: empty, error: errorMessage(error) };
  }
}

export async function fetchAssetComplianceCounts(): Promise<{
  counts: AssetComplianceCounts;
  error: string | null;
}> {
  const empty: AssetComplianceCounts = {
    expiredCertificates: 0,
    certificatesDueSoon: 0,
    openWorkOrders: 0,
    pendingReviews: 0,
  };

  try {
    const supabase = createSupabaseBrowserClient();
    const [certificates, workOrders, reviews] = await Promise.all([
      supabase.from("asset_certificates").select("expires_at"),
      supabase
        .from("asset_work_orders")
        .select("id", { count: "exact", head: true })
        .not("status", "in", "(selesai,dibatalkan)"),
      supabase
        .from("asset_inspection_reviews")
        .select("id", { count: "exact", head: true })
        .eq("review_status", "menunggu"),
    ]);

    const errors = [certificates.error, workOrders.error, reviews.error]
      .filter(Boolean)
      .map((error) => error?.message)
      .filter((message): message is string => Boolean(message));
    const now = new Date().getTime();
    const dueSoon = now + 30 * 86_400_000;
    const expirationDates = ((certificates.data ?? []) as Array<{ expires_at: string | null }>)
      .map((item) => item.expires_at ? new Date(item.expires_at).getTime() : null)
      .filter((value): value is number => value !== null && !Number.isNaN(value));

    return {
      counts: {
        expiredCertificates: expirationDates.filter((value) => value < now).length,
        certificatesDueSoon: expirationDates.filter((value) => value >= now && value <= dueSoon).length,
        openWorkOrders: workOrders.count ?? 0,
        pendingReviews: reviews.count ?? 0,
      },
      error: errors.length > 0 ? errors.join("; ") : null,
    };
  } catch (error) {
    return { counts: empty, error: errorMessage(error) };
  }
}

export async function saveAssetSafetyProfile(input: SaveSafetyProfileInput) {
  try {
    const supabase = createSupabaseBrowserClient();
    const { data, error } = await supabase.rpc("save_asset_safety_profile", {
      target_asset_id: input.assetId,
      asset_manufacturer: input.manufacturer,
      asset_model: input.model,
      asset_serial_number: input.serialNumber,
      asset_manufacture_year: input.manufactureYear,
      asset_acquired_at: input.acquiredAt,
      asset_technical_specs: input.technicalSpecs,
      asset_energy_sources: input.energySources,
      asset_required_competency: input.requiredCompetency,
      asset_regulatory_reference: input.regulatoryReference,
      asset_inspection_interval_days: input.inspectionIntervalDays,
      asset_operational_state: input.operationalState,
      asset_isolation_reason: input.isolationReason,
    });
    return { id: typeof data === "string" ? data : null, error: error?.message ?? null };
  } catch (error) {
    return { id: null, error: errorMessage(error) };
  }
}

export async function saveAssetSafetyControl(input: SaveSafetyControlInput) {
  try {
    const supabase = createSupabaseBrowserClient();
    const { data, error } = await supabase.rpc("save_asset_safety_control", {
      target_control_id: input.id ?? null,
      target_asset_id: input.assetId,
      control_kind: input.controlType,
      control_name: input.name,
      control_status: input.status,
      control_last_verified_at: input.lastVerifiedAt,
      control_note: input.note,
    });
    return { id: typeof data === "string" ? data : null, error: error?.message ?? null };
  } catch (error) {
    return { id: null, error: errorMessage(error) };
  }
}

export async function saveAssetCertificate(input: SaveCertificateInput) {
  let uploadPath: string | null = null;
  try {
    if (input.file) {
      const upload = await uploadAssetFile(input.assetId, input.file);
      if (upload.error || !upload.path) return { id: null, error: upload.error };
      uploadPath = upload.path;
    }

    const supabase = createSupabaseBrowserClient();
    const { data, error } = await supabase.rpc("save_asset_certificate", {
      target_certificate_id: input.id ?? null,
      target_asset_id: input.assetId,
      certificate_kind: input.certificateType,
      certificate_number_value: input.certificateNumber,
      certificate_issuer: input.issuer,
      certificate_issued_at: input.issuedAt,
      certificate_expires_at: input.expiresAt,
      document_bucket: uploadPath ? ASSET_DOCUMENTS_BUCKET : null,
      document_path: uploadPath,
      document_file_name: input.file?.name ?? null,
      document_mime_type: input.file?.type ?? null,
      document_size_bytes: input.file?.size ?? null,
      certificate_note: input.note,
    });

    if (error && uploadPath) await removeUploadedFile(uploadPath);
    return { id: typeof data === "string" ? data : null, error: error?.message ?? null };
  } catch (error) {
    if (uploadPath) await removeUploadedFile(uploadPath);
    return { id: null, error: errorMessage(error) };
  }
}

export async function saveAssetWorkOrder(input: SaveWorkOrderInput) {
  try {
    const supabase = createSupabaseBrowserClient();
    const { data, error } = await supabase.rpc("save_asset_work_order", {
      target_work_order_id: input.id ?? null,
      target_asset_id: input.assetId,
      work_kind: input.maintenanceType,
      work_status: input.status,
      work_title: input.title,
      work_description: input.description,
      work_findings: input.findings,
      work_parts_replaced: input.partsReplaced,
      work_assigned_to: input.assignedTo,
      work_opened_at: input.openedAt,
      work_scheduled_at: input.scheduledAt,
      work_completed_at: input.completedAt,
      work_verification_note: input.verificationNote,
      work_return_to_service: input.returnToService,
    });
    return { id: typeof data === "string" ? data : null, error: error?.message ?? null };
  } catch (error) {
    return { id: null, error: errorMessage(error) };
  }
}

export async function saveAssetDocument(input: SaveAssetDocumentInput) {
  const upload = await uploadAssetFile(input.assetId, input.file);
  if (upload.error || !upload.path) return { id: null, error: upload.error };

  try {
    const supabase = createSupabaseBrowserClient();
    const { data, error } = await supabase.rpc("save_asset_document_metadata", {
      target_asset_id: input.assetId,
      document_kind: input.documentType,
      document_title: input.title,
      document_bucket: ASSET_DOCUMENTS_BUCKET,
      document_path: upload.path,
      document_file_name: input.file.name,
      document_mime_type: input.file.type,
      document_size_bytes: input.file.size,
      document_note: input.note,
    });
    if (error) await removeUploadedFile(upload.path);
    return { id: typeof data === "string" ? data : null, error: error?.message ?? null };
  } catch (error) {
    await removeUploadedFile(upload.path);
    return { id: null, error: errorMessage(error) };
  }
}

export async function getAssetDocumentUrl(bucket: string, path: string) {
  try {
    const supabase = createSupabaseBrowserClient();
    const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, 300);
    return { url: data?.signedUrl ?? null, error: error?.message ?? null };
  } catch (error) {
    return { url: null, error: errorMessage(error) };
  }
}

export async function reviewAssetInspection(
  reviewId: string,
  decision: "diterapkan" | "ditolak",
  note: string,
) {
  try {
    const supabase = createSupabaseBrowserClient();
    const { data, error } = await supabase.rpc("review_asset_inspection", {
      target_review_id: reviewId,
      decision,
      reviewer_note: note,
    });
    return { id: typeof data === "string" ? data : null, error: error?.message ?? null };
  } catch (error) {
    return { id: null, error: errorMessage(error) };
  }
}
