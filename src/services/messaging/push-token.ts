import pool from "@/lib/db";

export async function registerToken(patientId: number, token: string, platform: string) {
  const { rows } = await pool.query(
    "SELECT user_id FROM patients WHERE id = $1",
    [patientId]
  );
  if (rows.length === 0) return;
  const userId = rows[0].user_id;

  await pool.query(
    `INSERT INTO device_tokens (user_id, token, platform)
     VALUES ($1, $2, $3)
     ON CONFLICT (token) DO UPDATE SET user_id = $1, platform = $3, updated_at = NOW()`,
    [userId, token, platform]
  );

  await pool.query(
    `INSERT INTO patient_channels (patient_id, channel, identifier, opted_in, opted_in_at, active)
     VALUES ($1, 'push', $2, true, NOW(), true)
     ON CONFLICT (patient_id, channel, identifier) DO UPDATE
     SET opted_in = true, opted_in_at = NOW(), active = true, opted_out_at = NULL`,
    [patientId, token]
  );
}

export async function deactivateToken(token: string) {
  await pool.query("DELETE FROM device_tokens WHERE token = $1", [token]);
  await pool.query(
    "UPDATE patient_channels SET active = false, opted_out_at = NOW() WHERE channel = 'push' AND identifier = $1",
    [token]
  );
}

export async function getActiveTokens(patientId: number): Promise<string[]> {
  const { rows } = await pool.query(
    `SELECT dt.token FROM device_tokens dt
     JOIN patients p ON p.user_id = dt.user_id
     JOIN patient_channels pc ON pc.patient_id = p.id AND pc.channel = 'push' AND pc.identifier = dt.token
     WHERE p.id = $1 AND pc.active = true AND pc.opted_in = true`,
    [patientId]
  );
  return rows.map(r => r.token);
}
