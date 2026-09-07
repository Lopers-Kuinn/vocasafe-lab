"use client";

import Link from "next/link";
import {
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  ClipboardCheck,
  FileWarning,
  MapPin,
  PhoneCall,
  RotateCcw,
  ShieldAlert,
  ShieldCheck,
  Wrench,
} from "lucide-react";
import type { AssetContactSummary, DatabaseAsset } from "@/lib/assets";
import type { AssetScanSafetySummary } from "@/lib/scan-safety";

interface AssetScanSafetyGateProps {
  asset: DatabaseAsset;
  safety: AssetScanSafetySummary;
  contact: AssetContactSummary | null;
  canCreateReport: boolean;
  canCreateChecklist: boolean;
  onReset: () => void;
}

const decisionPresentation = {
  clear: {
    label: "LAYAK DIGUNAKAN",
    description: "Gunakan aset sesuai SOP, APD, dan kewenangan operator.",
    icon: ShieldCheck,
    panel: "border-emerald-300 bg-emerald-50 text-emerald-950",
    badge: "bg-emerald-700 text-white",
  },
  restricted: {
    label: "PERLU KONFIRMASI",
    description: "Ada kondisi yang perlu diperiksa bersama laboran sebelum aset digunakan.",
    icon: AlertTriangle,
    panel: "border-amber-300 bg-amber-50 text-amber-950",
    badge: "bg-amber-500 text-amber-950",
  },
  blocked: {
    label: "JANGAN DIGUNAKAN",
    description: "Ada kondisi K3 pemblokir. Hentikan penggunaan sampai aset dinyatakan aman oleh petugas berwenang.",
    icon: ShieldAlert,
    panel: "border-red-300 bg-red-50 text-red-950",
    badge: "bg-red-700 text-white",
  },
  unverified: {
    label: "Status K3 tidak dapat diverifikasi",
    description: "Jangan operasikan aset sampai status dikonfirmasi oleh laboran.",
    icon: FileWarning,
    panel: "border-slate-400 bg-slate-100 text-slate-950",
    badge: "bg-slate-800 text-white",
  },
} as const;

const assetStatusLabels: Record<DatabaseAsset["status"], string> = {
  layak: "Layak",
  perlu_dicek: "Perlu dicek",
  tidak_layak: "Tidak layak",
};

const operationalStateLabels: Record<DatabaseAsset["operationalState"], string> = {
  aktif: "Aktif",
  penggunaan_dibatasi: "Penggunaan dibatasi",
  dalam_perbaikan: "Dalam perbaikan",
  dikarantina: "Dikarantina / LOTO",
  dipensiunkan: "Dipensiunkan",
};

const decisionLabels: Record<AssetScanSafetySummary["decision"], string> = {
  clear: "Boleh digunakan",
  restricted: "Konfirmasi sebelum digunakan",
  blocked: "Penggunaan dihentikan",
  unverified: "Belum terverifikasi",
};

const statusTone: Record<DatabaseAsset["status"], string> = {
  layak: "border-emerald-200 bg-emerald-50 text-emerald-800",
  perlu_dicek: "border-amber-200 bg-amber-50 text-amber-900",
  tidak_layak: "border-red-200 bg-red-50 text-red-800",
};

const operationalTone: Record<DatabaseAsset["operationalState"], string> = {
  aktif: "border-emerald-200 bg-emerald-50 text-emerald-800",
  penggunaan_dibatasi: "border-amber-200 bg-amber-50 text-amber-900",
  dalam_perbaikan: "border-red-200 bg-red-50 text-red-800",
  dikarantina: "border-red-300 bg-red-100 text-red-900",
  dipensiunkan: "border-slate-300 bg-slate-100 text-slate-800",
};

function formatDate(value: string | null): string {
  if (!value) return "Belum tersedia";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Belum tersedia";
  return new Intl.DateTimeFormat("id-ID", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

export default function AssetScanSafetyGate({
  asset,
  safety,
  contact,
  canCreateReport,
  canCreateChecklist,
  onReset,
}: AssetScanSafetyGateProps) {
  const presentation = decisionPresentation[safety.decision];
  const DecisionIcon = presentation.icon;

  return (
    <section
      aria-labelledby="scan-safety-title"
      aria-live="polite"
      className={`overflow-hidden rounded-3xl border-2 shadow-[0_24px_70px_rgba(15,23,42,0.12)] ${presentation.panel}`}
    >
      <div className="p-5 sm:p-7">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex min-w-0 items-start gap-4">
            <span className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-white/80 shadow-sm">
              <DecisionIcon className="h-7 w-7" aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <span className={`inline-flex rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-[0.12em] ${presentation.badge}`}>
                Hasil pemeriksaan langsung
              </span>
              <h2 id="scan-safety-title" className="mt-3 break-words text-2xl font-black tracking-[-0.03em] sm:text-3xl">
                {presentation.label}
              </h2>
              <p className="mt-2 text-sm leading-6 opacity-80">{presentation.description}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onReset}
            className="inline-flex min-h-12 shrink-0 items-center justify-center gap-2 rounded-xl border border-current/15 bg-white/70 px-4 py-2 text-sm font-bold hover:bg-white"
          >
            <RotateCcw className="h-4 w-4" /> Scan Aset Lain
          </button>
        </div>

        <div className="mt-6 grid gap-3 rounded-2xl bg-white/75 p-4 text-slate-900 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <p className="text-xs font-bold uppercase tracking-[0.12em] text-slate-500">Aset teridentifikasi</p>
            <p className="mt-1 break-words text-xl font-black">{asset.name}</p>
            <p className="mt-1 font-mono text-sm font-semibold text-emerald-800">{asset.code}</p>
          </div>
          <p className="flex items-start gap-2 text-sm text-slate-600">
            <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-emerald-700" />
            <span>{asset.location || "Lokasi belum dicatat"}</span>
          </p>
          <p className="flex items-start gap-2 text-sm text-slate-600">
            <CalendarClock className="mt-0.5 h-4 w-4 shrink-0 text-emerald-700" />
            <span>Inspeksi berikutnya: {formatDate(asset.nextInspectionAt)}</span>
          </p>
          <div className="sm:col-span-2 grid gap-2 pt-1 sm:grid-cols-3">
            <div className={`rounded-xl border px-3 py-2 ${statusTone[asset.status]}`}>
              <p className="text-[10px] font-bold uppercase tracking-[0.1em] opacity-70">Kelayakan aset</p>
              <p className="mt-1 text-sm font-black">{assetStatusLabels[asset.status]}</p>
            </div>
            <div className={`rounded-xl border px-3 py-2 ${operationalTone[asset.operationalState]}`}>
              <p className="text-[10px] font-bold uppercase tracking-[0.1em] opacity-70">Status operasi</p>
              <p className="mt-1 text-sm font-black">{operationalStateLabels[asset.operationalState]}</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-slate-800">
              <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-slate-500">Keputusan saat scan</p>
              <p className="mt-1 text-sm font-black">{decisionLabels[safety.decision]}</p>
            </div>
          </div>
        </div>

        <div className="mt-5 rounded-2xl border border-current/10 bg-white/55 p-4">
          <p className="text-xs font-bold uppercase tracking-[0.12em] opacity-65">Alasan keputusan</p>
          <ul className="mt-3 space-y-2 text-sm leading-6">
            {safety.reasons.map((reason) => (
              <li key={reason} className="flex items-start gap-2">
                <CheckCircle2 className="mt-1 h-4 w-4 shrink-0" aria-hidden="true" />
                <span>{reason}</span>
              </li>
            ))}
          </ul>
        </div>

        {safety.decision !== "unverified" && (
          <dl className="mt-5 grid grid-cols-2 gap-2 text-xs sm:grid-cols-3">
            <div className="rounded-xl bg-white/60 p-3"><dt>Sertifikat kedaluwarsa</dt><dd className="mt-1 text-lg font-black">{safety.expiredCertificates}</dd></div>
            <div className="rounded-xl bg-white/60 p-3"><dt>Perintah kerja terbuka</dt><dd className="mt-1 text-lg font-black">{safety.openWorkOrders}</dd></div>
            <div className="rounded-xl bg-white/60 p-3"><dt>Laporan kritis aktif</dt><dd className="mt-1 text-lg font-black">{safety.openCriticalReports}</dd></div>
          </dl>
        )}

        <p className="mt-4 text-xs opacity-65">
          Status diperiksa: {formatDate(safety.checkedAt)}. QR adalah akses informasi; ikuti rambu fisik, SOP, dan LOTO yang terpasang.
        </p>

        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          <Link
            href={`/assets/${encodeURIComponent(asset.code)}#sop-digital`}
            className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-slate-950 px-4 py-3 text-sm font-bold text-white hover:bg-slate-800"
          >
            <ShieldCheck className="h-4 w-4" /> Lihat Detail &amp; SOP
          </Link>
          {canCreateReport && (
            <Link
              href={`/reports/new?assetId=${encodeURIComponent(asset.code)}`}
              className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-red-300 bg-white px-4 py-3 text-sm font-bold text-red-800 hover:bg-red-50"
            >
              <FileWarning className="h-4 w-4" /> Laporkan Bahaya
            </Link>
          )}
          {canCreateChecklist && (
            <Link
              href={`/checklists/new?assetId=${encodeURIComponent(asset.code)}`}
              className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-emerald-300 bg-white px-4 py-3 text-sm font-bold text-emerald-800 hover:bg-emerald-50"
            >
              <ClipboardCheck className="h-4 w-4" /> Mulai Checklist
            </Link>
          )}
          {contact?.emergencyContactPhone && (
            <a
              href={`tel:${contact.emergencyContactPhone}`}
              className={`inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border px-4 py-3 text-center text-sm font-bold ${safety.decision === "clear" ? "border-emerald-300 bg-white text-emerald-800 hover:bg-emerald-50" : "border-red-700 bg-red-700 text-white hover:bg-red-800"}`}
            >
              <PhoneCall className="h-4 w-4" /> Hubungi {contact.emergencyContactName ?? "Kontak Lab"}
            </a>
          )}
          {safety.decision !== "clear" && (
            <div className="flex min-h-12 items-center justify-center gap-2 rounded-xl border border-current/15 bg-white/50 px-4 py-3 text-center text-xs font-semibold">
              <Wrench className="h-4 w-4 shrink-0" /> {contact?.picName ? `PIC: ${contact.picName}` : "Hubungi PIC/laboran sebelum tindakan"}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
