"use client";

import { getCurrentUserProfile } from "@/lib/auth";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import type { ChecklistAnswer, RiskLevel, UserRole } from "@/types";

const EVIDENCE_BUCKET = "checklist-evidence";
const MAX_EVIDENCE_BYTES = 5 * 1024 * 1024;
const ALLOWED_EVIDENCE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

export type ControlHierarchy =
  | "eliminasi"
  | "substitusi"
  | "rekayasa_teknik"
  | "administratif"
  | "apd";

export type CorrectiveActionStatus =
  | "terbuka"
  | "dalam_pengerjaan"
  | "menunggu_verifikasi"
  | "selesai"
  | "dibatalkan";

export interface ChecklistResultItemDetail {
  id: string;
  itemId: string | null;
  label: string;
  isCritical: boolean;
  answer: ChecklistAnswer;
  note: string;
  measurementValue: number | null;
  measurementUnit: string | null;
  evidenceFileName: string | null;
  evidenceUrl: string | null;
}

export interface CorrectiveAction {
  id: string;
  resultItemId: string | null;
  description: string;
  controlHierarchy: ControlHierarchy;
  assignedTo: string | null;
  assigneeName: string | null;
  dueAt: string;
  status: CorrectiveActionStatus;
  completionNote: string;
  completedAt: string | null;
  verifiedAt: string | null;
  createdAt: string;
}

export interface ChecklistResultDetail {
  id: string;
  laboratoryId: string;
  completedAt: string;
  startedAt: string | null;
  templateTitle: string;
  templateVersion: number | null;
  inspectorAttestation: boolean;
  overallNote: string;
  hasRiskFinding: boolean;
  severity: number | null;
  probability: number | null;
  exposure: number | null;
  riskScore: number | null;
  riskCategory: RiskLevel | null;
  recommendation: string | null;
  asset: { id: string; code: string; name: string; location: string | null; status: string } | null;
  inspector: { id: string; fullName: string; role: UserRole } | null;
  items: ChecklistResultItemDetail[];
  actions: CorrectiveAction[];
  inspectionReview: {
    id: string;
    recommendedStatus: string;
    reviewStatus: string;
    reviewNote: string | null;
  } | null;
  canManageActions: boolean;
  canUploadEvidence: boolean;
}

export interface ChecklistAssignee {
  id: string;
  fullName: string;
  role: UserRole;
}

interface SaveActionInput {
  id?: string | null;
  resultId: string;
  resultItemId?: string | null;
  description: string;
  controlHierarchy: ControlHierarchy;
  assignedTo?: string | null;
  dueAt: string;
  status: CorrectiveActionStatus;
  completionNote?: string;
}

function relationOne<T>(value: T | T[] | null): T | null {
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

function safeFileName(name: string): string {
  const cleaned = name.replace(/[^a-zA-Z0-9._-]/g, "-").replace(/-+/g, "-");
  return cleaned.slice(-100) || "bukti.jpg";
}

export async function uploadChecklistEvidence(
  resultId: string,
  itemId: string,
  file: File,
  measurementValue: number | null = null,
): Promise<{ error: string | null }> {
  if (!ALLOWED_EVIDENCE_TYPES.has(file.type)) {
    return { error: "Bukti harus berupa JPG, PNG, atau WebP." };
  }
  if (file.size < 1 || file.size > MAX_EVIDENCE_BYTES) {
    return { error: "Ukuran bukti maksimal 5 MB." };
  }

  const { user, error: userError } = await getCurrentUserProfile();
  if (!user) return { error: userError ?? "Sesi pengguna tidak tersedia." };

  const supabase = createSupabaseBrowserClient();
  const path = `${resultId}/${user.id}/${crypto.randomUUID()}-${safeFileName(file.name)}`;
  const { error: uploadError } = await supabase.storage
    .from(EVIDENCE_BUCKET)
    .upload(path, file, { contentType: file.type, upsert: false });

  if (uploadError) {
    return { error: "Bukti belum berhasil diunggah. Silakan coba kembali." };
  }

  const { error: metadataError } = await supabase.rpc("attach_checklist_item_evidence", {
    target_result_id: resultId,
    target_item_id: itemId,
    file_bucket: EVIDENCE_BUCKET,
    file_path: path,
    file_name: file.name,
    file_mime_type: file.type,
    file_size_bytes: file.size,
    measured_value: measurementValue,
  });

  if (metadataError) {
    await supabase.storage.from(EVIDENCE_BUCKET).remove([path]);
    return { error: "Metadata bukti gagal disimpan." };
  }

  return { error: null };
}

export async function fetchChecklistResultDetail(
  resultId: string,
): Promise<{ detail: ChecklistResultDetail | null; error: string | null }> {
  try {
    const supabase = createSupabaseBrowserClient();
    const [resultResponse, itemsResponse, actionsResponse, reviewResponse, profileResponse] =
      await Promise.all([
        supabase
          .from("checklist_results")
          .select(`
            id,laboratory_id,completed_at,started_at,template_title_snapshot,
            template_version_snapshot,inspector_attestation,overall_note,
            has_risk_finding,severity,probability,exposure,risk_score,risk_category,recommendation,
            template:checklist_templates(id,title,version),
            asset:assets(id,code,name,location,status),
            inspector:user_profiles!checklist_results_inspector_id_fkey(id,full_name,role)
          `)
          .eq("id", resultId)
          .maybeSingle(),
        supabase
          .from("checklist_result_items")
          .select(`
            id,item_id,answer,note,item_label_snapshot,is_critical_snapshot,
            measurement_value,evidence_bucket,evidence_path,evidence_file_name,
            item:checklist_items(id,label,is_critical,measurement_unit,sort_order)
          `)
          .eq("result_id", resultId),
        supabase
          .from("checklist_corrective_actions")
          .select(`
            id,result_item_id,description,control_hierarchy,assigned_to,due_at,status,
            completion_note,completed_at,verified_at,created_at,
            assignee:user_profiles!checklist_corrective_actions_assigned_to_fkey(id,full_name)
          `)
          .eq("result_id", resultId)
          .order("created_at", { ascending: false }),
        supabase
          .from("asset_inspection_reviews")
          .select("id,recommended_status,review_status,review_note")
          .eq("checklist_result_id", resultId)
          .maybeSingle(),
        getCurrentUserProfile(),
      ]);

    if (resultResponse.error || !resultResponse.data) {
      return { detail: null, error: "Hasil checklist tidak ditemukan atau tidak dapat diakses." };
    }
    if (itemsResponse.error) {
      return { detail: null, error: "Item hasil checklist tidak dapat dimuat." };
    }

    const row = resultResponse.data as Record<string, unknown>;
    const asset = relationOne(row.asset as never);
    const template = relationOne(row.template as never);
    const inspector = relationOne(row.inspector as never);
    const templateRecord = template as Record<string, unknown> | null;
    const currentUser = profileResponse.user;
    const canManageActions = Boolean(
      currentUser &&
        (currentUser.role === "admin" ||
          (["teknisi", "kepala_lab"].includes(currentUser.role) &&
            currentUser.laboratoryId === row.laboratory_id)),
    );

    const itemRows = (itemsResponse.data ?? []) as Array<Record<string, unknown>>;
    const items = await Promise.all(
      itemRows.map(async (itemRow) => {
        const currentItem = relationOne(itemRow.item as never) as Record<string, unknown> | null;
        let evidenceUrl: string | null = null;
        if (itemRow.evidence_bucket && itemRow.evidence_path) {
          const { data } = await supabase.storage
            .from(String(itemRow.evidence_bucket))
            .createSignedUrl(String(itemRow.evidence_path), 600);
          evidenceUrl = data?.signedUrl ?? null;
        }
        return {
          id: String(itemRow.id),
          itemId: itemRow.item_id ? String(itemRow.item_id) : null,
          label: String(itemRow.item_label_snapshot ?? currentItem?.label ?? "Item checklist"),
          isCritical: Boolean(itemRow.is_critical_snapshot ?? currentItem?.is_critical),
          answer: itemRow.answer as ChecklistAnswer,
          note: String(itemRow.note ?? ""),
          measurementValue:
            typeof itemRow.measurement_value === "number" ? itemRow.measurement_value : null,
          measurementUnit: currentItem?.measurement_unit
            ? String(currentItem.measurement_unit)
            : null,
          evidenceFileName: itemRow.evidence_file_name
            ? String(itemRow.evidence_file_name)
            : null,
          evidenceUrl,
        } satisfies ChecklistResultItemDetail;
      }),
    );

    const actionRows = actionsResponse.error
      ? []
      : ((actionsResponse.data ?? []) as Array<Record<string, unknown>>);

    return {
      detail: {
        id: String(row.id),
        laboratoryId: String(row.laboratory_id),
        completedAt: String(row.completed_at),
        startedAt: row.started_at ? String(row.started_at) : null,
        templateTitle: String(
          row.template_title_snapshot ??
            templateRecord?.title ??
            "Template checklist",
        ),
        templateVersion:
          typeof row.template_version_snapshot === "number"
            ? row.template_version_snapshot
            : typeof templateRecord?.version === "number"
              ? Number(templateRecord.version)
              : null,
        inspectorAttestation: Boolean(row.inspector_attestation),
        overallNote: String(row.overall_note ?? ""),
        hasRiskFinding: Boolean(row.has_risk_finding),
        severity: typeof row.severity === "number" ? row.severity : null,
        probability: typeof row.probability === "number" ? row.probability : null,
        exposure: typeof row.exposure === "number" ? row.exposure : null,
        riskScore: typeof row.risk_score === "number" ? row.risk_score : null,
        riskCategory: (row.risk_category as RiskLevel | null) ?? null,
        recommendation: row.recommendation ? String(row.recommendation) : null,
        asset: asset
          ? {
              id: String((asset as Record<string, unknown>).id),
              code: String((asset as Record<string, unknown>).code),
              name: String((asset as Record<string, unknown>).name),
              location: (asset as Record<string, unknown>).location
                ? String((asset as Record<string, unknown>).location)
                : null,
              status: String((asset as Record<string, unknown>).status),
            }
          : null,
        inspector: inspector
          ? {
              id: String((inspector as Record<string, unknown>).id),
              fullName: String((inspector as Record<string, unknown>).full_name),
              role: (inspector as Record<string, unknown>).role as UserRole,
            }
          : null,
        items,
        actions: actionRows.map((actionRow) => {
          const assignee = relationOne(actionRow.assignee as never) as Record<string, unknown> | null;
          return {
            id: String(actionRow.id),
            resultItemId: actionRow.result_item_id ? String(actionRow.result_item_id) : null,
            description: String(actionRow.description),
            controlHierarchy: actionRow.control_hierarchy as ControlHierarchy,
            assignedTo: actionRow.assigned_to ? String(actionRow.assigned_to) : null,
            assigneeName: assignee?.full_name ? String(assignee.full_name) : null,
            dueAt: String(actionRow.due_at),
            status: actionRow.status as CorrectiveActionStatus,
            completionNote: String(actionRow.completion_note ?? ""),
            completedAt: actionRow.completed_at ? String(actionRow.completed_at) : null,
            verifiedAt: actionRow.verified_at ? String(actionRow.verified_at) : null,
            createdAt: String(actionRow.created_at),
          };
        }),
        inspectionReview: reviewResponse.data
          ? {
              id: String(reviewResponse.data.id),
              recommendedStatus: String(reviewResponse.data.recommended_status),
              reviewStatus: String(reviewResponse.data.review_status),
              reviewNote: reviewResponse.data.review_note,
            }
          : null,
        canManageActions,
        canUploadEvidence: Boolean(currentUser && inspector && currentUser.id === (inspector as Record<string, unknown>).id),
      },
      error: actionsResponse.error
        ? "Detail tampil, tetapi tindakan korektif belum dapat dimuat."
        : null,
    };
  } catch {
    return { detail: null, error: "Detail checklist belum dapat dimuat. Silakan coba kembali." };
  }
}

export async function fetchChecklistAssignees(
  resultId: string,
): Promise<ChecklistAssignee[]> {
  const supabase = createSupabaseBrowserClient();
  const { data } = await supabase.rpc("get_checklist_action_assignees", {
    target_result_id: resultId,
  });
  return ((data ?? []) as Array<{ id: string; full_name: string; role: UserRole }>).map(
    (row) => ({ id: row.id, fullName: row.full_name, role: row.role }),
  );
}

export async function saveChecklistCorrectiveAction(
  input: SaveActionInput,
): Promise<{ id: string | null; error: string | null }> {
  const supabase = createSupabaseBrowserClient();
  const { data, error } = await supabase.rpc("save_checklist_corrective_action", {
    target_action_id: input.id ?? null,
    target_result_id: input.resultId,
    target_result_item_id: input.resultItemId ?? null,
    action_description: input.description,
    action_control_hierarchy: input.controlHierarchy,
    action_assigned_to: input.assignedTo ?? null,
    action_due_at: input.dueAt,
    action_status: input.status,
    action_completion_note: input.completionNote ?? "",
  });
  return {
    id: typeof data === "string" ? data : null,
    error: error ? "Tindakan korektif gagal disimpan." : null,
  };
}
