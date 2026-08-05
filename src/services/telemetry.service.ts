import pool from "@/lib/db";

// ---- Message lifecycle ----

interface MessageEvent {
  id: number;
  message_id: number;
  event: string;
  occurred_at: string;
  raw_payload: unknown;
}

export async function getMessageLifecycle(messageId: number): Promise<MessageEvent[]> {
  const { rows } = await pool.query(
    `SELECT id, message_id, event, occurred_at, raw_payload
     FROM message_events
     WHERE message_id = $1
     ORDER BY occurred_at ASC`,
    [messageId]
  );
  return rows;
}

// ---- Per-participant message stats ----

interface ParticipantMessageStats {
  totalSent: number;
  totalDelivered: number;
  totalRead: number;
  totalActedUpon: number;
  deliveryRate: number;
  readRate: number;
  responseRate: number;
}

export async function getParticipantMessageStats(
  participantId: number,
  from?: string,
  to?: string
): Promise<ParticipantMessageStats> {
  let dateFilter = "";
  const params: (number | string)[] = [participantId];

  if (from) {
    params.push(from);
    dateFilter += ` AND m.scheduled_for >= $${params.length}::timestamptz`;
  }
  if (to) {
    params.push(to);
    dateFilter += ` AND m.scheduled_for < $${params.length}::timestamptz`;
  }

  const { rows } = await pool.query(
    `SELECT
       COUNT(*) FILTER (WHERE m.status IN ('sent','delivered','read'))::int AS total_sent,
       COUNT(*) FILTER (WHERE m.status IN ('delivered','read'))::int AS total_delivered,
       COUNT(*) FILTER (WHERE m.status = 'read')::int AS total_read
     FROM messages m
     WHERE m.participant_id = $1
       AND m.status NOT IN ('queued','suppressed')
       ${dateFilter}`,
    params
  );

  const { total_sent, total_delivered, total_read } = rows[0];

  // Count acted-upon messages (measurement within 4 hours of delivery)
  const { rows: actedRows } = await pool.query(
    `SELECT COUNT(DISTINCT m.id)::int AS acted
     FROM messages m
     JOIN study_participants sp ON sp.id = m.participant_id
     JOIN message_events me ON me.message_id = m.id AND me.event = 'delivered'
     WHERE m.participant_id = $1
       AND m.status NOT IN ('queued','suppressed')
       ${dateFilter}
       AND EXISTS (
         SELECT 1 FROM measurements ms
         WHERE ms.patient_id = sp.patient_id
           AND ms.recorded_at >= me.occurred_at
           AND ms.recorded_at <= me.occurred_at + INTERVAL '4 hours'
       )`,
    params
  );

  const totalActedUpon = actedRows[0].acted;

  return {
    totalSent: total_sent,
    totalDelivered: total_delivered,
    totalRead: total_read,
    totalActedUpon,
    deliveryRate: total_sent > 0 ? total_delivered / total_sent : 0,
    readRate: total_delivered > 0 ? total_read / total_delivered : 0,
    responseRate: total_read > 0 ? totalActedUpon / total_read : 0,
  };
}

// ---- Acted-upon check for a single message ----

interface ActedUponResult {
  actedUpon: boolean;
  measurementId?: number;
  hoursAfter?: number;
}

const DEFAULT_ACTED_UPON_WINDOW_HOURS = 4;

export async function getActedUpon(
  messageId: number,
  windowHours: number = DEFAULT_ACTED_UPON_WINDOW_HOURS
): Promise<ActedUponResult> {
  const { rows } = await pool.query(
    `SELECT ms.id AS measurement_id,
            EXTRACT(EPOCH FROM (ms.recorded_at - me.occurred_at)) / 3600 AS hours_after
     FROM messages m
     JOIN study_participants sp ON sp.id = m.participant_id
     JOIN message_events me ON me.message_id = m.id AND me.event = 'delivered'
     JOIN measurements ms ON ms.patient_id = sp.patient_id
       AND ms.recorded_at >= me.occurred_at
       AND ms.recorded_at <= me.occurred_at + ($2 || ' hours')::interval
     WHERE m.id = $1
     ORDER BY ms.recorded_at ASC
     LIMIT 1`,
    [messageId, windowHours]
  );

  if (rows.length === 0) {
    return { actedUpon: false };
  }

  return {
    actedUpon: true,
    measurementId: rows[0].measurement_id,
    hoursAfter: parseFloat(Number(rows[0].hours_after).toFixed(2)),
  };
}

// ---- Weekly engagement per participant ----

interface WeeklyEngagementRow {
  iso_week: string;
  messages_received: number;
  messages_opened: number;
  response_rate: number;
  active_days: number;
  sessions_count: number;
  measurements_count: number;
}

export async function getWeeklyEngagement(
  participantId: number,
  from: string,
  to: string
): Promise<WeeklyEngagementRow[]> {
  const { rows } = await pool.query(
    `WITH weeks AS (
       SELECT generate_series(
         date_trunc('week', $2::timestamptz),
         date_trunc('week', $3::timestamptz),
         '1 week'::interval
       ) AS week_start
     ),
     participant AS (
       SELECT patient_id FROM study_participants WHERE id = $1
     ),
     msg_stats AS (
       SELECT
         date_trunc('week', m.scheduled_for) AS week_start,
         COUNT(*) FILTER (WHERE m.status IN ('sent','delivered','read'))::int AS received,
         COUNT(*) FILTER (WHERE m.status = 'read')::int AS opened,
         COUNT(DISTINCT m.id) FILTER (
           WHERE EXISTS (
             SELECT 1 FROM message_events me
             JOIN measurements ms ON ms.patient_id = (SELECT patient_id FROM participant)
               AND ms.recorded_at >= me.occurred_at
               AND ms.recorded_at <= me.occurred_at + INTERVAL '4 hours'
             WHERE me.message_id = m.id AND me.event = 'delivered'
           )
         )::int AS acted
       FROM messages m
       WHERE m.participant_id = $1
         AND m.scheduled_for >= $2::timestamptz
         AND m.scheduled_for < $3::timestamptz
       GROUP BY date_trunc('week', m.scheduled_for)
     ),
     session_stats AS (
       SELECT
         date_trunc('week', s.started_at) AS week_start,
         COUNT(DISTINCT s.started_at::date)::int AS active_days,
         COUNT(*)::int AS sessions_count
       FROM app_sessions s
       WHERE s.patient_id = (SELECT patient_id FROM participant)
         AND s.started_at >= $2::timestamptz
         AND s.started_at < $3::timestamptz
       GROUP BY date_trunc('week', s.started_at)
     ),
     meas_stats AS (
       SELECT
         date_trunc('week', ms.recorded_at) AS week_start,
         COUNT(*)::int AS measurements_count
       FROM measurements ms
       WHERE ms.patient_id = (SELECT patient_id FROM participant)
         AND ms.recorded_at >= $2::timestamptz
         AND ms.recorded_at < $3::timestamptz
       GROUP BY date_trunc('week', ms.recorded_at)
     )
     SELECT
       TO_CHAR(w.week_start, 'IYYY-"W"IW') AS iso_week,
       COALESCE(ms.received, 0) AS messages_received,
       COALESCE(ms.opened, 0) AS messages_opened,
       CASE WHEN COALESCE(ms.received, 0) > 0
         THEN ROUND(COALESCE(ms.acted, 0)::numeric / ms.received, 4)
         ELSE 0 END AS response_rate,
       COALESCE(ss.active_days, 0) AS active_days,
       COALESCE(ss.sessions_count, 0) AS sessions_count,
       COALESCE(mss.measurements_count, 0) AS measurements_count
     FROM weeks w
     LEFT JOIN msg_stats ms ON ms.week_start = w.week_start
     LEFT JOIN session_stats ss ON ss.week_start = w.week_start
     LEFT JOIN meas_stats mss ON mss.week_start = w.week_start
     ORDER BY w.week_start`,
    [participantId, from, to]
  );

  return rows.map(r => ({
    iso_week: r.iso_week,
    messages_received: parseInt(r.messages_received, 10),
    messages_opened: parseInt(r.messages_opened, 10),
    response_rate: parseFloat(r.response_rate),
    active_days: parseInt(r.active_days, 10),
    sessions_count: parseInt(r.sessions_count, 10),
    measurements_count: parseInt(r.measurements_count, 10),
  }));
}

// ---- Study overview (aggregate) ----

interface StudyOverview {
  totalSent: number;
  totalDelivered: number;
  totalRead: number;
  totalActedUpon: number;
  deliveryRate: number;
  readRate: number;
  responseRate: number;
  byChannel: { channel: string; sent: number; delivered: number; read: number }[];
  byTemplate: { template_key: string; count: number }[];
}

export async function getStudyOverview(): Promise<StudyOverview> {
  const { rows: totals } = await pool.query(
    `SELECT
       COUNT(*) FILTER (WHERE status IN ('sent','delivered','read'))::int AS total_sent,
       COUNT(*) FILTER (WHERE status IN ('delivered','read'))::int AS total_delivered,
       COUNT(*) FILTER (WHERE status = 'read')::int AS total_read
     FROM messages
     WHERE status NOT IN ('queued','suppressed')`
  );

  const { total_sent, total_delivered, total_read } = totals[0];

  // Acted upon count
  const { rows: actedRows } = await pool.query(
    `SELECT COUNT(DISTINCT m.id)::int AS acted
     FROM messages m
     JOIN study_participants sp ON sp.id = m.participant_id
     JOIN message_events me ON me.message_id = m.id AND me.event = 'delivered'
     WHERE m.status NOT IN ('queued','suppressed')
       AND EXISTS (
         SELECT 1 FROM measurements ms
         WHERE ms.patient_id = sp.patient_id
           AND ms.recorded_at >= me.occurred_at
           AND ms.recorded_at <= me.occurred_at + INTERVAL '4 hours'
       )`
  );

  const totalActedUpon = actedRows[0].acted;

  // By channel
  const { rows: byChannel } = await pool.query(
    `SELECT
       channel,
       COUNT(*) FILTER (WHERE status IN ('sent','delivered','read'))::int AS sent,
       COUNT(*) FILTER (WHERE status IN ('delivered','read'))::int AS delivered,
       COUNT(*) FILTER (WHERE status = 'read')::int AS read
     FROM messages
     WHERE status NOT IN ('queued','suppressed')
     GROUP BY channel
     ORDER BY channel`
  );

  // By template key
  const { rows: byTemplate } = await pool.query(
    `SELECT
       mt.key AS template_key,
       COUNT(*)::int AS count
     FROM messages m
     JOIN message_templates mt ON mt.id = m.template_id
     WHERE m.status NOT IN ('queued','suppressed')
     GROUP BY mt.key
     ORDER BY count DESC`
  );

  return {
    totalSent: total_sent,
    totalDelivered: total_delivered,
    totalRead: total_read,
    totalActedUpon,
    deliveryRate: total_sent > 0 ? total_delivered / total_sent : 0,
    readRate: total_delivered > 0 ? total_read / total_delivered : 0,
    responseRate: total_read > 0 ? totalActedUpon / total_read : 0,
    byChannel,
    byTemplate,
  };
}
