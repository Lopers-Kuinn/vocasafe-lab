"use client";

import type { CameraDevice, Html5Qrcode } from "html5-qrcode";
import {
  Camera,
  CameraOff,
  Flashlight,
  Loader2,
  RefreshCw,
  ScanLine,
  Volume2,
} from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";

export interface CameraLookupResult {
  success: boolean;
  message?: string;
}

interface QrCameraScannerProps {
  onDecoded: (decodedText: string) => Promise<CameraLookupResult>;
}

interface CameraDebugInfo {
  detectedCount: number | null;
  selectedCameraId: string;
  selectedCameraLabel: string;
  lastErrorName: string;
  lastErrorMessage: string;
}

interface CameraErrorInfo {
  name: string;
  message: string;
}

type CameraStage =
  | "getUserMedia"
  | "enumerateDevices"
  | "getCameras"
  | "scanner.start";

type CameraStatus =
  | "idle"
  | "requesting"
  | "active"
  | "stopping"
  | "success"
  | "denied"
  | "unsupported"
  | "error";

const STATUS_LABELS: Record<CameraStatus, string> = {
  idle: "Menunggu",
  requesting: "Meminta izin kamera",
  active: "Kamera aktif",
  stopping: "Menghentikan kamera",
  success: "QR terbaca",
  denied: "Izin ditolak",
  unsupported: "Kamera tidak tersedia",
  error: "Terjadi kendala",
};

const STATUS_STYLES: Record<CameraStatus, string> = {
  idle: "bg-slate-100 text-slate-700",
  requesting: "bg-sky-100 text-sky-700",
  active: "bg-emerald-100 text-emerald-700",
  stopping: "bg-amber-100 text-amber-700",
  success: "bg-emerald-100 text-emerald-700",
  denied: "bg-red-100 text-red-700",
  unsupported: "bg-amber-100 text-amber-700",
  error: "bg-red-100 text-red-700",
};

const INITIAL_DEBUG_INFO: CameraDebugInfo = {
  detectedCount: null,
  selectedCameraId: "",
  selectedCameraLabel: "",
  lastErrorName: "",
  lastErrorMessage: "",
};

function stopMediaStream(stream: MediaStream | null): void {
  stream?.getTracks().forEach((track) => track.stop());
}

async function releaseScanner(
  scanner: Html5Qrcode,
  pendingStart?: Promise<null> | null,
): Promise<void> {
  try {
    if (pendingStart) {
      try {
        await pendingStart;
      } catch {
        // A rejected start means there is no active stream to stop.
      }
    }

    if (scanner.isScanning) {
      await scanner.stop();
    }
  } catch {
    // Cleanup must not surface an unhandled rejection during navigation.
  } finally {
    try {
      scanner.clear();
    } catch {
      // The reader element may already be removed during route navigation.
    }
  }
}

function readCameraError(error: unknown): CameraErrorInfo {
  if (error instanceof Error) {
    return {
      name: error.name || "Error",
      message: error.message || "Tidak ada detail error dari browser.",
    };
  }

  if (typeof error === "object" && error !== null) {
    const value = error as { name?: unknown; message?: unknown };
    return {
      name: typeof value.name === "string" ? value.name : "UnknownError",
      message:
        typeof value.message === "string"
          ? value.message
          : "Tidak ada detail error dari browser.",
    };
  }

  const rawMessage = String(error || "Tidak ada detail error dari browser.");
  const namedError = rawMessage.match(/^([A-Za-z]+Error)\s*:\s*(.+)$/);

  return {
    name: namedError?.[1] ?? "UnknownError",
    message: namedError?.[2] ?? rawMessage,
  };
}

function cameraFailure(
  error: unknown,
  stage: CameraStage,
): {
  status: "denied" | "unsupported" | "error";
  message: string;
  errorInfo: CameraErrorInfo;
} {
  const errorInfo = readCameraError(error);
  const normalized = `${errorInfo.name} ${errorInfo.message}`.toLowerCase();
  const technicalDetail = `${errorInfo.name}: ${errorInfo.message}`;

  if (
    normalized.includes("notallowed") ||
    normalized.includes("permission") ||
    normalized.includes("denied")
  ) {
    return {
      status: "denied",
      message: `Akses kamera ditolak. Gunakan input manual. (${technicalDetail})`,
      errorInfo,
    };
  }

  if (normalized.includes("notfound") || normalized.includes("no camera")) {
    return {
      status: "unsupported",
      message: `Kamera tidak ditemukan. Gunakan input manual. (${technicalDetail})`,
      errorInfo,
    };
  }

  if (normalized.includes("notreadable") || normalized.includes("aborterror")) {
    return {
      status: "error",
      message: `Kamera tidak dapat dibuka dan mungkin sedang digunakan aplikasi lain. Gunakan input manual. (${technicalDetail})`,
      errorInfo,
    };
  }

  if (normalized.includes("security") || normalized.includes("secure context")) {
    return {
      status: "unsupported",
      message: `Kamera membutuhkan koneksi HTTPS atau localhost. Gunakan input manual. (${technicalDetail})`,
      errorInfo,
    };
  }

  if (
    normalized.includes("overconstrained") ||
    normalized.includes("not supported") ||
    normalized.includes("unsupported") ||
    normalized.includes("device") ||
    normalized.includes("media")
  ) {
    return {
      status: "unsupported",
      message: `Kamera tidak tersedia di browser ini. Gunakan input manual. (${technicalDetail})`,
      errorInfo,
    };
  }

  const stageMessage: Record<typeof stage, string> = {
    getUserMedia: "Browser gagal membuka stream kamera.",
    enumerateDevices: "Browser gagal membaca daftar perangkat kamera.",
    getCameras: "Scanner gagal membaca daftar kamera.",
    "scanner.start": "Scanner QR gagal menggunakan kamera terpilih.",
  };

  return {
    status: "error",
    message: `${stageMessage[stage]} Gunakan input manual. (${technicalDetail})`,
    errorInfo,
  };
}

function selectCamera(
  cameras: CameraDevice[],
  preferredCameraId?: string,
): CameraDevice {
  return (
    cameras.find((camera) => camera.id === preferredCameraId) ??
    cameras.find((camera) => /(back|rear|environment)/i.test(camera.label)) ??
    cameras[0]
  );
}

function playScanFeedback(): void {
  if (typeof navigator !== "undefined" && "vibrate" in navigator) {
    navigator.vibrate(120);
  }

  try {
    const AudioContextClass = window.AudioContext;
    const context = new AudioContextClass();
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.frequency.value = 880;
    gain.gain.setValueAtTime(0.08, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + 0.12);
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start();
    oscillator.stop(context.currentTime + 0.12);
    oscillator.addEventListener("ended", () => void context.close(), { once: true });
  } catch {
    // Audio feedback is optional and may be blocked by browser policy.
  }
}

export default function QrCameraScanner({ onDecoded }: QrCameraScannerProps) {
  const generatedId = useId().replace(/:/g, "");
  const readerId = `vocasafe-qr-reader-${generatedId}`;
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const startPromiseRef = useRef<Promise<null> | null>(null);
  const preflightStreamRef = useRef<MediaStream | null>(null);
  const cameraTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = useRef(false);
  const operationRef = useRef(0);
  const processingRef = useRef(false);
  const [status, setStatus] = useState<CameraStatus>("idle");
  const [message, setMessage] = useState(
    "Tekan tombol mulai untuk meminta akses kamera.",
  );
  const [, setDebugInfo] =
    useState<CameraDebugInfo>(INITIAL_DEBUG_INFO);
  const [detectedCameras, setDetectedCameras] = useState<CameraDevice[]>([]);
  const [selectedCameraId, setSelectedCameraId] = useState("");
  const [torchAvailable, setTorchAvailable] = useState(false);
  const [torchEnabled, setTorchEnabled] = useState(false);

  useEffect(() => {
    mountedRef.current = true;

    return () => {
      mountedRef.current = false;
      operationRef.current += 1;
      const scanner = scannerRef.current;
      const pendingStart = startPromiseRef.current;
      const preflightStream = preflightStreamRef.current;
      scannerRef.current = null;
      startPromiseRef.current = null;
      preflightStreamRef.current = null;
      if (cameraTimeoutRef.current) clearTimeout(cameraTimeoutRef.current);
      cameraTimeoutRef.current = null;

      stopMediaStream(preflightStream);

      if (scanner) {
        void releaseScanner(scanner, pendingStart);
      }
    };
  }, []);

  async function handleDecoded(
    scanner: Html5Qrcode,
    decodedText: string,
  ): Promise<void> {
    if (processingRef.current) return;

    processingRef.current = true;
    if (cameraTimeoutRef.current) clearTimeout(cameraTimeoutRef.current);
    cameraTimeoutRef.current = null;
    playScanFeedback();
    operationRef.current += 1;
    scannerRef.current = null;

    if (mountedRef.current) {
      setStatus("success");
      setMessage("QR berhasil dibaca. Memeriksa data aset...");
    }

    await releaseScanner(scanner);

    try {
      const result = await onDecoded(decodedText);
      if (!mountedRef.current || result.success) return;

      setStatus("error");
      setMessage(result.message ?? "Aset tidak ditemukan. Gunakan input manual.");
      processingRef.current = false;
    } catch {
      if (!mountedRef.current) return;
      setStatus("error");
      setMessage("Hasil QR tidak dapat diperiksa. Gunakan input manual.");
      processingRef.current = false;
    }
  }

  function showCameraFailure(error: unknown, stage: CameraStage): void {
    if (!mountedRef.current) return;

    const failure = cameraFailure(error, stage);
    setDebugInfo((current) => ({
      ...current,
      lastErrorName: failure.errorInfo.name,
      lastErrorMessage: failure.errorInfo.message,
    }));
    setStatus(failure.status);
    setMessage(failure.message);
  }

  async function startCamera(): Promise<void> {
    if (scannerRef.current || status === "requesting" || status === "active") {
      return;
    }

    const mediaDevices = navigator.mediaDevices;

    if (!mediaDevices) {
      const error = {
        name: "NotSupportedError",
        message: "navigator.mediaDevices tidak tersedia.",
      };
      console.error("[QrCameraScanner] getUserMedia failed", error);
      showCameraFailure(error, "getUserMedia");
      return;
    }

    if (typeof mediaDevices.getUserMedia !== "function") {
      const error = {
        name: "NotSupportedError",
        message: "navigator.mediaDevices.getUserMedia tidak tersedia.",
      };
      console.error("[QrCameraScanner] getUserMedia failed", error);
      showCameraFailure(error, "getUserMedia");
      return;
    }

    if (typeof mediaDevices.enumerateDevices !== "function") {
      const error = {
        name: "NotSupportedError",
        message: "navigator.mediaDevices.enumerateDevices tidak tersedia.",
      };
      console.error("[QrCameraScanner] enumerateDevices failed", error);
      showCameraFailure(error, "enumerateDevices");
      return;
    }

    const operation = operationRef.current + 1;
    operationRef.current = operation;
    processingRef.current = false;
    setStatus("requesting");
    setMessage("Memeriksa akses dan perangkat kamera...");
    setDebugInfo(INITIAL_DEBUG_INFO);

    let scanner: Html5Qrcode | null = null;
    let startPromise: Promise<null> | null = null;
    let startResolved = false;
    let pendingDecodedText: string | null = null;
    let preflightStream: MediaStream | null = null;
    let scannerModule: typeof import("html5-qrcode");
    let cameras: CameraDevice[];

    try {
      preflightStream = await mediaDevices.getUserMedia({
        video: true,
        audio: false,
      });
      preflightStreamRef.current = preflightStream;
    } catch (error) {
      console.error("[QrCameraScanner] getUserMedia failed", error);
      if (operationRef.current === operation) {
        showCameraFailure(error, "getUserMedia");
      }
      return;
    }

    stopMediaStream(preflightStream);
    if (preflightStreamRef.current === preflightStream) {
      preflightStreamRef.current = null;
    }

    if (!mountedRef.current || operationRef.current !== operation) return;

    try {
      await mediaDevices.enumerateDevices();
    } catch (error) {
      console.error("[QrCameraScanner] enumerateDevices failed", error);
      if (operationRef.current === operation) {
        showCameraFailure(error, "enumerateDevices");
      }
      return;
    }

    if (!mountedRef.current || operationRef.current !== operation) return;

    try {
      scannerModule = await import("html5-qrcode");
      cameras = await scannerModule.Html5Qrcode.getCameras();
    } catch (error) {
      console.error("[QrCameraScanner] getCameras failed", error);
      if (operationRef.current === operation) {
        showCameraFailure(error, "getCameras");
      }
      return;
    }

    if (!mountedRef.current || operationRef.current !== operation) return;

    if (cameras.length === 0) {
      setDebugInfo((current) => ({ ...current, detectedCount: 0 }));
      setStatus("unsupported");
      setMessage("Kamera tidak ditemukan. Gunakan input manual.");
      return;
    }

    const selectedCamera = selectCamera(cameras, selectedCameraId);
    setDetectedCameras(cameras);
    setSelectedCameraId(selectedCamera.id);
    setDebugInfo({
      detectedCount: cameras.length,
      selectedCameraId: selectedCamera.id,
      selectedCameraLabel: selectedCamera.label || "(label tidak tersedia)",
      lastErrorName: "",
      lastErrorMessage: "",
    });

    try {
      scanner = new scannerModule.Html5Qrcode(readerId, { verbose: false });
      scannerRef.current = scanner;

      startPromise = scanner.start(
        selectedCamera.id,
        {
          fps: 10,
          qrbox: (width, height) => {
            const size = Math.max(160, Math.min(width, height, 240));
            return { width: size, height: size };
          },
          aspectRatio: 1,
        },
        (decodedText) => {
          if (!startResolved) {
            pendingDecodedText ??= decodedText;
            return;
          }

          if (scanner) void handleDecoded(scanner, decodedText);
        },
        () => {
          // A frame without a QR code is expected while the camera is active.
        },
      );
      startPromiseRef.current = startPromise;
      await startPromise;
      startResolved = true;

      if (startPromiseRef.current === startPromise) {
        startPromiseRef.current = null;
      }

      if (!mountedRef.current || operationRef.current !== operation) {
        if (scannerRef.current === scanner) {
          scannerRef.current = null;
          await releaseScanner(scanner);
        }
        return;
      }

      setStatus("active");
      setMessage("Arahkan kamera ke QR Code aset VocaSafe Lab.");
      cameraTimeoutRef.current = setTimeout(() => {
        void stopCamera().then(() => {
          if (mountedRef.current) {
            setMessage(
              "Kamera dihentikan otomatis setelah 90 detik. Tekan Coba Lagi untuk melanjutkan.",
            );
          }
        });
      }, 90_000);

      try {
        const capabilities = scanner.getRunningTrackCapabilities() as MediaTrackCapabilities & {
          torch?: boolean;
        };
        setTorchAvailable(Boolean(capabilities.torch));
      } catch {
        setTorchAvailable(false);
      }

      if (pendingDecodedText) {
        void handleDecoded(scanner, pendingDecodedText);
      }
    } catch (error) {
      console.error("[QrCameraScanner] scanner.start failed", error);

      if (startPromiseRef.current === startPromise) {
        startPromiseRef.current = null;
      }

      if (!mountedRef.current || operationRef.current !== operation) return;

      if (scannerRef.current === scanner) scannerRef.current = null;
      if (scanner) await releaseScanner(scanner);

      showCameraFailure(error, "scanner.start");
    }
  }

  async function stopCamera(): Promise<void> {
    if (cameraTimeoutRef.current) clearTimeout(cameraTimeoutRef.current);
    cameraTimeoutRef.current = null;
    operationRef.current += 1;
    processingRef.current = false;
    const scanner = scannerRef.current;
    const pendingStart = startPromiseRef.current;
    const preflightStream = preflightStreamRef.current;
    scannerRef.current = null;
    startPromiseRef.current = null;
    preflightStreamRef.current = null;

    setStatus("stopping");
    setMessage("Menghentikan akses kamera...");

    stopMediaStream(preflightStream);
    if (scanner) await releaseScanner(scanner, pendingStart);
    if (!mountedRef.current) return;

    setStatus("idle");
    setMessage("Kamera dihentikan. Input manual tetap dapat digunakan.");
    setTorchAvailable(false);
    setTorchEnabled(false);
  }

  async function toggleTorch(): Promise<void> {
    const scanner = scannerRef.current;
    if (!scanner?.isScanning || !torchAvailable) return;

    const nextValue = !torchEnabled;
    try {
      await scanner.applyVideoConstraints({
        advanced: [{ torch: nextValue } as MediaTrackConstraintSet],
      });
      setTorchEnabled(nextValue);
      setMessage(nextValue ? "Lampu kamera dinyalakan." : "Lampu kamera dimatikan.");
    } catch (error) {
      console.error("[QrCameraScanner] torch failed", error);
      setMessage("Lampu kamera tidak dapat diubah pada perangkat ini.");
    }
  }

  const cameraRunning = status === "requesting" || status === "active";
  const startDisabled =
    cameraRunning || status === "stopping" || status === "success";

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
            <Camera className="h-5 w-5 text-emerald-600" /> Scan dengan Kamera
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            Kamera hanya aktif setelah tombol mulai ditekan.
          </p>
        </div>
        <span
          className={`rounded-full px-3 py-1 text-xs font-medium ${STATUS_STYLES[status]}`}
        >
          {STATUS_LABELS[status]}
        </span>
      </div>

      <div className="relative min-h-64 overflow-hidden rounded-lg bg-slate-950">
        <div
          id={readerId}
          className="min-h-64 w-full overflow-hidden [&_video]:!w-full"
        />

        {!cameraRunning && (
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-3 bg-slate-950 px-6 text-center text-slate-300">
            <ScanLine className="h-12 w-12 text-emerald-400" />
            <p className="text-sm">Pratinjau kamera akan tampil di area ini.</p>
          </div>
        )}

        {status === "requesting" && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-slate-950/80 text-sm text-white">
            <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Menunggu izin kamera...
          </div>
        )}
      </div>

      <p
        aria-live="polite"
        className={`mt-4 rounded-md border px-3 py-2 text-sm ${
          status === "denied" || status === "error"
            ? "border-red-200 bg-red-50 text-red-700"
            : status === "unsupported"
              ? "border-amber-200 bg-amber-50 text-amber-800"
              : "border-slate-200 bg-slate-50 text-slate-700"
        }`}
      >
        {message}
      </p>

      <div className="mt-3 flex items-center gap-2 text-xs text-slate-500">
        <Volume2 className="h-4 w-4 text-emerald-700" />
        Scan berhasil memberi umpan balik bunyi atau getaran jika didukung perangkat.
      </div>

      {detectedCameras.length > 1 && (
        <label className="mt-4 block text-sm font-medium text-slate-700">
          Pilih kamera
          <select
            value={selectedCameraId}
            onChange={(event) => setSelectedCameraId(event.target.value)}
            disabled={cameraRunning}
            className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-3 text-sm outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 disabled:bg-slate-100"
          >
            {detectedCameras.map((camera, index) => (
              <option key={camera.id} value={camera.id}>
                {camera.label || `Kamera ${index + 1}`}
              </option>
            ))}
          </select>
          {cameraRunning && (
            <span className="mt-1 block text-xs text-slate-500">
              Hentikan kamera sebelum mengganti perangkat.
            </span>
          )}
        </label>
      )}

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <button
          type="button"
          onClick={() => void startCamera()}
          disabled={startDisabled}
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-emerald-400"
        >
          {status === "requesting" ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : status === "error" || status === "denied" || status === "unsupported" ? (
            <RefreshCw className="h-4 w-4" />
          ) : (
            <Camera className="h-4 w-4" />
          )}
          {status === "error" || status === "denied" || status === "unsupported"
            ? "Coba Lagi"
            : "Mulai Scan Kamera"}
        </button>
        <button
          type="button"
          onClick={() => void stopCamera()}
          disabled={!cameraRunning}
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:text-slate-400"
        >
          <CameraOff className="h-4 w-4" /> Hentikan Kamera
        </button>
        {cameraRunning && torchAvailable && (
          <button
            type="button"
            onClick={() => void toggleTorch()}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md border border-amber-300 bg-amber-50 px-4 py-2 text-sm font-medium text-amber-900 transition-colors hover:bg-amber-100 sm:col-span-2"
          >
            <Flashlight className="h-4 w-4" />
            {torchEnabled ? "Matikan Lampu" : "Nyalakan Lampu"}
          </button>
        )}
      </div>
    </section>
  );
}
