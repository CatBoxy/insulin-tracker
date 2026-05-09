import pool from "@/lib/db";

export async function register(userId: number, token: string, platform: string) {
  await pool.query(
    `INSERT INTO device_tokens (user_id, token, platform)
     VALUES ($1, $2, $3)
     ON CONFLICT (token) DO UPDATE SET user_id = $1, platform = $3, updated_at = NOW()`,
    [userId, token, platform]
  );
}

export async function unregister(userId: number, token: string) {
  await pool.query(
    "DELETE FROM device_tokens WHERE user_id = $1 AND token = $2",
    [userId, token]
  );
}
