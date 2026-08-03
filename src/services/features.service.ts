import pool from "@/lib/db";

export async function isEnabled(
  flagKey: string,
  patientId: number
): Promise<boolean> {
  // Look up participant by patientId
  const { rows: participants } = await pool.query(
    "SELECT arm, withdrawn_at FROM study_participants WHERE patient_id = $1",
    [patientId]
  );

  // Not enrolled → false (same as control default)
  if (participants.length === 0) return false;

  const participant = participants[0];

  // Withdrawn → false
  if (participant.withdrawn_at != null) return false;

  // Look up flag setting for this arm
  const { rows: settings } = await pool.query(
    `SELECT enabled FROM feature_flag_arm_settings
     WHERE flag_key = $1 AND arm = $2`,
    [flagKey, participant.arm]
  );

  // No row found → false
  if (settings.length === 0) return false;

  return settings[0].enabled;
}

export async function listFlags(): Promise<
  Array<{
    key: string;
    label: string;
    description: string | null;
    intervention: boolean;
    control: boolean;
  }>
> {
  const { rows } = await pool.query(`
    SELECT
      f.key,
      f.label,
      f.description,
      COALESCE(si.enabled, false) AS intervention,
      COALESCE(sc.enabled, false) AS control
    FROM feature_flags f
    LEFT JOIN feature_flag_arm_settings si
      ON si.flag_key = f.key AND si.arm = 'intervention'
    LEFT JOIN feature_flag_arm_settings sc
      ON sc.flag_key = f.key AND sc.arm = 'control'
    ORDER BY f.key
  `);
  return rows;
}

export async function setFlag(
  flagKey: string,
  arm: string,
  enabled: boolean,
  changedBy: number,
  reason?: string
): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // Get current value for audit
    const { rows: current } = await client.query(
      `SELECT enabled FROM feature_flag_arm_settings
       WHERE flag_key = $1 AND arm = $2`,
      [flagKey, arm]
    );

    const oldValue = current.length > 0 ? current[0].enabled : null;

    // Upsert the setting
    await client.query(
      `INSERT INTO feature_flag_arm_settings (flag_key, arm, enabled, updated_by, updated_at)
       VALUES ($1, $2, $3, $4, now())
       ON CONFLICT (flag_key, arm)
       DO UPDATE SET enabled = $3, updated_by = $4, updated_at = now()`,
      [flagKey, arm, enabled, changedBy]
    );

    // Write audit row
    await client.query(
      `INSERT INTO feature_flag_audit (flag_key, arm, old_value, new_value, changed_by, reason)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [flagKey, arm, oldValue, enabled, changedBy, reason ?? null]
    );

    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

export async function getAudit(flagKey?: string): Promise<
  Array<{
    id: number;
    flag_key: string;
    arm: string;
    old_value: boolean | null;
    new_value: boolean;
    changed_by: number;
    changed_at: Date;
    reason: string | null;
  }>
> {
  if (flagKey) {
    const { rows } = await pool.query(
      `SELECT a.*, u.first_name, u.last_name, u.email
       FROM feature_flag_audit a
       JOIN users u ON u.id = a.changed_by
       WHERE a.flag_key = $1
       ORDER BY a.changed_at DESC`,
      [flagKey]
    );
    return rows;
  }

  const { rows } = await pool.query(
    `SELECT a.*, u.first_name, u.last_name, u.email
     FROM feature_flag_audit a
     JOIN users u ON u.id = a.changed_by
     ORDER BY a.changed_at DESC`
  );
  return rows;
}
