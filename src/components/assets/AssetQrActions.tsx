"use client";

import { useState } from "react";
import { Download, Printer, QrCode } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import type { DatabaseAsset } from "@/lib/assets";

interface AssetQrActionsProps {
  asset: DatabaseAsset;
  payload: string;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export default function AssetQrActions({ asset, payload }: AssetQrActionsProps) {
  const [error, setError] = useState("");
  const svgId = `asset-qr-${asset.id}`;

  function getSvg(): SVGSVGElement | null {
    return document.getElementById(svgId) as SVGSVGElement | null;
  }

  function handleDownload() {
    setError("");
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
    };

    image.onerror = () => {
      URL.revokeObjectURL(svgUrl);
      setError("QR Code gagal dikonversi menjadi PNG.");
    };
    image.src = svgUrl;
  }

  function handlePrint() {
    setError("");
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
            .location, .payload { margin: 4px 0 0; color: #64748b; font-size: 10px; overflow-wrap: anywhere; }
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
            <p class="payload">${escapeHtml(payload)}</p>
          </main>
          <script>window.addEventListener('load', () => { window.print(); });</script>
        </body>
      </html>`);
    printWindow.document.close();
  }

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
      <div className="mb-4 flex items-center gap-2">
        <QrCode className="h-5 w-5 text-emerald-600" />
        <h2 className="text-lg font-semibold text-slate-900">QR Code Aset</h2>
      </div>
      <div className="flex flex-col items-center gap-3">
        <div className="rounded-2xl border border-slate-100 bg-white p-3 shadow-sm">
          <QRCodeSVG id={svgId} value={payload} size={210} level="H" includeMargin />
        </div>
        <p className="max-w-full break-all text-center text-sm text-slate-500">{payload}</p>
        <div className="grid w-full max-w-md gap-2 sm:grid-cols-2">
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
        </div>
        {error && <p role="alert" className="text-center text-xs text-red-600">{error}</p>}
      </div>
    </section>
  );
}
