"use client";

import type { DatabaseAsset } from "@/lib/assets";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export type ScanSource = "camera" | "manual" | "qr_link";
export type ScanSafetyDecision =
  | "clear"
  | "restricted"
  | "blocked"
  | "unverified";

export interface AssetScanSafetySummary {
  decision: ScanSafetyDecision;
  reasons: string[];
  checkedAt: string | null;
  inspectionOverdue: boolean;
  inspectionMissing: boolean;
  expiredCertificates: number;
  certificatesDueSoon: number;
  openWorkOrders: number;
  failedControls: number;
  openCriticalReports: number;
  pendingReviews: number;
}

interface ScanSafetyRow {
  asset_id: string;
  checked_at: string;
  expired_certificate_count: number | string;
  certificate_due_soon_count: number | string;
  open_work_order_count: number | string;
  failed_control_count: number | string;
  open_critical_report_count: number | string;
  pending_review_count: number | string;
}

function count(value: number | string): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
}

function evaluateAssetSafety(
  asset: DatabaseAsset,
  row: ScanSafetyRow,
): AssetScanSafetySummary {
  const now = Date.now();
  const nextInspectionTime = asset.nextInspectionAt
    ? new Date(asset.nextInspectionAt).getTime()
    : Number.NaN;
  const inspectionMissing = !asset.nextInspectionAt;
  const inspectionOverdue =
    Number.isFinite(nextInspectionTime) && nextInspectionTime < now;
  const expiredCertificates = count(row.expired_certificate_count);
  const certificatesDueSoon = count(row.certificate_due_soon_count);
  const openWorkOrders = count(row.open_work_order_count);
  const failedControls = count(row.failed_control_count);
  const openCriticalReports = count(row.open_critical_report_count);
  const pendingReviews = count(row.pending_review_count);
  const blockingReasons: string[] = [];
  const restrictionReasons: string[] = [];

  if (asset.status === "tidak_layak") {
    blockingReasons.push("Status kelayakan aset tercatat Tidak Layak.");
  }
  if (
    ["dalam_perbaikan", "dikarantina", "dipensiunkan"].includes(
      asset.operationalState,
    )
  ) {
    blockingReasons.push(
      asset.isolationReason ||
        "Aset sedang diperbaiki, dikarantina, atau sudah dipensiunkan.",
    );
  }
  if (inspectionOverdue) {
    blockingReasons.push("Jadwal inspeksi aset telah terlewati.");
  }
  if (expiredCertificates > 0) {
    blockingReasons.push(
      `${expiredCertificates} sertifikat atau kalibrasi telah kedaluwarsa.`,
    );
  }
  if (failedControls > 0) {
    blockingReasons.push(
      `${failedControls} kontrol keselamatan tercatat tidak berfungsi.`,
    );
  }
  if (openCriticalReports > 0) {
    blockingReasons.push(
      `${openCriticalReports} laporan risiko kritis belum ditutup.`,
    );
  }

  if (asset.status === "perlu_dicek") {
    restrictionReasons.push("Status kelayakan aset memerlukan pemeriksaan.");
  }
  if (asset.operationalState === "penggunaan_dibatasi") {
    restrictionReasons.push(
      asset.isolationReason || "Penggunaan aset sedang dibatasi.",
    );
  }
  if (inspectionMissing) {
    restrictionReasons.push("Jadwal inspeksi berikutnya belum ditentukan.");
  }
  if (certificatesDueSoon > 0) {
    restrictionReasons.push(
      `${certificatesDueSoon} sertifikat atau kalibrasi jatuh tempo dalam 30 hari.`,
    );
  }
  if (openWorkOrders > 0) {
    restrictionReasons.push(`${openWorkOrders} perintah kerja masih terbuka.`);
  }
  if (pendingReviews > 0) {
    restrictionReasons.push(
      `${pendingReviews} rekomendasi inspeksi menunggu keputusan.`,
    );
  }

  const decision: ScanSafetyDecision =
    blockingReasons.length > 0
      ? "blocked"
      : restrictionReasons.length > 0
        ? "restricted"
        : "clear";

  return {
    decision,
    reasons:
      decision === "blocked"
        ? blockingReasons
        : decision === "restricted"
          ? restrictionReasons
          : ["Tidak ada pembatasan K3 aktif yang terdeteksi pada data terkini."],
    checkedAt: row.checked_at,
    inspectionOverdue,
    inspectionMissing,
    expiredCertificates,
    certificatesDueSoon,
    openWorkOrders,
    failedControls,
    openCriticalReports,
    pendingReviews,
  };
}

export function unverifiedScanSafety(): AssetScanSafetySummary {
  return {
    decision: "unverified",
    reasons: [
      "Status K3 terkini tidak dapat diverifikasi. Jangan operasikan aset sampai dikonfirmasi oleh laboran.",
    ],
    checkedAt: null,
    inspectionOverdue: false,
    inspectionMissing: false,
    expiredCertificates: 0,
    certificatesDueSoon: 0,
    openWorkOrders: 0,
    failedControls: 0,
    openCriticalReports: 0,
    pendingReviews: 0,
  };
}

export async function fetchAssetScanSafety(
  asset: DatabaseAsset,
): Promise<{ summary: AssetScanSafetySummary; error: string | null }> {
  try {
    const supabase = createSupabaseBrowserClient();
    const { data, error } = await supabase.rpc("get_asset_scan_safety", {
      target_asset_id: asset.id,
    });

    if (error) {
      return { summary: unverifiedScanSafety(), error: error.message };
    }
    if (!Array.isArray(data) || data.length !== 1) {
      return {
        summary: unverifiedScanSafety(),
        error: "Ringkasan status aset tidak mengembalikan tepat satu baris.",
      };
    }

    const row = data[0] as ScanSafetyRow;
    if (row.asset_id !== asset.id) {
      return {
        summary: unverifiedScanSafety(),
        error: "Identitas ringkasan status aset tidak cocok.",
      };
    }

    return { summary: evaluateAssetSafety(asset, row), error: null };
  } catch (error) {
    return {
      summary: unverifiedScanSafety(),
      error: error instanceof Error ? error.message : "Status aset gagal diperiksa.",
    };
  }
}

export async function recordAssetScan(
  assetId: string,
  source: ScanSource,
  decision: ScanSafetyDecision,
): Promise<void> {
  try {
    const supabase = createSupabaseBrowserClient();
    const { error } = await supabase.rpc("record_asset_scan_event", {
      target_asset_id: assetId,
      event_scan_source: source,
      event_safety_decision: decision,
    });

    if (error) {
      console.error("[AssetScanAudit] event scan gagal disimpan.");
    }
  } catch {
    console.error("[AssetScanAudit] event scan gagal disimpan.");
  }
}
