"use client";

import { calculateRiskScore } from "@/lib/risk-scoring";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import type {
  AssetKind,
  ChecklistAnswer,
  RiskLevel,
  RiskScoringInput,
  UserRole,
} from "@/types";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const VALID_ANSWERS = new Set<ChecklistAnswer>([
  "ya",
  "tidak",
  "tidak_berlaku",
]);

interface ChecklistTemplateRow {
  id: string;
  laboratory_id: string | null;
  title: string;
  asset_kind: AssetKind | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

interface ChecklistItemRow {
  id: string;
  template_id: string;
  label: string;
  is_critical: boolean;
  guidance: string | null;
  sort_order: number;
  created_at: string;
}

interface ChecklistTemplateSummaryRow {
  id: string;
  title: string;
}

interface ChecklistAssetRow {
  id: string;
  code: string;
  name: string;
  location: string | null;
}

interface ChecklistInspectorRow {
  id: string;
  full_name: string;
  role: UserRole;
}

interface ChecklistResultRow {
  id: string;
  template_id: string | null;
  asset_id: string | null;
  laboratory_id: string | null;
  inspector_id: string | null;
  completed_at: string | null;
  overall_note: string | null;
  has_risk_finding: boolean;
  severity: number | null;
  probability: number | null;
  exposure: number | null;
  risk_score: number | null;
  risk_category: RiskLevel | null;
  recommendation: string | null;
  created_at: string;
  updated_at: string;
  template: ChecklistTemplateSummaryRow | ChecklistTemplateSummaryRow[] | null;
  asset: ChecklistAssetRow | ChecklistAssetRow[] | null;
  inspector: ChecklistInspectorRow | ChecklistInspectorRow[] | null;
}

interface ProfileRoleRow {
  role: UserRole;
  is_active: boolean;
}

export interface DatabaseChecklistItem {
  id: string;
  templateId: string;
  label: string;
  isCritical: boolean;
  guidance: string | null;
  sortOrder: number;
  createdAt: string;
}

export interface DatabaseChecklistTemplate {
  id: string;
  laboratoryId: string | null;
  title: string;
  assetKind: AssetKind | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  items: DatabaseChecklistItem[];
}

export interface DatabaseChecklistResult {
  id: string;
  templateId: string | null;
  assetId: string | null;
  laboratoryId: string | null;
  inspectorId: string | null;
  completedAt: string;
  overallNote: string;
  hasRiskFinding: boolean;
  severity: number | null;
  probability: number | null;
  exposure: number | null;
  riskScore: number | null;
  riskCategory: RiskLevel | null;
  recommendation: string | null;
  createdAt: string;
  updatedAt: string;
  template: { id: string; title: string } | null;
  asset: {
    id: string;
    code: string;
    name: string;
    location: string | null;
  } | null;
  inspector: {
    id: string;
    fullName: string;
    role: UserRole;
  } | null;
}

export interface ChecklistSubmissionAnswer {
  itemId: string;
  answer: ChecklistAnswer;
  note: string;
}

export interface CreateChecklistResultInput {
  templateId: string;
  assetId: string;
  laboratoryId: string | null;
  overallNote: string;
  hasRiskFinding: boolean;
  riskInput: RiskScoringInput;
  answers: ChecklistSubmissionAnswer[];
}

function firstRelation<T>(value: T | T[] | null): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value;
}

function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return "Data checklist tidak dapat diproses dari Supabase.";
}

function mapItem(row: ChecklistItemRow): DatabaseChecklistItem {
  return {
    id: row.id,
    templateId: row.template_id,
    label: row.label,
    isCritical: row.is_critical,
    guidance: row.guidance,
    sortOrder: row.sort_order,
    createdAt: row.created_at,
  };
}

function mapResult(row: ChecklistResultRow): DatabaseChecklistResult {
  const template = firstRelation(row.template);
  const asset = firstRelation(row.asset);
  const inspector = firstRelation(row.inspector);

  return {
    id: row.id,
    templateId: row.template_id,
    assetId: row.asset_id,
    laboratoryId: row.laboratory_id,
    inspectorId: row.inspector_id,
    completedAt: row.completed_at ?? row.created_at,
    overallNote: row.overall_note ?? "",
    hasRiskFinding: row.has_risk_finding,
    severity: row.severity,
    probability: row.probability,
    exposure: row.exposure,
    riskScore: row.risk_score,
    riskCategory: row.risk_category,
    recommendation: row.recommendation,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    template: template ? { id: template.id, title: template.title } : null,
    asset: asset
      ? {
          id: asset.id,
          code: asset.code,
          name: asset.name,
          location: asset.location,
        }
      : null,
    inspector: inspector
      ? {
          id: inspector.id,
          fullName: inspector.full_name,
          role: inspector.role,
        }
      : null,
  };
}

export async function fetchActiveChecklistTemplates(): Promise<{
  templates: DatabaseChecklistTemplate[];
  error: string | null;
}> {
  try {
    const supabase = createSupabaseBrowserClient();
    const { data: templateData, error: templateError } = await supabase
      .from("checklist_templates")
      .select(
        "id,laboratory_id,title,asset_kind,is_active,created_at,updated_at",
      )
      .eq("is_active", true)
      .order("created_at", { ascending: true });

    if (templateError) return { templates: [], error: templateError.message };

    const templateRows = (templateData ?? []) as ChecklistTemplateRow[];
    if (templateRows.length === 0) return { templates: [], error: null };

    const { data: itemData, error: itemError } = await supabase
      .from("checklist_items")
      .select("id,template_id,label,is_critical,guidance,sort_order,created_at")
      .in(
        "template_id",
        templateRows.map((template) => template.id),
      )
      .order("sort_order", { ascending: true });

    if (itemError) return { templates: [], error: itemError.message };

    const items = ((itemData ?? []) as ChecklistItemRow[]).map(mapItem);
    return {
      templates: templateRows.map((template) => ({
        id: template.id,
        laboratoryId: template.laboratory_id,
        title: template.title,
        assetKind: template.asset_kind,
        isActive: template.is_active,
        createdAt: template.created_at,
        updatedAt: template.updated_at,
        items: items.filter((item) => item.templateId === template.id),
      })),
      error: null,
    };
  } catch (error) {
    return { templates: [], error: errorMessage(error) };
  }
}

export async function fetchChecklistResults(): Promise<{
  results: DatabaseChecklistResult[];
  error: string | null;
}> {
  try {
    const supabase = createSupabaseBrowserClient();
    const { data, error } = await supabase
      .from("checklist_results")
      .select(`
        id,
        template_id,
        asset_id,
        laboratory_id,
        inspector_id,
        completed_at,
        overall_note,
        has_risk_finding,
        severity,
        probability,
        exposure,
        risk_score,
        risk_category,
        recommendation,
        created_at,
        updated_at,
        template:checklist_templates(id,title),
        asset:assets(id,code,name,location),
        inspector:user_profiles(id,full_name,role)
      `)
      .order("completed_at", { ascending: false });

    if (error) return { results: [], error: error.message };

    return {
      results: ((data ?? []) as unknown as ChecklistResultRow[]).map(mapResult),
      error: null,
    };
  } catch (error) {
    return { results: [], error: errorMessage(error) };
  }
}

export async function createChecklistResult(
  input: CreateChecklistResultInput,
): Promise<{
  resultId: string | null;
  resultSaved: boolean;
  error: string | null;
}> {
  if (!input.templateId) {
    return {
      resultId: null,
      resultSaved: false,
      error: "Template checklist aktif tidak ditemukan.",
    };
  }

  if (!UUID_PATTERN.test(input.templateId)) {
    return {
      resultId: null,
      resultSaved: false,
      error: "ID template checklist tidak valid.",
    };
  }

  if (!input.assetId) {
    return {
      resultId: null,
      resultSaved: false,
      error: "Pilih aset terlebih dahulu.",
    };
  }

  if (!UUID_PATTERN.test(input.assetId)) {
    return {
      resultId: null,
      resultSaved: false,
      error: "ID aset tidak valid. Pilih ulang aset dari daftar.",
    };
  }

  if (input.answers.length === 0) {
    return {
      resultId: null,
      resultSaved: false,
      error: "Item checklist belum tersedia.",
    };
  }

  if (input.answers.some((answer) => !UUID_PATTERN.test(answer.itemId))) {
    return { resultId: null, resultSaved: false, error: "Item checklist tidak valid." };
  }

  if (input.answers.some((answer) => !VALID_ANSWERS.has(answer.answer))) {
    return { resultId: null, resultSaved: false, error: "Jawaban checklist tidak valid." };
  }

  const negativeWithoutNote = input.answers.some(
    (answer) => answer.answer === "tidak" && !answer.note.trim(),
  );
  if (negativeWithoutNote) {
    return {
      resultId: null,
      resultSaved: false,
      error: "Catatan wajib diisi untuk setiap jawaban Tidak.",
    };
  }

  try {
    const supabase = createSupabaseBrowserClient();
    const { data: authData, error: authError } = await supabase.auth.getUser();

    if (authError || !authData.user) {
      return {
        resultId: null,
        resultSaved: false,
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
        resultId: null,
        resultSaved: false,
        error: profileError?.message ?? "Profil pengguna tidak ditemukan.",
      };
    }

    const profile = profileData as ProfileRoleRow;
    if (!profile.is_active || !["dosen", "teknisi", "admin"].includes(profile.role)) {
      return {
        resultId: null,
        resultSaved: false,
        error: "Role pengguna tidak diizinkan mengisi checklist.",
      };
    }

    const { data: itemData, error: itemError } = await supabase
      .from("checklist_items")
      .select("id")
      .eq("template_id", input.templateId);

    if (itemError) {
      return { resultId: null, resultSaved: false, error: itemError.message };
    }

    const expectedItemIds = new Set(
      ((itemData ?? []) as { id: string }[]).map((item) => item.id),
    );
    const submittedItemIds = new Set(input.answers.map((answer) => answer.itemId));
    if (
      expectedItemIds.size === 0 ||
      expectedItemIds.size !== submittedItemIds.size ||
      [...expectedItemIds].some((itemId) => !submittedItemIds.has(itemId))
    ) {
      return {
        resultId: null,
        resultSaved: false,
        error: "Seluruh item checklist aktif harus dijawab.",
      };
    }

    const hasNegativeAnswer = input.answers.some(
      (answer) => answer.answer === "tidak",
    );
    const hasRiskFinding = input.hasRiskFinding || hasNegativeAnswer;
    const risk = hasRiskFinding ? calculateRiskScore(input.riskInput) : null;
    const completedAt = new Date().toISOString();

    const { data: resultData, error: resultError } = await supabase.rpc(
      "submit_checklist_result_atomic",
      {
        target_template_id: input.templateId,
        target_asset_id: input.assetId,
        target_laboratory_id: input.laboratoryId,
        result_completed_at: completedAt,
        result_overall_note: input.overallNote.trim() || null,
        result_has_risk_finding: hasRiskFinding,
        result_severity: risk ? input.riskInput.severity : null,
        result_probability: risk ? input.riskInput.probability : null,
        result_exposure: risk ? input.riskInput.exposure : null,
        result_risk_score: risk?.score ?? null,
        result_risk_category: risk?.category ?? null,
        result_recommendation: risk?.recommendation ?? null,
        result_answers: input.answers.map((answer) => ({
          item_id: answer.itemId,
          answer: answer.answer,
          note: answer.note.trim() || null,
        })),
      },
    );

    if (resultError || !resultData) {
      return {
        resultId: null,
        resultSaved: false,
        error: resultError?.message ?? "Hasil checklist gagal disimpan.",
      };
    }

    const resultId = typeof resultData === "string" ? resultData : null;
    if (!resultId) {
      return { resultId: null, resultSaved: false, error: "ID hasil checklist tidak valid." };
    }

    return { resultId, resultSaved: true, error: null };
  } catch (error) {
    return { resultId: null, resultSaved: false, error: errorMessage(error) };
  }
}
