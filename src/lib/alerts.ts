import pool from "./db";
import { THRESHOLDS, GLUCOSE_THRESHOLDS, CONTEXT_LABELS, getGlucemiaStatus, type VitalStatus, type MeasurementContext } from "./thresholds";

interface MeasurementData {
  id: number;
  patient_id: number;
  type: string;
  value: number;
  context?: string;
  notes?: string;
}

export interface AlertResult {
  status: VitalStatus;
  title: string;
  message: string;
}

export async function checkAndCreateAlert(measurement: MeasurementData): Promise<AlertResult | null> {
  try {
    let title = "";
    let message = "";
    let severity: VitalStatus = "warning";

    if (measurement.type === "glucemia") {
      const v = measurement.value;
      const ctx = (measurement.context as MeasurementContext) || "fasting";
      const thresholds = GLUCOSE_THRESHOLDS[ctx];
      const contextLabel = CONTEXT_LABELS[ctx];

      severity = getGlucemiaStatus(v, ctx);

      if (v < THRESHOLDS.glucemia.warningLow) {
        title = "Glucemia baja";
        message = `${v} ${THRESHOLDS.glucemia.unit} (${contextLabel}) — mínimo: ${THRESHOLDS.glucemia.warningLow}`;
      } else if (v >= thresholds.emergencyHigh) {
        title = "Glucemia muy alta — consulte urgente";
        message = `${v} ${THRESHOLDS.glucemia.unit} (${contextLabel}) — máximo: ${thresholds.emergencyHigh}`;
      } else if (v >= thresholds.criticalHigh) {
        title = "Glucemia alta — atención";
        message = `${v} ${THRESHOLDS.glucemia.unit} (${contextLabel}) — máximo: ${thresholds.criticalHigh}`;
      } else if (v >= thresholds.warningHigh) {
        title = "Glucemia elevada";
        message = `${v} ${THRESHOLDS.glucemia.unit} (${contextLabel}) — máximo: ${thresholds.warningHigh}`;
      }
    }

    if (measurement.type === "blood_pressure") {
      const systolic = measurement.value;
      const diastolicMatch = measurement.notes?.match(/diastolic:(\d+)/);
      const diastolic = diastolicMatch ? Number(diastolicMatch[1]) : 0;
      if (systolic > THRESHOLDS.systolic.warning || diastolic > THRESHOLDS.diastolic.warning) {
        title = "Presión arterial elevada";
        message = `${systolic}/${diastolic} ${THRESHOLDS.systolic.unit}`;
        severity = systolic > THRESHOLDS.systolic.warning ? "critical" : "warning";
      } else if (systolic >= THRESHOLDS.systolic.normal || diastolic >= THRESHOLDS.diastolic.normal) {
        title = "Presión arterial elevada";
        message = `${systolic}/${diastolic} ${THRESHOLDS.systolic.unit}`;
        severity = "warning";
      }
    }

    if (title) {
      const dbSeverity = severity === "emergency" ? "critical" : severity;
      await pool.query(
        `INSERT INTO alerts (patient_id, type, severity, title, message)
         VALUES ($1, 'measurement_critical', $2, $3, $4)`,
        [measurement.patient_id, dbSeverity, title, message]
      );
      return { status: severity, title, message };
    }

    return null;
  } catch (err) {
    console.error("Alert check error:", err);
    return null;
  }
}
