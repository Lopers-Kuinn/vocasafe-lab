import type {
  RiskLevel,
  RiskScoringInput,
  RiskScoringResult,
} from "../types";

const RECOMMENDATIONS: Record<RiskLevel, string> = {
  rendah: "Pantau kondisi secara berkala.",
  sedang: "Jadwalkan pemeriksaan oleh teknisi atau laboran.",
  tinggi:
    "Batasi penggunaan alat atau area sampai dilakukan pemeriksaan.",
  kritis:
    "Hentikan penggunaan alat atau area sampai diperiksa dan diperbaiki oleh teknisi.",
};

function assertScaleValue(label: string, value: number): void {
  if (!Number.isInteger(value) || value < 1 || value > 5) {
    throw new RangeError(
      `${label} harus berupa bilangan bulat antara 1 dan 5.`,
    );
  }
}

export function getRiskCategory(score: number): RiskLevel {
  if (score <= 20) return "rendah";
  if (score <= 50) return "sedang";
  if (score <= 80) return "tinggi";
  return "kritis";
}

export function calculateRiskScore(
  input: RiskScoringInput,
): RiskScoringResult {
  assertScaleValue("Severity", input.severity);
  assertScaleValue("Probability", input.probability);
  assertScaleValue("Exposure", input.exposure);

  const score = input.severity * input.probability * input.exposure;
  const category = getRiskCategory(score);

  return {
    score,
    category,
    recommendation: RECOMMENDATIONS[category],
  };
}
