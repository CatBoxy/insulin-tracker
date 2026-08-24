export type MeasurementContext = "fasting" | "postprandial" | "pre_dinner" | "random";

export type VitalStatus = "normal" | "warning" | "critical" | "emergency";

export const GLUCOSE_THRESHOLDS: Record<MeasurementContext, {
  warningHigh: number;
  criticalHigh: number;
  emergencyHigh: number;
}> = {
  fasting: { warningHigh: 140, criticalHigh: 180, emergencyHigh: 200 },
  pre_dinner: { warningHigh: 140, criticalHigh: 180, emergencyHigh: 200 },
  postprandial: { warningHigh: 180, criticalHigh: 250, emergencyHigh: 300 },
  random: { warningHigh: 180, criticalHigh: 250, emergencyHigh: 300 },
};

export const THRESHOLDS = {
  glucemia: {
    criticalLow: 54,
    warningLow: 70,
    warningHigh: 140,
    criticalHigh: 200,
    unit: "mg/dL",
  },
  systolic: {
    normal: 130,
    warning: 140,
    unit: "mmHg",
  },
  diastolic: {
    normal: 80,
    warning: 90,
    unit: "mmHg",
  },
};

export function getGlucemiaStatus(value: number, context?: MeasurementContext): VitalStatus {
  if (value < THRESHOLDS.glucemia.criticalLow) return "emergency";
  if (value < THRESHOLDS.glucemia.warningLow) return "warning";

  const ctx = context || "fasting";
  const thresholds = GLUCOSE_THRESHOLDS[ctx];

  if (value >= thresholds.emergencyHigh) return "emergency";
  if (value >= thresholds.criticalHigh) return "critical";
  if (value >= thresholds.warningHigh) return "warning";
  return "normal";
}

export function getSystolicStatus(value: number): VitalStatus {
  if (value > THRESHOLDS.systolic.warning) return "critical";
  if (value >= THRESHOLDS.systolic.normal) return "warning";
  return "normal";
}

export function getDiastolicStatus(value: number): VitalStatus {
  if (value > THRESHOLDS.diastolic.warning) return "critical";
  if (value >= THRESHOLDS.diastolic.normal) return "warning";
  return "normal";
}

export function getBloodPressureStatus(systolic: number, diastolic: number): VitalStatus {
  if (systolic > 180 || diastolic > 120) return "emergency";
  const s = getSystolicStatus(systolic);
  const d = getDiastolicStatus(diastolic);
  if (s === "critical" || d === "critical") return "critical";
  if (s === "warning" || d === "warning") return "warning";
  return "normal";
}

export const statusColors: Record<VitalStatus, { bg: string; text: string; dot: string }> = {
  normal: { bg: "bg-green-50", text: "text-green-700", dot: "bg-green-500" },
  warning: { bg: "bg-yellow-50", text: "text-yellow-700", dot: "bg-yellow-500" },
  critical: { bg: "bg-red-50", text: "text-red-700", dot: "bg-red-500" },
  emergency: { bg: "bg-red-100", text: "text-red-900", dot: "bg-red-700" },
};

export const CONTEXT_LABELS: Record<MeasurementContext, string> = {
  fasting: "En ayunas",
  postprandial: "2hs después de almuerzo",
  pre_dinner: "Antes de cenar",
  random: "Al azar",
};
