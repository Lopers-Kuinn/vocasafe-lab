"use client";

const OPTIMIZE_THRESHOLD_BYTES = 1.5 * 1024 * 1024;
const MAX_EVIDENCE_DIMENSION = 1600;
const QUALITY_STEPS = [0.82, 0.72, 0.62] as const;

export interface OptimizedEvidenceImage {
  file: File;
  optimized: boolean;
  originalBytes: number;
}

function optimizedFileName(fileName: string): string {
  const base = fileName.replace(/\.[^.]+$/, "").trim() || "foto-bukti";
  return `${base}-optimized.webp`;
}

function canvasToBlob(
  canvas: HTMLCanvasElement,
  type: string,
  quality: number,
): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, type, quality));
}

/**
 * Reduces large field photos before they enter IndexedDB or Supabase Storage.
 * The original file is returned whenever optimization is unsupported or does
 * not produce a smaller result, so evidence capture never depends on canvas.
 */
export async function optimizeEvidenceImage(
  file: File,
): Promise<OptimizedEvidenceImage> {
  const originalBytes = file.size;
  if (!file.type.startsWith("image/") || file.size <= OPTIMIZE_THRESHOLD_BYTES) {
    return { file, optimized: false, originalBytes };
  }

  let bitmap: ImageBitmap | null = null;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
    const scale = Math.min(
      1,
      MAX_EVIDENCE_DIMENSION / Math.max(bitmap.width, bitmap.height),
    );
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    if (!context) return { file, optimized: false, originalBytes };

    context.drawImage(bitmap, 0, 0, width, height);
    let smallest: Blob | null = null;
    for (const quality of QUALITY_STEPS) {
      const candidate = await canvasToBlob(canvas, "image/webp", quality);
      if (candidate && (!smallest || candidate.size < smallest.size)) {
        smallest = candidate;
      }
      if (candidate && candidate.size <= OPTIMIZE_THRESHOLD_BYTES) break;
    }

    if (!smallest || smallest.size >= file.size) {
      return { file, optimized: false, originalBytes };
    }

    return {
      file: new File([smallest], optimizedFileName(file.name), {
        type: "image/webp",
        lastModified: file.lastModified,
      }),
      optimized: true,
      originalBytes,
    };
  } catch {
    return { file, optimized: false, originalBytes };
  } finally {
    bitmap?.close();
  }
}
