"use client";

import { useState, useSyncExternalStore } from "react";
import { Download, Printer, QrCode } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import {
  addAssetActivity,
  type AssetContactSummary,
  type DatabaseAsset,
} from "@/lib/assets";

interface AssetQrActionsProps {
  asset: DatabaseAsset;
  payload: string;
  contact?: AssetContactSummary | null;
  canManage?: boolean;
}

const subscribeToOrigin = () => () => undefined;
const getServerOrigin = () => "";
const getClientOrigin = () => window.location.origin;

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export default function AssetQrActions({
  asset,
  payload,
  contact,
  canManage = false,
}: AssetQrActionsProps) {
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const svgId = `asset-qr-${asset.id}`;
  const origin = useSyncExternalStore(
    subscribeToOrigin,
    getClientOrigin,
    getServerOrigin,
  );
  const resolvedPayload = payload.startsWith("/") && origin
    ? new URL(payload, origin).toString()
    : payload;

  function getSvg(): SVGSVGElement | null {
    return document.getElementById(svgId) as SVGSVGElement | null;
  }

  function handleDownload() {
    setError("");
    setNotice("");
    const svg = getSvg();
    if (!svg) {
      setError("QR Code belum siap diunduh.");
      return;
    }

    const serialized = new XMLSerializer().serializeToString(svg);
    const svgUrl = URL.createObjectURL(
      new Blob([serialized], { type: "image/svg+xml;charset=utf-8" }),
    );
    const image = new Image();

    image.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = 720;
      canvas.height = 720;
      const context = canvas.getContext("2d");
      if (!context) {
        URL.revokeObjectURL(svgUrl);
        setError("Browser tidak dapat membuat file PNG.");
        return;
      }

      context.fillStyle = "#ffffff";
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.drawImage(image, 40, 40, 640, 640);
      URL.revokeObjectURL(svgUrl);

      const link = document.createElement("a");
      link.download = `vocasafe-${asset.code.toLowerCase()}-qr.png`;
      link.href = canvas.toDataURL("image/png");
      link.click();
      setNotice("QR Code berhasil diunduh. Pastikan label fisik tetap terbaca dan tidak tertutup.");
      if (canManage) {
        void recordLabelActivity("QR Code diunduh", "File PNG label QR dibuat ulang.");
      }
    };

    image.onerror = () => {
      URL.revokeObjectURL(svgUrl);
      setError("QR Code gagal dikonversi menjadi PNG.");
    };
    image.src = svgUrl;
  }

  function handlePrint() {
    setError("");
    setNotice("");
    const svg = getSvg();
    if (!svg) {
      setError("QR Code belum siap dicetak.");
      return;
    }

    const printWindow = window.open("", "_blank", "width=520,height=680");
    if (!printWindow) {
      setError("Pop-up cetak diblokir browser. Izinkan pop-up lalu coba lagi.");
      return;
    }
    printWindow.opener = null;

    const laboratory = asset.laboratory?.name ?? "VocaSafe Lab";
    const emergencyContact = [
      contact?.emergencyContactName,
      contact?.emergencyContactPhone,
    ].filter(Boolean).join(" · ");
    const svgMarkup = new XMLSerializer().serializeToString(svg);
    printWindow.document.write(`<!doctype html>
      <html lang="id">
        <head>
          <meta charset="utf-8" />
          <title>QR ${escapeHtml(asset.code)}</title>
          <style>
            @page { size: 90mm 110mm; margin: 8mm; }
            body { margin: 0; font-family: Arial, sans-serif; color: #10221b; }
            .label { box-sizing: border-box; border: 2px solid #08775a; border-radius: 16px; padding: 18px; text-align: center; }
            .brand { color: #08775a; font-size: 12px; font-weight: 700; letter-spacing: .16em; text-transform: uppercase; }
            h1 { margin: 8px 0 2px; font-size: 22px; }
            .code { margin: 0 0 12px; color: #475569; font-family: monospace; font-size: 15px; }
            svg { width: 58mm; height: 58mm; }
            .lab { margin: 12px 0 0; font-size: 13px; font-weight: 700; }
            .location, .payload, .contact, .warning { margin: 4px 0 0; color: #64748b; font-size: 10px; overflow-wrap: anywhere; }
            .warning { margin-top: 10px; border-radius: 8px; background: #ecfdf5; padding: 7px; color: #065f46; font-weight: 700; }
          </style>
        </head>
        <body>
          <main class="label">
            <div class="brand">VocaSafe Lab</div>
            <h1>${escapeHtml(asset.name)}</h1>
            <p class="code">${escapeHtml(asset.code)}</p>
            ${svgMarkup}
            <p class="lab">${escapeHtml(laboratory)}</p>
            <p class="location">${escapeHtml(asset.location ?? "Lokasi belum ditentukan")}</p>
            ${emergencyContact ? `<p class="contact">Darurat: ${escapeHtml(emergencyContact)}</p>` : ""}
            <p class="warning">Pindai untuk memeriksa status K3 terkini sebelum menggunakan aset.</p>
            <p class="payload">${escapeHtml(resolvedPayload)}</p>
          </main>
          <script>window.addEventListener('load', () => { window.print(); });</script>
        </body>
      </html>`);
    printWindow.document.close();
    setNotice("Dialog cetak stiker dibuka. Gunakan label tahan lingkungan dan segel anti-tamper bila tersedia.");
    if (canManage) {
      void recordLabelActivity("Stiker QR dicetak", "Label QR dicetak atau disimpan melalui dialog print.");
    }
  }

  async function recordLabelActivity(title: string, note: string) {
    const result = await addAssetActivity({
      assetId: asset.id,
      type: "catatan",
      title,
      note,
      occurredAt: new Date().toISOString(),
    });
    if (result.error) {
      console.error("[AssetQrActions] pencatatan lifecycle label gagal.");
    }
  }

  return (
    <section className="min-w-0 overflow-hidden rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
      <div className="mb-4 flex items-center gap-2">
        <QrCode className="h-5 w-5 text-emerald-600" />
        <h2 className="text-lg font-semibold text-slate-900">QR Code Aset</h2>
      </div>
      <div className="flex flex-col items-center gap-3">
        <div className="w-full max-w-[234px] rounded-2xl border border-slate-100 bg-white p-3 shadow-sm">
          <QRCodeSVG id={svgId} value={resolvedPayload} size={210} level="H" includeMargin className="h-auto w-full" />
        </div>
        <p className="max-w-full break-all text-center text-sm text-slate-500">{resolvedPayload}</p>
        <p className="max-w-lg text-center text-xs leading-5 text-slate-500">
          URL memakai ID aset permanen. Perubahan nama atau kode aset tidak mematikan stiker lama.
        </p>
        {canManage ? <div className="grid w-full max-w-md gap-2 sm:grid-cols-2">
          <button
            type="button"
            onClick={handleDownload}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-800 hover:bg-emerald-100"
          >
            <Download className="h-4 w-4" /> Download PNG
          </button>
          <button
            type="button"
            onClick={handlePrint}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-emerald-700 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-800"
          >
            <Printer className="h-4 w-4" /> Cetak Stiker
          </button>
        </div> : <p className="rounded-xl bg-slate-50 px-3 py-2 text-center text-xs text-slate-600">Unduh dan cetak label tersedia untuk teknisi/laboran atau admin.</p>}
        {error && <p role="alert" className="text-center text-xs text-red-600">{error}</p>}
        {notice && <p role="status" className="text-center text-xs text-emerald-700">{notice}</p>}
      </div>
    </section>
  );
}
