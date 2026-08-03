/**
 * Message event recording.
 *
 * Webhook handlers and internal status updates call these functions
 * to persist delivery events (sent, delivered, read, failed, etc.)
 * and update the message's current status.
 *
 * recordEvent is idempotent — the UNIQUE(message_id, event, occurred_at)
 * constraint prevents duplicates from webhook retries.
 */

import pool from "@/lib/db";

/**
 * Record a delivery event for a message.
 *
 * Idempotent: duplicate (message_id, event, occurred_at) rows are
 * silently ignored via ON CONFLICT DO NOTHING.
 */
export async function recordEvent(
  messageId: number,
  event: string,
  occurredAt: Date,
  rawPayload?: unknown
): Promise<void> {
  await pool.query(
    `INSERT INTO message_events (message_id, event, occurred_at, raw_payload)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (message_id, event, occurred_at) DO NOTHING`,
    [messageId, event, occurredAt, rawPayload ? JSON.stringify(rawPayload) : null]
  );
}

/**
 * Update the top-level status on a message row.
 */
export async function updateMessageStatus(
  messageId: number,
  status: string
): Promise<void> {
  await pool.query(
    `UPDATE messages SET status = $1 WHERE id = $2`,
    [status, messageId]
  );
}
