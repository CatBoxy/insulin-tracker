import pool from "@/lib/db";
import { checkArmGate } from "@/services/messaging.service";
import { sendMessage } from "./sender";
import { personalizeMessage } from "./personalize";
import { logProvenance } from "./provenance";
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

/**
 * For inactivity messages: fire once, not daily, until the patient interacts
 * again. Returns true if an inactivity message was already sent AFTER the
 * patient's last interaction (meaning the patient hasn't cleared the condition).
 */
async function inactivityAlreadyFired(patientId: number, templateId: number): Promise<boolean> {
  const { rows } = await pool.query(
    `SELECT 1 FROM messages m
     JOIN study_participants sp ON sp.id = m.participant_id
     JOIN patients p ON p.id = sp.patient_id
     WHERE sp.patient_id = $1
       AND m.template_id = $2
       AND m.status IN ('queued', 'sent', 'delivered', 'read')
       AND (
         p.last_interaction_at IS NULL
         OR m.created_at > p.last_interaction_at
       )
     LIMIT 1`,
    [patientId, templateId]
  );
  return rows.length > 0;
}

async function measurementAlreadyLoggedToday(patientId: number, context: string): Promise<boolean> {
  const today = toArgentinaDate(new Date());
  const startOfDay = new Date(today);
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(today);
  endOfDay.setHours(23, 59, 59, 999);

  const { rows } = await pool.query(
    `SELECT 1 FROM measurements
     WHERE patient_id = $1 AND type = 'glucemia' AND context = $2
       AND recorded_at BETWEEN $3 AND $4
     LIMIT 1`,
    [patientId, context, startOfDay.toISOString(), endOfDay.toISOString()]
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

      // Inactivity rules fire once until the condition clears (patient interacts again).
      // Other rules use the standard "already sent today" dedup.
      if (rule.trigger_type === "inactivity") {
        const fired = await inactivityAlreadyFired(patientId, template.id);
        if (fired) {
          result.suppressed++;
          result.details.push({ rule_id: rule.id, patient_id: patientId, status: "suppressed", reason: "Inactivity message already sent (awaiting patient interaction)" });
          continue;
        }
      } else {
        const already = await alreadySentToday(gateResult.participant.id, template.id);
        if (already) {
          result.suppressed++;
          result.details.push({ rule_id: rule.id, patient_id: patientId, status: "suppressed", reason: "Already sent today" });
          continue;
        }
      }

      const measContext = (rule.params as { measurement_context?: string })?.measurement_context;
      if (measContext) {
        const logged = await measurementAlreadyLoggedToday(patientId, measContext);
        if (logged) {
          result.suppressed++;
          result.details.push({ rule_id: rule.id, patient_id: patientId, status: "suppressed", reason: `Measurement ${measContext} already logged today` });
          continue;
        }
      }

      try {
        const participant = gateResult.participant;
        const { rows: nameRows } = await pool.query<{ first_name: string | null }>(
          `SELECT u.first_name FROM patients p JOIN users u ON u.id = p.user_id WHERE p.id = $1`,
          [patientId]
        );
        const patientName = nameRows[0]?.first_name || participant.participant_code;

        const personalization = await personalizeMessage(
          template.body,
          Array.isArray(template.variables) ? template.variables : [],
          { patientName, participantCode: participant.participant_code }
        );

        const sendResult = await sendMessage({
          patientId,
          templateId: template.id,
          channel: template.channel,
          renderedBody: personalization.body,
          variablesUsed: personalization.variablesUsed,
          personalized: personalization.personalized,
          scheduledFor: now,
          triggerRuleId: rule.id,
          triggerContext: { trigger_type: rule.trigger_type },
        });

        // Log provenance for every sent message
        if (sendResult.messageId && personalization.provenance) {
          await logProvenance({
            messageId: sendResult.messageId,
            modelId: personalization.provenance.modelId,
            templateKey: rule.template_key,
            templateVersion: template.version || 1,
            promptInputs: personalization.provenance.promptInputs,
            rawModelOutput: personalization.provenance.rawModelOutput,
            guardrailsModified: personalization.provenance.guardrailsModified,
            guardrailsRejected: personalization.provenance.guardrailsRejected,
            fallbackUsed: personalization.provenance.fallbackUsed,
            finalBody: personalization.body,
          }).catch(err => console.error("Provenance log failed:", err));
        }

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
