"use client";

import { fetchAssets, type DatabaseAsset, type DatabaseAssetStatus } from "@/lib/assets";
import {
  fetchChecklistResults,
  type DatabaseChecklistResult,
} from "@/lib/checklists";
import {
  fetchAssetComplianceCounts,
  type AssetComplianceCounts,
} from "@/lib/asset-safety";
import { fetchReports, type DatabaseReport } from "@/lib/reports";
import type { ReportStatus, RiskLevel } from "@/types";

export interface SupabaseSummary {
  assets: DatabaseAsset[];
  reports: DatabaseReport[];
  checklistResults: DatabaseChecklistResult[];
  assetStatus: Record<DatabaseAssetStatus, number>;
  reportStatus: Record<ReportStatus, number>;
  reportRisk: Record<RiskLevel, number>;
  checklistRisk: Record<RiskLevel, number>;
  checklistWithoutRisk: number;
  checklistHighOrCritical: number;
  openReports: number;
  latestReports: DatabaseReport[];
  latestChecklistResults: DatabaseChecklistResult[];
  compliance: AssetComplianceCounts;
  restrictedAssets: DatabaseAsset[];
  overdueInspections: DatabaseAsset[];
  inspectionsDueSoon: DatabaseAsset[];
  activeHazards: DatabaseReport[];
  activeHighOrCriticalReports: DatabaseReport[];
  updatedAt: string;
}

export interface SupabaseSummaryResult {
  summary: SupabaseSummary;
  errors: string[];
}

function emptyAssetStatus(): Record<DatabaseAssetStatus, number> {
  return { layak: 0, perlu_dicek: 0, tidak_layak: 0 };
}

function emptyReportStatus(): Record<ReportStatus, number> {
  return {
    baru: 0,
    diverifikasi: 0,
    dalam_penanganan: 0,
    selesai: 0,
    ditolak: 0,
  };
}

function emptyRiskSummary(): Record<RiskLevel, number> {
  return { rendah: 0, sedang: 0, tinggi: 0, kritis: 0 };
}

export async function fetchSupabaseSummary(): Promise<SupabaseSummaryResult> {
  const [assetResult, reportResult, checklistResult, complianceResult] = await Promise.all([
    fetchAssets(),
    fetchReports(),
    fetchChecklistResults(),
    fetchAssetComplianceCounts(),
  ]);

  const errors = [
    assetResult.error ? "Data aset belum dapat dimuat." : null,
    reportResult.error ? "Data laporan belum dapat dimuat." : null,
    checklistResult.error ? "Data checklist belum dapat dimuat." : null,
    complianceResult.error ? "Data kepatuhan aset belum dapat dimuat." : null,
  ].filter((error): error is string => Boolean(error));

  const assetStatus = emptyAssetStatus();
  for (const asset of assetResult.assets) assetStatus[asset.status] += 1;

  const reportStatus = emptyReportStatus();
  const reportRisk = emptyRiskSummary();
  for (const report of reportResult.reports) {
    reportStatus[report.status] += 1;
    reportRisk[report.riskCategory] += 1;
  }

  const checklistRisk = emptyRiskSummary();
  let checklistWithoutRisk = 0;
  for (const checklist of checklistResult.results) {
    if (checklist.riskCategory) {
      checklistRisk[checklist.riskCategory] += 1;
    } else {
      checklistWithoutRisk += 1;
    }
  }

  const now = Date.now();
  const dueSoonLimit = now + 30 * 86_400_000;
  const restrictedAssets = assetResult.assets
    .filter((asset) => asset.operationalState !== "aktif" || asset.status === "tidak_layak")
    .sort((left, right) => {
      const leftPriority = left.status === "tidak_layak" || left.operationalState === "dikarantina" ? 0 : 1;
      const rightPriority = right.status === "tidak_layak" || right.operationalState === "dikarantina" ? 0 : 1;
      return leftPriority - rightPriority || left.code.localeCompare(right.code);
    });
  const overdueInspections = assetResult.assets.filter((asset) => {
    if (!asset.nextInspectionAt || asset.operationalState === "dipensiunkan") return false;
    const dueAt = new Date(asset.nextInspectionAt).getTime();
    return !Number.isNaN(dueAt) && dueAt < now;
  });
  const inspectionsDueSoon = assetResult.assets.filter((asset) => {
    if (!asset.nextInspectionAt || asset.operationalState === "dipensiunkan") return false;
    const dueAt = new Date(asset.nextInspectionAt).getTime();
    return !Number.isNaN(dueAt) && dueAt >= now && dueAt <= dueSoonLimit;
  });
  const activeHazards = reportResult.reports.filter(
    (report) => report.hazardActive && !["selesai", "ditolak"].includes(report.status),
  );
  const activeHighOrCriticalReports = activeHazards
    .filter((report) => report.riskCategory === "tinggi" || report.riskCategory === "kritis")
    .sort((left, right) => {
      const riskDelta = (right.riskCategory === "kritis" ? 1 : 0) - (left.riskCategory === "kritis" ? 1 : 0);
      return riskDelta || new Date(left.reportedAt).getTime() - new Date(right.reportedAt).getTime();
    });

  return {
    summary: {
      assets: assetResult.assets,
      reports: reportResult.reports,
      checklistResults: checklistResult.results,
      assetStatus,
      reportStatus,
      reportRisk,
      checklistRisk,
      checklistWithoutRisk,
      checklistHighOrCritical:
        checklistRisk.tinggi + checklistRisk.kritis,
      openReports:
        reportStatus.baru +
        reportStatus.diverifikasi +
        reportStatus.dalam_penanganan,
      latestReports: reportResult.reports.slice(0, 5),
      latestChecklistResults: checklistResult.results.slice(0, 5),
      compliance: complianceResult.counts,
      restrictedAssets,
      overdueInspections,
      inspectionsDueSoon,
      activeHazards,
      activeHighOrCriticalReports,
      updatedAt: new Date().toISOString(),
    },
    errors,
  };
}
