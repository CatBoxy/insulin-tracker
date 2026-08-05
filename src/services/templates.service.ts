import pool from "@/lib/db";

export interface Template {
  id: number;
  key: string;
  version: number;
  channel: string;
  category: string;
  locale: string;
  body: string;
  variables: string[];
  wa_template_name: string | null;
  wa_status: string | null;
  wa_approved_at: string | null;
  wa_rejection_reason: string | null;
  approved_by_doctor: number | null;
  approved_at: string | null;
  active: boolean;
  created_at: string;
}

interface TemplateGroup {
  key: string;
  channel: string;
  category: string;
  latest_version: number;
  active: boolean;
  approved_at: string | null;
  wa_status: string | null;
  template_id: number;
}

export async function list(): Promise<TemplateGroup[]> {
  const { rows } = await pool.query(
    `SELECT DISTINCT ON (key, channel)
       id AS template_id, key, channel, category, version AS latest_version,
       active, approved_at, wa_status
     FROM message_templates
     ORDER BY key, channel, version DESC`
  );
  return rows;
}

export async function getByKey(key: string): Promise<Template[]> {
  const { rows } = await pool.query(
    `SELECT * FROM message_templates WHERE key = $1 ORDER BY version DESC`,
    [key]
  );
  return rows;
}

export async function getById(id: number): Promise<Template | null> {
  const { rows } = await pool.query(
    `SELECT * FROM message_templates WHERE id = $1`,
    [id]
  );
  return rows[0] || null;
}

export async function create(
  key: string,
  channel: string,
  category: string,
  body: string,
  variables: string[],
  locale = "es_AR"
): Promise<Template> {
  const { rows } = await pool.query(
    `INSERT INTO message_templates (key, version, channel, category, locale, body, variables)
     VALUES ($1, 1, $2, $3, $4, $5, $6)
     RETURNING *`,
    [key, channel, category, locale, body, JSON.stringify(variables)]
  );
  return rows[0];
}

export async function createNewVersion(
  key: string,
  channel: string,
  body: string,
  variables: string[]
): Promise<Template> {
  // Get current max version for this key+channel
  const { rows: existing } = await pool.query(
    `SELECT MAX(version) AS max_version, category, locale
     FROM message_templates
     WHERE key = $1 AND channel = $2
     GROUP BY category, locale`,
    [key, channel]
  );

  if (existing.length === 0) {
    throw new Error("Template not found");
  }

  const nextVersion = existing[0].max_version + 1;
  const { category, locale } = existing[0];

  const { rows } = await pool.query(
    `INSERT INTO message_templates (key, version, channel, category, locale, body, variables)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING *`,
    [key, nextVersion, channel, category, locale, body, JSON.stringify(variables)]
  );
  return rows[0];
}

export async function approve(
  templateId: number,
  doctorUserId: number
): Promise<Template> {
  const { rows } = await pool.query(
    `UPDATE message_templates
     SET approved_by_doctor = $2, approved_at = NOW()
     WHERE id = $1
     RETURNING *`,
    [templateId, doctorUserId]
  );
  if (rows.length === 0) throw new Error("Template not found");
  return rows[0];
}

export async function activate(templateId: number): Promise<Template> {
  // Verify template is approved
  const template = await getById(templateId);
  if (!template) throw new Error("Template not found");
  if (!template.approved_at) throw new Error("Template must be approved before activation");
  if (template.channel === "whatsapp" && template.wa_status !== "approved") {
    throw new Error("WhatsApp template must be approved by Meta before activation");
  }

  // Deactivate other versions of same key+channel, activate this one
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(
      `UPDATE message_templates SET active = false WHERE key = $1 AND channel = $2`,
      [template.key, template.channel]
    );
    const { rows } = await client.query(
      `UPDATE message_templates SET active = true WHERE id = $1 RETURNING *`,
      [templateId]
    );
    await client.query("COMMIT");
    return rows[0];
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

export async function deactivate(templateId: number): Promise<Template> {
  const { rows } = await pool.query(
    `UPDATE message_templates SET active = false WHERE id = $1 RETURNING *`,
    [templateId]
  );
  if (rows.length === 0) throw new Error("Template not found");
  return rows[0];
}

export async function updateWaStatus(
  templateId: number,
  status: string,
  rejectionReason?: string
): Promise<Template> {
  const setApprovedAt = status === "approved" ? "NOW()" : "wa_approved_at";
  const { rows } = await pool.query(
    `UPDATE message_templates
     SET wa_status = $2,
         wa_rejection_reason = $3,
         wa_approved_at = ${setApprovedAt}
     WHERE id = $1
     RETURNING *`,
    [templateId, status, rejectionReason || null]
  );
  if (rows.length === 0) throw new Error("Template not found");
  return rows[0];
}
