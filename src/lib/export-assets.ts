"use client";

import type { DatabaseAsset } from "@/lib/assets";

const FORMULA_PREFIX = /^[=+\-@]/;

function safeCell(value: string | number | null | undefined): string {
  let normalized = value === null || value === undefined ? "" : String(value);
  if (FORMULA_PREFIX.test(normalized)) normalized = `'${normalized}`;
  return `"${normalized.replaceAll('"', '""')}"`;
}

export function exportAssetRegisterCsv(assets: DatabaseAsset[]) {
  const headers = [
    "kode",
    "nama",
    "laboratorium",
    "lokasi",
    "jenis",
    "kategori",
    "status_kelayakan",
    "status_operasional",
    "produsen",
    "model",
    "nomor_seri",
    "tahun_pembuatan",
    "tanggal_perolehan",
    "inspeksi_terakhir",
    "inspeksi_berikutnya",
    "interval_inspeksi_hari",
    "sumber_energi",
    "kompetensi_operator",
    "referensi_regulasi",
    "spesifikasi_teknis",
  ];

  const rows = assets.map((asset) => [
    asset.code,
    asset.name,
    asset.laboratory?.name,
    asset.location,
    asset.kind,
    asset.category,
    asset.status,
    asset.operationalState,
    asset.manufacturer,
    asset.model,
    asset.serialNumber,
    asset.manufactureYear,
    asset.acquiredAt,
    asset.lastInspectionAt,
    asset.nextInspectionAt,
    asset.inspectionIntervalDays,
    asset.energySources.join("; "),
    asset.requiredCompetency,
    asset.regulatoryReference,
    Object.entries(asset.technicalSpecs)
      .map(([key, value]) => `${key}: ${value}`)
      .join("; "),
  ]);

  const csv = `\uFEFF${[headers, ...rows]
    .map((row) => row.map((cell) => safeCell(cell)).join(","))
    .join("\r\n")}`;
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = "vocasafe-asset-register.csv";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}
