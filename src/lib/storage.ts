"use server";

export async function getReportEvidenceBucket(): Promise<{
  bucket: string | null;
  error: string | null;
}> {
  const bucket = process.env.SUPABASE_STORAGE_BUCKET?.trim();

  if (!bucket) {
    return {
      bucket: null,
      error:
        "Layanan unggah foto sedang tidak tersedia.",
    };
  }

  return { bucket, error: null };
}
