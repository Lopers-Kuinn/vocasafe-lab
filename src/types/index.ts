export type UserRole = "mahasiswa" | "dosen" | "teknisi" | "kepala_lab" | "admin";

export type AssetKind = "alat" | "fasilitas";

export type AssetStatus =
  | "aman"
  | "perlu_pemeriksaan"
  | "tidak_layak_pakai";

export type ReportStatus =
  | "baru"
  | "diverifikasi"
  | "dalam_penanganan"
  | "selesai"
  | "ditolak";

export type RiskLevel = "rendah" | "sedang" | "tinggi" | "kritis";

export type ReportType =
  | "kondisi_tidak_aman"
  | "near_miss"
  | "kecelakaan_cedera"
  | "kerusakan_aset"
  | "kebakaran_ledakan"
  | "tumpahan_bahan"
  | "keluhan_kesehatan";

export type HazardCategory =
  | "listrik"
  | "mekanik"
  | "kebakaran"
  | "bahan_kimia"
  | "ergonomi"
  | "fasilitas_k3"
  | "lingkungan"
  | "lainnya";

export type ChecklistAnswer = "ya" | "tidak" | "tidak_berlaku";

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
}

export interface AppUser {
  id: string;
  email: string;
  fullName: string;
  role: UserRole;
  laboratoryId?: string | null;
  isActive: boolean;
}

export interface StandardOperatingProcedure {
  id: string;
  title: string;
  version: string;
  lastUpdated: string;
  steps: string[];
  requiredPpe: string[];
}

export interface Asset {
  id: string;
  code: string;
  name: string;
  kind: AssetKind;
  category: string;
  location: string;
  description: string;
  status: AssetStatus;
  lastInspectionAt: string;
  nextInspectionAt: string;
  qrValue: string;
  sopId: string;
}

export interface ChecklistItem {
  id: string;
  label: string;
  isCritical: boolean;
  guidance?: string;
}

export interface ChecklistResponse {
  itemId: string;
  answer: ChecklistAnswer;
  note?: string;
}

export interface SafetyChecklist {
  id: string;
  title: string;
  assetKind: AssetKind;
  items: ChecklistItem[];
}

export interface EvidencePhoto {
  id: string;
  fileName: string;
  imageUrl: string;
  uploadedAt: string;
}

export interface ReportStatusHistory {
  status: ReportStatus;
  changedAt: string;
  changedByUserId: string;
  note?: string;
}

export interface RiskScoringInput {
  severity: number;
  probability: number;
  exposure: number;
}

export interface RiskScoringResult {
  score: number;
  category: RiskLevel;
  recommendation: string;
}

export interface HazardReport {
  id: string;
  reportNumber: string;
  assetId: string;
  reporterUserId: string;
  title: string;
  description: string;
  location: string;
  reportedAt: string;
  status: ReportStatus;
  riskInput: RiskScoringInput;
  riskResult: RiskScoringResult;
  evidencePhotos: EvidencePhoto[];
  statusHistory: ReportStatusHistory[];
}
