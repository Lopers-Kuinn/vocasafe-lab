"use client";

import type { FormEvent } from "react";
import {
  Suspense,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Info, Keyboard, Loader2, Search, ShieldCheck } from "lucide-react";
import AppShell from "@/components/AppShell";
import AssetScanSafetyGate from "@/components/scan/AssetScanSafetyGate";
import QrCameraScanner, {
  type CameraLookupResult,
} from "@/components/scan/QrCameraScanner";
import { getCurrentUserProfile } from "@/lib/auth";
import { fetchAssetByLookup, type DatabaseAsset } from "@/lib/assets";
import {
  fetchAssetScanSafety,
  recordAssetScan,
  type AssetScanSafetySummary,
  type ScanSource,
} from "@/lib/scan-safety";
import type { UserRole } from "@/types";

const EXAMPLE_INPUTS = ["AST-001", "vocasafe://assets/AST-001"];

interface ScanResult {
  asset: DatabaseAsset;
  safety: AssetScanSafetySummary;
}

function ScanPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialLookup = searchParams.get("asset")?.trim() ?? "";
  const processedInitialLookupRef = useRef("");
  const requestSequenceRef = useRef(0);
  const [input, setInput] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [scanResult, setScanResult] = useState<ScanResult | null>(null);
  const [currentRole, setCurrentRole] = useState<UserRole | null>(null);
  const [scannerKey, setScannerKey] = useState(0);

  useEffect(() => {
    let active = true;
    void getCurrentUserProfile().then(({ user }) => {
      if (active) setCurrentRole(user?.role ?? null);
    });
    return () => {
      active = false;
    };
  }, []);

  const lookupAndShowAsset = useCallback(
    async (lookup: string, source: ScanSource): Promise<CameraLookupResult> => {
      const normalizedLookup = lookup.trim();
      if (!normalizedLookup) {
        return {
          success: false,
          message: "Masukkan kode aset atau tautan QR terlebih dahulu.",
        };
      }

      const requestSequence = requestSequenceRef.current + 1;
      requestSequenceRef.current = requestSequence;
      setError("");
      setLoading(true);
      setInput(normalizedLookup);

      const result = await fetchAssetByLookup(normalizedLookup);
      if (requestSequenceRef.current !== requestSequence) {
        return { success: false, message: "Pemeriksaan dibatalkan." };
      }

      if (result.error) {
        const safePayloadError =
          result.error.startsWith("QR") || result.error.startsWith("Format URL");
        if (!safePayloadError) console.error("[ScanPage] lookup aset gagal.");
        const message = safePayloadError
          ? result.error
          : "Data aset belum dapat diperiksa. Silakan coba kembali.";
        setError(message);
        setLoading(false);
        return { success: false, message };
      }

      if (!result.asset) {
        const message =
          "Aset tidak ditemukan. Periksa kode atau gunakan QR resmi VocaSafe Lab.";
        setError(message);
        setLoading(false);
        return { success: false, message };
      }

      const safetyResult = await fetchAssetScanSafety(result.asset);
      if (requestSequenceRef.current !== requestSequence) {
        return { success: false, message: "Pemeriksaan dibatalkan." };
      }

      if (safetyResult.error) {
        console.error("[ScanPage] ringkasan K3 aset gagal dimuat.");
      }

      setScanResult({ asset: result.asset, safety: safetyResult.summary });
      setLoading(false);
      void recordAssetScan(
        result.asset.id,
        source,
        safetyResult.summary.decision,
      );
      return { success: true };
    },
    [],
  );

  useEffect(() => {
    if (!initialLookup || processedInitialLookupRef.current === initialLookup) return;
    processedInitialLookupRef.current = initialLookup;
    const timer = window.setTimeout(() => {
      void lookupAndShowAsset(initialLookup, "qr_link");
    }, 0);
    return () => window.clearTimeout(timer);
  }, [initialLookup, lookupAndShowAsset]);

  async function handleScan(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const result = await lookupAndShowAsset(input, "manual");
    if (!result.success) setError(result.message ?? "Aset tidak ditemukan.");
  }

  function resetScan() {
    requestSequenceRef.current += 1;
    processedInitialLookupRef.current = "";
    setScanResult(null);
    setInput("");
    setError("");
    setLoading(false);
    setScannerKey((current) => current + 1);
    router.replace("/scan", { scroll: false });
  }

  const canCreateReport = currentRole !== null && currentRole !== "kepala_lab";
  const canCreateChecklist =
    currentRole === "dosen" ||
    currentRole === "teknisi" ||
    currentRole === "admin";

  return (
    <AppShell>
      <div className="mx-auto max-w-3xl space-y-6 pb-8">
        <div>
          <span className="inline-flex items-center gap-2 rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold uppercase tracking-[0.12em] text-emerald-800">
            <ShieldCheck className="h-4 w-4" /> Safety Gate
          </span>
          <h1 className="mt-3 text-2xl font-bold text-slate-900 sm:text-3xl">
            Scan QR / Input Kode Aset
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
            Identifikasi aset lalu periksa status kelayakan, pembatasan operasi,
            inspeksi, sertifikat, dan risiko aktif sebelum aset digunakan.
          </p>
        </div>

        {loading && !scanResult && (
          <div role="status" className="flex min-h-48 items-center justify-center rounded-3xl border border-emerald-200 bg-white p-6 text-sm font-semibold text-slate-600 shadow-sm">
            <Loader2 className="mr-3 h-6 w-6 animate-spin text-emerald-700" />
            Memeriksa identitas dan status K3 aset...
          </div>
        )}

        {scanResult ? (
          <AssetScanSafetyGate
            asset={scanResult.asset}
            safety={scanResult.safety}
            canCreateReport={canCreateReport}
            canCreateChecklist={canCreateChecklist}
            onReset={resetScan}
          />
        ) : !loading ? (
          <>
            <QrCameraScanner
              key={scannerKey}
              onDecoded={(decodedText) =>
                lookupAndShowAsset(decodedText, "camera")
              }
            />

            <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
              <div className="mb-6 flex flex-col items-center gap-4">
                <div className="rounded-full bg-emerald-100 p-4">
                  <Keyboard className="h-10 w-10 text-emerald-600" />
                </div>
                <h2 className="text-lg font-semibold text-slate-900">Input Manual</h2>
                <p className="text-center text-sm text-slate-500">
            Gunakan kode aset atau tautan QR jika kamera tidak tersedia.
                </p>
              </div>

              <form onSubmit={handleScan} className="space-y-4">
                <label htmlFor="asset-lookup" className="block text-sm font-medium text-slate-700">
              Kode aset atau tautan QR
                </label>
                <input
                  id="asset-lookup"
                  type="text"
                  value={input}
                  onChange={(event) => {
                    setInput(event.target.value);
                    setError("");
                  }}
                  placeholder="Contoh: AST-001 atau vocasafe://assets/AST-001"
                  autoComplete="off"
                  className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none placeholder:text-slate-400 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10"
                />

                {error && (
                  <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                    {error}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-emerald-700 px-4 py-3 text-sm font-bold text-white transition-colors hover:bg-emerald-800 disabled:cursor-not-allowed disabled:bg-emerald-400"
                >
                  <Search className="h-4 w-4" /> Periksa Status K3
                </button>
              </form>

              <div className="mt-6 border-t border-slate-100 pt-4">
                <p className="mb-2 text-xs font-medium text-slate-500">Contoh input:</p>
                <div className="flex flex-wrap gap-2">
                  {EXAMPLE_INPUTS.map((example) => (
                    <button
                      key={example}
                      type="button"
                      onClick={() => {
                        setInput(example);
                        setError("");
                      }}
                      className="max-w-full break-all rounded-xl bg-emerald-50 px-3 py-2 text-left text-xs font-medium text-emerald-700 hover:bg-emerald-100"
                    >
                      {example}
                    </button>
                  ))}
                </div>
              </div>

              <div className="mt-5 flex items-start gap-2 rounded-xl border border-sky-100 bg-sky-50 p-3 text-xs leading-5 text-sky-800">
                <Info className="mt-0.5 h-4 w-4 shrink-0" />
                <p>
                  Kamera memerlukan izin browser dan HTTPS. Jika status daring
                  tidak dapat diverifikasi, aplikasi tidak akan menyatakan aset layak digunakan.
                </p>
              </div>
            </div>
          </>
        ) : null}
      </div>
    </AppShell>
  );
}

export default function ScanPage() {
  return (
    <Suspense
      fallback={
        <AppShell>
          <div className="flex min-h-64 items-center justify-center text-sm text-slate-500">
            <Loader2 className="mr-2 h-5 w-5 animate-spin text-emerald-700" />
            Menyiapkan Safety Gate...
          </div>
        </AppShell>
      }
    >
      <ScanPageContent />
    </Suspense>
  );
}
