import pool from "./db";
import { THRESHOLDS, GLUCOSE_THRESHOLDS, CONTEXT_LABELS, getGlucemiaStatus, type VitalStatus, type MeasurementContext } from "./thresholds";
import { sendEmail, doctorAlertEmailHtml } from "@/services/email.service";

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

async function sendPushToUser(userId: number, title: string, body: string) {
  const { rows } = await pool.query<{ token: string }>(
    "SELECT token FROM device_tokens WHERE user_id = $1",
    [userId]
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
}

async function sendEmergencyPush(patientId: number, title: string, body: string) {
  try {
    const { rows } = await pool.query<{ user_id: number }>(
      "SELECT user_id FROM patients WHERE id = $1",
      [patientId]
    );
    if (rows.length === 0) return;
    await sendPushToUser(rows[0].user_id, title, body);
  } catch (err) {
    console.error("Emergency push failed:", err);
  }
}

async function notifyLinkedDoctors(patientId: number, severity: VitalStatus, title: string, message: string) {
  try {
    const { rows } = await pool.query<{ user_id: number; email: string; first_name: string }>(
      `SELECT d.user_id, u.email, u.first_name
       FROM patient_doctor pd
       JOIN doctors d ON d.id = pd.doctor_id
       JOIN users u ON u.id = d.user_id
       WHERE pd.patient_id = $1 AND pd.status = 'active'`,
      [patientId]
    );
    if (rows.length === 0) return;

    const { rows: patientRows } = await pool.query<{ first_name: string; last_name: string }>(
      "SELECT u.first_name, u.last_name FROM patients p JOIN users u ON u.id = p.user_id WHERE p.id = $1",
      [patientId]
    );
    const patientName = patientRows.length > 0
      ? `${patientRows[0].first_name} ${patientRows[0].last_name}`.trim()
      : "Paciente";

    const doctorTitle = `🚨 ${patientName}: ${title.replace(/⚠️\s*/, "")}`;

    for (const doctor of rows) {
      sendPushToUser(doctor.user_id, doctorTitle, message).catch(err =>
        console.error(`Doctor push failed for user ${doctor.user_id}:`, err)
      );

      if (severity === "emergency" || severity === "critical") {
        sendEmail({
          to: doctor.email,
          subject: doctorTitle,
          html: doctorAlertEmailHtml(doctor.first_name || "Doctor", patientName, title, message),
        }).catch(err => console.error(`Doctor alert email failed for ${doctor.email}:`, err));
      }
    }
  } catch (err) {
    console.error("Doctor notification failed:", err);
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

      if (severity === "critical" || severity === "emergency") {
        notifyLinkedDoctors(measurement.patient_id, severity, title, message);
      }

      return { status: severity, title, message };
    }

    return null;
  } catch (err) {
    console.error("Alert check error:", err);
    return null;
  }
}
