import pool from "./db";
import { THRESHOLDS, GLUCOSE_THRESHOLDS, CONTEXT_LABELS, getGlucemiaStatus, type VitalStatus, type MeasurementContext } from "./thresholds";

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";

const EMERGENCY_INSTRUCTION = "Dirigirse a la guardia de urgencias más cercana.";

interface MeasurementData {
  id: number;
  patient_id: number;
  type: string;
  value: number;
  context?: string;
  notes?: string;
  systolic?: number;
  diastolic?: number;
}

export interface AlertResult {
  status: VitalStatus;
  title: string;
  message: string;
}

async function sendEmergencyPush(patientId: number, title: string, body: string) {
  try {
    const { rows } = await pool.query<{ token: string }>(
      "SELECT token FROM device_tokens WHERE user_id = (SELECT user_id FROM patients WHERE id = $1)",
      [patientId]
    );
    if (rows.length === 0) return;

    const messages = rows.map(r => ({
      to: r.token,
      title,
      body,
      sound: "default" as const,
      priority: "high" as const,
    }));

    await fetch(EXPO_PUSH_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(messages),
    });
  } catch (err) {
    console.error("Emergency push failed:", err);
  }
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

      if (v < THRESHOLDS.glucemia.criticalLow) {
        title = "⚠️ Glucemia peligrosamente baja";
        message = `${v} ${THRESHOLDS.glucemia.unit} (${contextLabel}). ${EMERGENCY_INSTRUCTION}`;
      } else if (v < THRESHOLDS.glucemia.warningLow) {
        title = "Glucemia baja";
        message = `${v} ${THRESHOLDS.glucemia.unit} (${contextLabel}) — mínimo: ${THRESHOLDS.glucemia.warningLow}`;
      } else if (v >= thresholds.emergencyHigh) {
        title = "⚠️ Glucemia peligrosamente alta";
        message = `${v} ${THRESHOLDS.glucemia.unit} (${contextLabel}). ${EMERGENCY_INSTRUCTION}`;
      } else if (v >= thresholds.criticalHigh) {
        title = "Glucemia alta — atención";
        message = `${v} ${THRESHOLDS.glucemia.unit} (${contextLabel}) — máximo: ${thresholds.criticalHigh}`;
      } else if (v >= thresholds.warningHigh) {
        title = "Glucemia elevada";
        message = `${v} ${THRESHOLDS.glucemia.unit} (${contextLabel}) — máximo: ${thresholds.warningHigh}`;
      }
    }

    if (measurement.type === "blood_pressure") {
      const systolic = measurement.systolic ?? measurement.value;
      const diastolic = measurement.diastolic ?? 0;

      if (systolic > 180 || diastolic > 120) {
        title = "⚠️ Presión arterial peligrosa";
        message = `${systolic}/${diastolic} ${THRESHOLDS.systolic.unit}. ${EMERGENCY_INSTRUCTION}`;
        severity = "emergency";
      } else if (systolic > THRESHOLDS.systolic.warning || diastolic > THRESHOLDS.diastolic.warning) {
        title = "Presión arterial elevada";
        message = `${systolic}/${diastolic} ${THRESHOLDS.systolic.unit}`;
        severity = "critical";
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

      if (severity === "emergency") {
        await sendEmergencyPush(measurement.patient_id, title, message);
      }

      return { status: severity, title, message };
    }

    return null;
  } catch (err) {
    console.error("Alert check error:", err);
    return null;
  }
}
