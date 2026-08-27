"use client";

import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export type DatabaseAssetKind = "alat" | "fasilitas";
export type DatabaseAssetStatus = "layak" | "perlu_dicek" | "tidak_layak";
export type AssetOperationalState =
  | "aktif"
  | "penggunaan_dibatasi"
  | "dalam_perbaikan"
  | "dikarantina"
  | "dipensiunkan";

export interface LaboratorySummary {
  id: string;
  code: string;
  name: string;
  department: string | null;
  location: string | null;
}

export interface SopSummary {
  id: string;
  laboratoryId: string | null;
  title: string;
  version: string | null;
  lastUpdatedAt: string | null;
  requiredPpe: string[];
  steps: string[];
}

export interface DatabaseAsset {
  id: string;
  laboratoryId: string | null;
  sopId: string | null;
  code: string;
  name: string;
  kind: DatabaseAssetKind;
  category: string | null;
  location: string | null;
  description: string | null;
  status: DatabaseAssetStatus;
  qrPayload: string | null;
  lastInspectionAt: string | null;
  nextInspectionAt: string | null;
  manufacturer: string | null;
  model: string | null;
  serialNumber: string | null;
  manufactureYear: number | null;
  acquiredAt: string | null;
  technicalSpecs: Record<string, string>;
  energySources: string[];
  requiredCompetency: string | null;
  regulatoryReference: string | null;
  inspectionIntervalDays: number;
  operationalState: AssetOperationalState;
  isolationReason: string | null;
  isolatedAt: string | null;
  laboratory: LaboratorySummary | null;
  sop: SopSummary | null;
}

export interface AssetPicCandidate {
  id: string;
  fullName: string;
  role: "dosen" | "teknisi" | "kepala_lab";
}

export interface AssetContactSummary {
  picUserId: string | null;
  picName: string | null;
  picRole: "dosen" | "teknisi" | "kepala_lab" | null;
  emergencyContactName: string | null;
  emergencyContactPhone: string | null;
}

export type AssetActivityType =
  | "aset_dibuat"
  | "aset_diperbarui"
  | "sop_diperbarui"
  | "servis"
  | "perbaikan"
  | "catatan"
  | "status_operasional"
  | "sertifikat"
  | "work_order"
  | "kontrol_keselamatan"
  | "dokumen"
  | "review_inspeksi"
  | "laporan"
  | "checklist";

export interface AssetActivity {
  id: string;
  type: AssetActivityType;
  title: string;
  note: string;
  occurredAt: string;
  href: string | null;
}

export interface SaveAssetInput {
  assetId: string | null;
  laboratoryId: string;
  code: string;
  name: string;
  kind: DatabaseAssetKind;
  category: string;
  location: string;
  description: string;
  status: DatabaseAssetStatus;
  picUserId: string | null;
  nextInspectionAt: string | null;
  updateSop: boolean;
  sopTitle: string;
  sopVersion: string;
  sopRequiredPpe: string[];
  sopSteps: string[];
  updateLaboratoryContact: boolean;
  emergencyContactName: string;
  emergencyContactPhone: string;
}

export interface AddAssetActivityInput {
  assetId: string;
  type: "servis" | "perbaikan" | "catatan";
  title: string;
  note: string;
  occurredAt: string;
}

interface LaboratoryRow {
  id: string;
  code: string;
  name: string;
  department: string | null;
  location: string | null;
}

interface SopRow {
  id: string;
  laboratory_id: string | null;
  title: string;
  version: string | null;
  last_updated_at: string | null;
  required_ppe: unknown;
  steps: unknown;
}

interface AssetRow {
  id: string;
  laboratory_id: string | null;
  sop_id: string | null;
  code: string;
  name: string;
  kind: DatabaseAssetKind;
  category: string | null;
  location: string | null;
  description: string | null;
  status: DatabaseAssetStatus;
  qr_payload: string | null;
  last_inspection_at: string | null;
  next_inspection_at: string | null;
  manufacturer: string | null;
  model: string | null;
  serial_number: string | null;
  manufacture_year: number | null;
  acquired_at: string | null;
  technical_specs: unknown;
  energy_sources: unknown;
  required_competency: string | null;
  regulatory_reference: string | null;
  inspection_interval_days: number;
  operational_state: AssetOperationalState;
  isolation_reason: string | null;
  isolated_at: string | null;
  laboratory: LaboratoryRow | LaboratoryRow[] | null;
  sop: SopRow | SopRow[] | null;
}

interface AssetContactRow {
  pic_user_id: string | null;
  pic_name: string | null;
  pic_role: AssetContactSummary["picRole"];
  emergency_contact_name: string | null;
  emergency_contact_phone: string | null;
}

interface AssetActivityLogRow {
  id: string;
  activity_type: Exclude<AssetActivityType, "laporan" | "checklist">;
  title: string;
  note: string | null;
  occurred_at: string;
}

interface AssetReportActivityRow {
  id: string;
  title: string;
  description: string;
  status: string;
  reported_at: string | null;
  created_at: string;
}

interface AssetChecklistActivityRow {
  id: string;
  completed_at: string | null;
  created_at: string;
  has_risk_finding: boolean;
  risk_score: number | null;
  risk_category: string | null;
  overall_note: string | null;
}

const ASSET_SELECT = `
  id,
  laboratory_id,
  sop_id,
  code,
  name,
  kind,
  category,
  location,
  description,
  status,
  qr_payload,
  last_inspection_at,
  next_inspection_at,
  manufacturer,
  model,
  serial_number,
  manufacture_year,
  acquired_at,
  technical_specs,
  energy_sources,
  required_competency,
  regulatory_reference,
  inspection_interval_days,
  operational_state,
  isolation_reason,
  isolated_at,
  laboratory:laboratories(id,code,name,department,location),
  sop:sops(id,laboratory_id,title,version,last_updated_at,required_ppe,steps)
`;

function firstRelation<T>(value: T | T[] | null): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value;
}

function stringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string");
}

function stringRecord(value: unknown): Record<string, string> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return Object.fromEntries(
    Object.entries(value).filter(
      (entry): entry is [string, string] => typeof entry[1] === "string",
    ),
  );
}

function mapAsset(row: AssetRow): DatabaseAsset {
  const laboratory = firstRelation(row.laboratory);
  const sop = firstRelation(row.sop);

  return {
    id: row.id,
    laboratoryId: row.laboratory_id,
    sopId: row.sop_id,
    code: row.code,
    name: row.name,
    kind: row.kind,
    category: row.category,
    location: row.location,
    description: row.description,
    status: row.status,
    qrPayload: row.qr_payload,
    lastInspectionAt: row.last_inspection_at,
    nextInspectionAt: row.next_inspection_at,
    manufacturer: row.manufacturer,
    model: row.model,
    serialNumber: row.serial_number,
    manufactureYear: row.manufacture_year,
    acquiredAt: row.acquired_at,
    technicalSpecs: stringRecord(row.technical_specs),
    energySources: stringArray(row.energy_sources),
    requiredCompetency: row.required_competency,
    regulatoryReference: row.regulatory_reference,
    inspectionIntervalDays: row.inspection_interval_days,
    operationalState: row.operational_state,
    isolationReason: row.isolation_reason,
    isolatedAt: row.isolated_at,
    laboratory: laboratory
      ? {
          id: laboratory.id,
          code: laboratory.code,
          name: laboratory.name,
          department: laboratory.department,
          location: laboratory.location,
        }
      : null,
    sop: sop
      ? {
          id: sop.id,
          laboratoryId: sop.laboratory_id,
          title: sop.title,
          version: sop.version,
          lastUpdatedAt: sop.last_updated_at,
          requiredPpe: stringArray(sop.required_ppe),
          steps: stringArray(sop.steps),
        }
      : null,
  };
}

function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return "Data aset belum dapat dimuat. Silakan coba kembali.";
}

export function getAssetQrPayload(asset: DatabaseAsset): string {
  return `/scan?asset=${encodeURIComponent(asset.id)}`;
}

export async function fetchAssets(): Promise<{
  assets: DatabaseAsset[];
  error: string | null;
}> {
  try {
    const supabase = createSupabaseBrowserClient();
    const { data, error } = await supabase
      .from("assets")
      .select(ASSET_SELECT)
      .order("code", { ascending: true });

    if (error) return { assets: [], error: error.message };

    return {
      assets: ((data ?? []) as unknown as AssetRow[]).map(mapAsset),
      error: null,
    };
  } catch (error) {
    return { assets: [], error: errorMessage(error) };
  }
}

export async function fetchLaboratories(): Promise<{
  laboratories: LaboratorySummary[];
  error: string | null;
}> {
  try {
    const supabase = createSupabaseBrowserClient();
    const { data, error } = await supabase
      .from("laboratories")
      .select("id,code,name,department,location")
      .order("name", { ascending: true });

    if (error) return { laboratories: [], error: error.message };
    return {
      laboratories: (data ?? []) as LaboratorySummary[],
      error: null,
    };
  } catch (error) {
    return { laboratories: [], error: errorMessage(error) };
  }
}

export async function fetchAssetPicCandidates(
  laboratoryId: string,
): Promise<{ candidates: AssetPicCandidate[]; error: string | null }> {
  if (!laboratoryId) return { candidates: [], error: null };

  try {
    const supabase = createSupabaseBrowserClient();
    const { data, error } = await supabase.rpc("list_asset_pic_candidates", {
      target_laboratory_id: laboratoryId,
    });

    if (error) return { candidates: [], error: error.message };

    return {
      candidates: ((data ?? []) as Array<{
        id: string;
        full_name: string;
        role: AssetPicCandidate["role"];
      }>).map((candidate) => ({
        id: candidate.id,
        fullName: candidate.full_name,
        role: candidate.role,
      })),
      error: null,
    };
  } catch (error) {
    return { candidates: [], error: errorMessage(error) };
  }
}

export async function fetchAssetContact(
  assetId: string,
): Promise<{ contact: AssetContactSummary | null; error: string | null }> {
  try {
    const supabase = createSupabaseBrowserClient();
    const { data, error } = await supabase.rpc("get_asset_contact", {
      target_asset_id: assetId,
    });

    if (error) return { contact: null, error: error.message };
    const row = (Array.isArray(data) ? data[0] : data) as AssetContactRow | null;
    if (!row) return { contact: null, error: null };

    return {
      contact: {
        picUserId: row.pic_user_id,
        picName: row.pic_name,
        picRole: row.pic_role,
        emergencyContactName: row.emergency_contact_name,
        emergencyContactPhone: row.emergency_contact_phone,
      },
      error: null,
    };
  } catch (error) {
    return { contact: null, error: errorMessage(error) };
  }
}

export async function saveAssetRecord(
  input: SaveAssetInput,
): Promise<{ assetId: string | null; error: string | null }> {
  try {
    const supabase = createSupabaseBrowserClient();
    const { data, error } = await supabase.rpc("save_asset_record", {
      target_asset_id: input.assetId,
      target_laboratory_id: input.laboratoryId,
      asset_code: input.code,
      asset_name: input.name,
      asset_kind: input.kind,
      asset_category: input.category,
      asset_location: input.location,
      asset_description: input.description,
      asset_status: input.status,
      asset_pic_user_id: input.picUserId,
      asset_next_inspection_at: input.nextInspectionAt,
      update_sop: input.updateSop,
      sop_title: input.sopTitle,
      sop_version: input.sopVersion,
      sop_required_ppe: input.sopRequiredPpe,
      sop_steps: input.sopSteps,
      update_laboratory_contact: input.updateLaboratoryContact,
      laboratory_emergency_contact_name: input.emergencyContactName,
      laboratory_emergency_contact_phone: input.emergencyContactPhone,
    });

    if (error) return { assetId: null, error: error.message };
    return {
      assetId: typeof data === "string" ? data : null,
      error: typeof data === "string" ? null : "Data aset yang diterima tidak valid.",
    };
  } catch (error) {
    return { assetId: null, error: errorMessage(error) };
  }
}

export async function fetchAssetActivities(
  assetId: string,
): Promise<{ activities: AssetActivity[]; error: string | null }> {
  try {
    const supabase = createSupabaseBrowserClient();
    const [logResult, reportResult, checklistResult] = await Promise.all([
      supabase
        .from("asset_activity_logs")
        .select("id,activity_type,title,note,occurred_at")
        .eq("asset_id", assetId),
      supabase
        .from("reports")
        .select("id,title,description,status,reported_at,created_at")
        .eq("asset_id", assetId),
      supabase
        .from("checklist_results")
        .select(
          "id,completed_at,created_at,has_risk_finding,risk_score,risk_category,overall_note",
        )
        .eq("asset_id", assetId),
    ]);

    const errors = [logResult.error, reportResult.error, checklistResult.error]
      .filter(Boolean)
      .map((error) => error?.message)
      .filter((message): message is string => Boolean(message));

    const logs = ((logResult.data ?? []) as AssetActivityLogRow[]).map(
      (row): AssetActivity => ({
        id: `log-${row.id}`,
        type: row.activity_type,
        title: row.title,
        note: row.note ?? "",
        occurredAt: row.occurred_at,
        href: null,
      }),
    );

    const reports = ((reportResult.data ?? []) as AssetReportActivityRow[]).map(
      (row): AssetActivity => ({
        id: `report-${row.id}`,
        type: "laporan",
        title: `Laporan: ${row.title}`,
        note: `${row.description} · Status ${row.status.replaceAll("_", " ")}`,
        occurredAt: row.reported_at ?? row.created_at,
        href: `/reports/${row.id}`,
      }),
    );

    const checklists = (
      (checklistResult.data ?? []) as AssetChecklistActivityRow[]
    ).map(
      (row): AssetActivity => ({
        id: `checklist-${row.id}`,
        type: "checklist",
        title: row.has_risk_finding
          ? `Inspeksi K3 dengan temuan ${row.risk_category ?? "risiko"}`
          : "Inspeksi K3 tanpa temuan",
        note:
          row.overall_note ||
          (row.risk_score !== null ? `Skor risiko ${row.risk_score}` : ""),
        occurredAt: row.completed_at ?? row.created_at,
        href: null,
      }),
    );

    return {
      activities: [...logs, ...reports, ...checklists].sort(
        (a, b) =>
          new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime(),
      ),
      error: errors.length > 0 ? errors.join("; ") : null,
    };
  } catch (error) {
    return { activities: [], error: errorMessage(error) };
  }
}

export async function addAssetActivity(
  input: AddAssetActivityInput,
): Promise<{ activityId: string | null; error: string | null }> {
  try {
    const supabase = createSupabaseBrowserClient();
    const { data, error } = await supabase.rpc("add_asset_activity_log", {
      target_asset_id: input.assetId,
      activity_kind: input.type,
      activity_title: input.title,
      activity_note: input.note,
      activity_occurred_at: input.occurredAt,
    });

    if (error) return { activityId: null, error: error.message };
    return {
      activityId: typeof data === "string" ? data : null,
      error: typeof data === "string" ? null : "ID aktivitas tidak valid.",
    };
  } catch (error) {
    return { activityId: null, error: errorMessage(error) };
  }
}

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function normalizeLookup(value: string): {
  lookup: string;
  error: string | null;
} {
  let decoded = value;
  try {
    decoded = decodeURIComponent(value);
  } catch {
    // Keep the original value so a malformed URL becomes a normal not-found result.
  }

  const trimmed = decoded.trim();
  const qrMatch = trimmed.match(/^vocasafe:\/\/assets\/([^/?#]+)\/?$/i);
  if (qrMatch?.[1]) return { lookup: qrMatch[1], error: null };

  if (/^https?:\/\//i.test(trimmed)) {
    try {
      const url = new URL(trimmed);
      if (typeof window !== "undefined" && url.origin !== window.location.origin) {
        return {
          lookup: "",
          error: "QR bukan berasal dari domain resmi VocaSafe Lab.",
        };
      }

      const queryAsset = url.pathname === "/scan" ? url.searchParams.get("asset") : null;
      const assetPath = url.pathname.match(/^\/assets\/([^/?#]+)\/?$/i)?.[1] ?? null;
      const scanPath = url.pathname.match(/^\/scan\/([^/?#]+)\/?$/i)?.[1] ?? null;
      const identifier = queryAsset || assetPath || scanPath;

      if (!identifier) {
        return { lookup: "", error: "Format URL QR VocaSafe Lab tidak valid." };
      }

      return { lookup: decodeURIComponent(identifier), error: null };
    } catch {
      return { lookup: "", error: "Format URL QR tidak valid." };
    }
  }

  return { lookup: trimmed, error: null };
}

async function queryAsset(
  column: "code" | "id" | "qr_payload",
  value: string,
): Promise<{ asset: DatabaseAsset | null; error: string | null }> {
  const supabase = createSupabaseBrowserClient();
  const { data, error } = await supabase
    .from("assets")
    .select(ASSET_SELECT)
    .eq(column, value)
    .maybeSingle();

  if (error) return { asset: null, error: error.message };
  if (!data) return { asset: null, error: null };

  return { asset: mapAsset(data as unknown as AssetRow), error: null };
}

export async function fetchAssetByLookup(value: string): Promise<{
  asset: DatabaseAsset | null;
  error: string | null;
}> {
  try {
    const original = value.trim();
    const normalized = normalizeLookup(original);
    if (normalized.error) {
      return { asset: null, error: normalized.error };
    }

    const byCode = await queryAsset("code", normalized.lookup);
    if (byCode.asset || byCode.error) return byCode;

    if (UUID_PATTERN.test(normalized.lookup)) {
      const byId = await queryAsset("id", normalized.lookup);
      if (byId.asset || byId.error) return byId;
    }

    return await queryAsset("qr_payload", original);
  } catch (error) {
    return { asset: null, error: errorMessage(error) };
  }
}
