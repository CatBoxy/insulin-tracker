/**
 * Unified message sender.
 *
 * Orchestrates every outbound message regardless of channel:
 *  1. Arm gate check  (control-arm patients are never messaged)
 *  2. Channel lookup   (patient must have an active, opted-in channel)
 *  3. Adapter send     (delegates to the registered Channel adapter)
 *  4. Persistence      (writes to `messages` with status + provider id)
 *
 * Suppressions (arm refusal, missing/inactive/opted-out channel) are
 * recorded with status='suppressed' and a human-readable reason — never
 * silently dropped.
 *
 * Adding a new channel requires only a new adapter + registerChannel().
 * This file never changes.
 */

import pool from "@/lib/db";
import { checkArmGate } from "@/services/messaging.service";
import { getChannel } from "./registry";
import { recordEvent } from "./events";

interface SendMessageParams {
  patientId: number;
  templateId: number;
  channel: string;
  renderedBody: string;
  variablesUsed: Record<string, unknown>;
  personalized: boolean;
  scheduledFor: Date;
  triggerRuleId?: number;
  triggerContext?: Record<string, unknown>;
}

interface SendMessageResult {
  messageId: number;
  status: string;
  reason?: string;
}

/**
 * Insert a message row and return its id.
 */
async function insertMessage(
  participantId: number,
  params: SendMessageParams,
  status: string,
  providerMsgId: string | null,
  suppressedReason: string | null
): Promise<number> {
  const { rows } = await pool.query<{ id: number }>(
    `INSERT INTO messages
       (participant_id, template_id, channel, trigger_rule_id, trigger_context,
        rendered_body, variables_used, personalized, scheduled_for,
        status, provider_msg_id, suppressed_reason)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
     RETURNING id`,
    [
      participantId,
      params.templateId,
      params.channel,
      params.triggerRuleId ?? null,
      params.triggerContext ? JSON.stringify(params.triggerContext) : null,
      params.renderedBody,
      JSON.stringify(params.variablesUsed),
      params.personalized,
      params.scheduledFor,
      status,
      providerMsgId,
      suppressedReason,
    ]
  );
  return rows[0].id;
}

/**
 * Send a message through the channel abstraction.
 *
 * This is the single entry point for every outbound message.
 * It enforces the arm gate, verifies channel eligibility, delegates
 * to the adapter, and persists the result.
 */
export async function sendMessage(
  params: SendMessageParams
): Promise<SendMessageResult> {
  // ── 1. Arm gate ──────────────────────────────────────────────
  const gate = await checkArmGate(params.patientId);

  if (!gate.allowed) {
    // We don't have participantId when the gate refuses (patient may not
    // be enrolled), but the messages table requires participant_id.
    // Suppressed messages for non-enrolled patients are already logged
    // in message_send_refusals by checkArmGate, so we return early.
    return {
      messageId: 0,
      status: "suppressed",
      reason: gate.reason,
    };
  }

  const participantId = gate.participant.id;

  // ── 2. Channel eligibility ──────────────────────────────────
  const { rows: channelRows } = await pool.query<{
    identifier: string;
    opted_in: boolean;
    active: boolean;
  }>(
    `SELECT identifier, opted_in, active
     FROM patient_channels
     WHERE patient_id = $1 AND channel = $2
     LIMIT 1`,
    [params.patientId, params.channel]
  );

  const patientChannel = channelRows[0] ?? null;

  if (!patientChannel) {
    const reason = `No ${params.channel} channel configured for patient`;
    const messageId = await insertMessage(
      participantId,
      params,
      "suppressed",
      null,
      reason
    );
    return { messageId, status: "suppressed", reason };
  }

  if (!patientChannel.active) {
    const reason = `Channel ${params.channel} is inactive for patient`;
    const messageId = await insertMessage(
      participantId,
      params,
      "suppressed",
      null,
      reason
    );
    return { messageId, status: "suppressed", reason };
  }

  if (!patientChannel.opted_in) {
    const reason = `Patient has not opted in to ${params.channel}`;
    const messageId = await insertMessage(
      participantId,
      params,
      "suppressed",
      null,
      reason
    );
    return { messageId, status: "suppressed", reason };
  }

  // ── 3. Resolve adapter ──────────────────────────────────────
  const adapter = getChannel(params.channel);

  if (!adapter) {
    const reason = `No adapter registered for channel "${params.channel}"`;
    const messageId = await insertMessage(
      participantId,
      params,
      "failed",
      null,
      reason
    );
    return { messageId, status: "failed", reason };
  }

  // ── 4. Send via adapter ─────────────────────────────────────
  const result = await adapter.send({
    to: patientChannel.identifier,
    body: params.renderedBody,
  });

  if (!result.success) {
    const messageId = await insertMessage(
      participantId,
      params,
      "failed",
      null,
      result.error ?? "Adapter returned failure"
    );
    await recordEvent(messageId, "send_failed", new Date(), {
      error: result.error,
    });
    return {
      messageId,
      status: "failed",
      reason: result.error ?? "Adapter returned failure",
    };
  }

  // ── 5. Success ──────────────────────────────────────────────
  const messageId = await insertMessage(
    participantId,
    params,
    "sent",
    result.providerMsgId ?? null,
    null
  );
  await recordEvent(messageId, "sent", new Date());

  return { messageId, status: "sent" };
}
