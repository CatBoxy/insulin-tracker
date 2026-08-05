import pool from "@/lib/db";
import { checkArmGate } from "@/services/messaging.service";
import { sendMessage } from "./sender";
import { matches } from "./cron-parser";

interface ScheduleRule {
  id: number;
  template_key: string;
  trigger_type: string;
  cron_expr: string | null;
  params: Record<string, unknown> | null;
}

interface SchedulerResult {
  evaluated: number;
  sent: number;
  suppressed: number;
  errors: number;
  details: Array<{ rule_id: number; patient_id: number; status: string; reason?: string }>;
}

function toArgentinaDate(date: Date): Date {
  const str = date.toLocaleString("en-US", { timeZone: "America/Argentina/San_Juan" });
  return new Date(str);
}

async function getActiveTemplate(templateKey: string) {
  const { rows } = await pool.query(
    `SELECT id, channel, body, variables FROM message_templates
     WHERE key = $1 AND active = true
     ORDER BY version DESC LIMIT 1`,
    [templateKey]
  );
  return rows[0] || null;
}

async function alreadySentToday(participantId: number, templateId: number): Promise<boolean> {
  const today = toArgentinaDate(new Date());
  const startOfDay = new Date(today);
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(today);
  endOfDay.setHours(23, 59, 59, 999);

  const { rows } = await pool.query(
    `SELECT 1 FROM messages
     WHERE participant_id = $1 AND template_id = $2
       AND scheduled_for BETWEEN $3 AND $4
       AND status IN ('queued', 'sent', 'delivered', 'read')
     LIMIT 1`,
    [participantId, templateId, startOfDay.toISOString(), endOfDay.toISOString()]
  );
  return rows.length > 0;
}

async function getCronCandidates(): Promise<number[]> {
  const { rows } = await pool.query(
    `SELECT sp.id AS participant_id, sp.patient_id
     FROM study_participants sp
     WHERE sp.arm = 'intervention' AND sp.withdrawn_at IS NULL`
  );
  return rows.map((r: { patient_id: number }) => r.patient_id);
}

async function getInactivityCandidates(daysThreshold: number): Promise<number[]> {
  const { rows } = await pool.query(
    `SELECT p.id AS patient_id FROM patients p
     JOIN study_participants sp ON sp.patient_id = p.id
     WHERE sp.arm = 'intervention' AND sp.withdrawn_at IS NULL
       AND (p.last_interaction_at IS NULL OR p.last_interaction_at < NOW() - ($1 || ' days')::INTERVAL)
       AND NOT EXISTS (
         SELECT 1 FROM measurements m WHERE m.patient_id = p.id
         AND m.recorded_at > NOW() - ($1 || ' days')::INTERVAL
       )`,
    [daysThreshold]
  );
  return rows.map((r: { patient_id: number }) => r.patient_id);
}

async function getAppointmentLeadCandidates(hoursBefore: number): Promise<number[]> {
  const { rows } = await pool.query(
    `SELECT DISTINCT a.patient_id FROM appointments a
     JOIN study_participants sp ON sp.patient_id = a.patient_id
     WHERE sp.arm = 'intervention' AND sp.withdrawn_at IS NULL
       AND a.status IN ('pending', 'confirmed')
       AND a.scheduled_at BETWEEN NOW() AND NOW() + ($1 || ' hours')::INTERVAL`,
    [hoursBefore]
  );
  return rows.map((r: { patient_id: number }) => r.patient_id);
}

async function getCheckupDueCandidates(daysBefore: number): Promise<number[]> {
  const { rows } = await pool.query(
    `SELECT DISTINCT pc.patient_id FROM patient_checkups pc
     JOIN study_participants sp ON sp.patient_id = pc.patient_id
     JOIN checkup_types ct ON ct.id = pc.checkup_type_id
     WHERE sp.arm = 'intervention' AND sp.withdrawn_at IS NULL
       AND pc.active = true
       AND COALESCE(pc.frequency_months_override, ct.default_frequency_months) IS NOT NULL
       AND pc.last_completed_at IS NOT NULL
       AND pc.last_completed_at + (COALESCE(pc.frequency_months_override, ct.default_frequency_months) || ' months')::INTERVAL
           BETWEEN NOW() AND NOW() + ($1 || ' days')::INTERVAL`,
    [daysBefore]
  );
  return rows.map((r: { patient_id: number }) => r.patient_id);
}

export async function runScheduler(): Promise<SchedulerResult> {
  const result: SchedulerResult = { evaluated: 0, sent: 0, suppressed: 0, errors: 0, details: [] };

  const { rows: rules } = await pool.query<ScheduleRule>(
    "SELECT id, template_key, trigger_type, cron_expr, params FROM message_schedule_rules WHERE active = true"
  );

  const now = new Date();
  const argNow = toArgentinaDate(now);

  for (const rule of rules) {
    // For cron rules, check if current time matches
    if (rule.trigger_type === "cron" && rule.cron_expr) {
      if (!matches(rule.cron_expr, argNow)) continue;
    }

    const template = await getActiveTemplate(rule.template_key);
    if (!template) continue;

    let candidatePatientIds: number[] = [];

    switch (rule.trigger_type) {
      case "cron":
        candidatePatientIds = await getCronCandidates();
        break;
      case "inactivity": {
        const days = (rule.params as { days_threshold?: number })?.days_threshold ?? 3;
        candidatePatientIds = await getInactivityCandidates(days);
        break;
      }
      case "appointment_lead": {
        const hours = (rule.params as { hours_before?: number })?.hours_before ?? 24;
        candidatePatientIds = await getAppointmentLeadCandidates(hours);
        break;
      }
      case "checkup_due": {
        const days = (rule.params as { days_before?: number })?.days_before ?? 7;
        candidatePatientIds = await getCheckupDueCandidates(days);
        break;
      }
    }

    for (const patientId of candidatePatientIds) {
      result.evaluated++;

      const gateResult = await checkArmGate(patientId);
      if (!gateResult.allowed) {
        result.suppressed++;
        result.details.push({ rule_id: rule.id, patient_id: patientId, status: "suppressed", reason: gateResult.reason });
        continue;
      }

      const already = await alreadySentToday(gateResult.participant.id, template.id);
      if (already) {
        result.suppressed++;
        result.details.push({ rule_id: rule.id, patient_id: patientId, status: "suppressed", reason: "Already sent today" });
        continue;
      }

      try {
        const sendResult = await sendMessage({
          patientId,
          templateId: template.id,
          channel: template.channel,
          renderedBody: template.body,
          variablesUsed: {},
          personalized: false,
          scheduledFor: now,
          triggerRuleId: rule.id,
          triggerContext: { trigger_type: rule.trigger_type },
        });

        if (sendResult.status === "suppressed") {
          result.suppressed++;
        } else {
          result.sent++;
        }
        result.details.push({ rule_id: rule.id, patient_id: patientId, status: sendResult.status, reason: sendResult.reason });
      } catch (err) {
        result.errors++;
        result.details.push({ rule_id: rule.id, patient_id: patientId, status: "error", reason: err instanceof Error ? err.message : "Unknown error" });
      }
    }
  }

  return result;
}
