import pool from "@/lib/db";

const STATUS_QUERY = `
  SELECT
    pc.id,
    ct.code,
    ct.display_name_es,
    ct.category,
    ct.sort_order,
    COALESCE(pc.frequency_months_override, ct.default_frequency_months) AS frequency_months,
    pc.last_completed_at,
    pc.active,
    CASE
      WHEN COALESCE(pc.frequency_months_override, ct.default_frequency_months) IS NULL THEN NULL
      WHEN pc.last_completed_at IS NULL THEN NULL
      ELSE pc.last_completed_at
           + (COALESCE(pc.frequency_months_override, ct.default_frequency_months) || ' months')::INTERVAL
    END AS next_due_at,
    CASE
      WHEN COALESCE(pc.frequency_months_override, ct.default_frequency_months) IS NULL THEN 'sin_frecuencia'
      WHEN pc.last_completed_at IS NULL THEN 'sin_registro'
      WHEN pc.last_completed_at
           + (COALESCE(pc.frequency_months_override, ct.default_frequency_months) || ' months')::INTERVAL
           < NOW() THEN 'atrasado'
      WHEN pc.last_completed_at
           + (COALESCE(pc.frequency_months_override, ct.default_frequency_months) || ' months')::INTERVAL
           < NOW() + INTERVAL '30 days' THEN 'proximo'
      ELSE 'al_dia'
    END AS status,
    CASE
      WHEN COALESCE(pc.frequency_months_override, ct.default_frequency_months) IS NULL THEN NULL
      WHEN pc.last_completed_at IS NULL THEN NULL
      ELSE EXTRACT(EPOCH FROM (
        pc.last_completed_at
        + (COALESCE(pc.frequency_months_override, ct.default_frequency_months) || ' months')::INTERVAL
        - NOW()
      )) / 86400
    END AS days_until_due
  FROM patient_checkups pc
  JOIN checkup_types ct ON ct.id = pc.checkup_type_id
`;

const STATUS_ORDER = `
  ORDER BY
    CASE
      WHEN COALESCE(pc.frequency_months_override, ct.default_frequency_months) IS NULL THEN 5
      WHEN pc.last_completed_at IS NULL THEN 2
      WHEN pc.last_completed_at
           + (COALESCE(pc.frequency_months_override, ct.default_frequency_months) || ' months')::INTERVAL
           < NOW() THEN 1
      WHEN pc.last_completed_at
           + (COALESCE(pc.frequency_months_override, ct.default_frequency_months) || ' months')::INTERVAL
           < NOW() + INTERVAL '30 days' THEN 3
      ELSE 4
    END,
    ct.sort_order
`;

export async function listForPatient(patientId: number) {
  const { rows } = await pool.query(
    `${STATUS_QUERY}
     WHERE pc.patient_id = $1 AND pc.active = TRUE
     ${STATUS_ORDER}`,
    [patientId]
  );

  const hasOnboardingPending = rows.some(
    r => r.status === "sin_registro" && r.frequency_months !== null
  );

  return {
    checkups: rows.map(r => ({
      id: r.id,
      code: r.code,
      display_name_es: r.display_name_es,
      category: r.category,
      frequency_months: r.frequency_months ? Number(r.frequency_months) : null,
      last_completed_at: r.last_completed_at?.toISOString() ?? null,
      next_due_at: r.next_due_at?.toISOString() ?? null,
      status: r.status as string,
      days_until_due: r.days_until_due !== null ? Math.round(Number(r.days_until_due)) : null,
    })),
    has_onboarding_pending: hasOnboardingPending,
  };
}

export async function listForDoctorPatient(patientId: number) {
  const { rows } = await pool.query(
    `${STATUS_QUERY}
     WHERE pc.patient_id = $1
     ${STATUS_ORDER}`,
    [patientId]
  );

  return rows.map(r => ({
    id: r.id,
    code: r.code,
    display_name_es: r.display_name_es,
    category: r.category,
    frequency_months: r.frequency_months ? Number(r.frequency_months) : null,
    last_completed_at: r.last_completed_at?.toISOString() ?? null,
    next_due_at: r.next_due_at?.toISOString() ?? null,
    status: r.status as string,
    days_until_due: r.days_until_due !== null ? Math.round(Number(r.days_until_due)) : null,
    active: r.active,
  }));
}

export async function listCompletions(patientCheckupId: number) {
  const { rows } = await pool.query(
    `SELECT cc.id, cc.completed_at, cc.notes, cc.created_at,
            u.first_name, u.last_name, u.email,
            (SELECT count(*) FROM checkup_attachments ca WHERE ca.checkup_completion_id = cc.id)::int AS attachment_count
     FROM checkup_completions cc
     LEFT JOIN users u ON u.id = cc.reported_by_user_id
     WHERE cc.patient_checkup_id = $1
     ORDER BY cc.completed_at DESC`,
    [patientCheckupId]
  );
  return rows.map(r => ({
    id: r.id,
    completed_at: r.completed_at?.toISOString() ?? null,
    notes: r.notes,
    reported_by: r.first_name || r.last_name
      ? `${r.first_name || ""} ${r.last_name || ""}`.trim()
      : r.email?.split("@")[0] ?? null,
    created_at: r.created_at?.toISOString() ?? null,
    attachment_count: r.attachment_count,
  }));
}

export async function findById(id: number) {
  const { rows } = await pool.query(
    "SELECT id, patient_id, checkup_type_id, active FROM patient_checkups WHERE id = $1",
    [id]
  );
  return rows[0] ?? null;
}

export async function completeCheckup(
  patientCheckupId: number,
  completedAt: string,
  reportedByUserId: number,
  notes?: string,
  appointmentId?: number
) {
  const { rows } = await pool.query(
    `INSERT INTO checkup_completions (patient_checkup_id, completed_at, reported_by_user_id, notes, appointment_id)
     VALUES ($1, $2, $3, $4, $5) RETURNING id`,
    [patientCheckupId, completedAt, reportedByUserId, notes || null, appointmentId || null]
  );
  return { conflict: false, id: rows[0].id };
}

export async function submitOnboarding(
  entries: Array<{ patient_checkup_id: number; last_completed_at: string | null }>,
  userId: number
) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    for (const entry of entries) {
      if (entry.last_completed_at) {
        await client.query(
          `INSERT INTO checkup_completions (patient_checkup_id, completed_at, reported_by_user_id, notes)
           VALUES ($1, $2, $3, 'Registro inicial')`,
          [entry.patient_checkup_id, entry.last_completed_at, userId]
        );
      }
    }
    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

export async function updatePatientCheckup(
  id: number,
  fields: { frequency_months_override?: number | null; active?: boolean }
) {
  const setClauses: string[] = [];
  const values: unknown[] = [];

  if (fields.frequency_months_override !== undefined) {
    values.push(fields.frequency_months_override);
    setClauses.push(`frequency_months_override = $${values.length}`);
  }
  if (fields.active !== undefined) {
    values.push(fields.active);
    setClauses.push(`active = $${values.length}`);
  }

  if (setClauses.length === 0) return null;

  setClauses.push("updated_at = NOW()");
  values.push(id);

  await pool.query(
    `UPDATE patient_checkups SET ${setClauses.join(", ")} WHERE id = $${values.length}`,
    values
  );

  // Return updated row with computed status
  const { rows } = await pool.query(
    `${STATUS_QUERY} WHERE pc.id = $1`,
    [id]
  );
  const r = rows[0];
  if (!r) return null;

  return {
    id: r.id,
    code: r.code,
    display_name_es: r.display_name_es,
    category: r.category,
    frequency_months: r.frequency_months ? Number(r.frequency_months) : null,
    last_completed_at: r.last_completed_at?.toISOString() ?? null,
    next_due_at: r.next_due_at?.toISOString() ?? null,
    status: r.status as string,
    days_until_due: r.days_until_due !== null ? Math.round(Number(r.days_until_due)) : null,
    active: r.active,
  };
}

export async function checkCheckupAlerts() {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const { rows: created } = await client.query(`
      INSERT INTO alerts (patient_id, type, severity, title, message)
      SELECT
        pc.patient_id,
        'checkup_due',
        CASE
          WHEN pc.last_completed_at
               + (COALESCE(pc.frequency_months_override, ct.default_frequency_months) || ' months')::INTERVAL
               <= NOW() - INTERVAL '60 days' THEN 'critical'
          WHEN pc.last_completed_at
               + (COALESCE(pc.frequency_months_override, ct.default_frequency_months) || ' months')::INTERVAL
               <= NOW() THEN 'critical'
          ELSE 'warning'
        END,
        CASE
          WHEN pc.last_completed_at
               + (COALESCE(pc.frequency_months_override, ct.default_frequency_months) || ' months')::INTERVAL
               <= NOW() THEN 'Control atrasado: ' || ct.display_name_es
          ELSE 'Control próximo: ' || ct.display_name_es
        END,
        CASE
          WHEN pc.last_completed_at
               + (COALESCE(pc.frequency_months_override, ct.default_frequency_months) || ' months')::INTERVAL
               <= NOW() THEN 'Tu control de ' || ct.display_name_es || ' está atrasado.'
          ELSE 'Tu control de ' || ct.display_name_es || ' vence pronto.'
        END
      FROM patient_checkups pc
      JOIN checkup_types ct ON ct.id = pc.checkup_type_id
      WHERE pc.active = TRUE
        AND COALESCE(pc.frequency_months_override, ct.default_frequency_months) IS NOT NULL
        AND pc.last_completed_at IS NOT NULL
        AND pc.last_completed_at
            + (COALESCE(pc.frequency_months_override, ct.default_frequency_months) || ' months')::INTERVAL
            < NOW() + INTERVAL '30 days'
        AND NOT EXISTS (
          SELECT 1 FROM alerts a
          WHERE a.patient_id = pc.patient_id
            AND a.type = 'checkup_due'
            AND a.read = FALSE
            AND a.title LIKE '%' || ct.display_name_es || '%'
        )
      RETURNING patient_id, type
    `);

    await client.query("COMMIT");
    return created;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}
