import pool from "@/lib/db";
import { uploadFile, deleteFile } from "@/lib/cloudinary";
import { parseDocument } from "@/lib/gemini";

const MAX_FILES = 10;
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB
const ALLOWED_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "application/pdf",
];

function classifyFileType(mimeType: string): "image" | "pdf" {
  return mimeType === "application/pdf" ? "pdf" : "image";
}

function cloudinaryResourceType(mimeType: string): "image" | "raw" {
  return mimeType === "application/pdf" ? "raw" : "image";
}

export function validateFiles(files: File[]): string | null {
  if (files.length > MAX_FILES) return `Máximo ${MAX_FILES} archivos permitidos`;
  for (const file of files) {
    if (!ALLOWED_TYPES.includes(file.type)) {
      return `Tipo de archivo no soportado: ${file.name}`;
    }
    if (file.size > MAX_FILE_SIZE) {
      return `Archivo demasiado grande: ${file.name} (máx 10 MB)`;
    }
  }
  return null;
}

export async function uploadAndAttach(
  completionId: number,
  files: File[],
  userId: number
): Promise<{ id: number; cloudinary_url: string; original_filename: string }[]> {
  const attachments: { id: number; cloudinary_url: string; original_filename: string }[] = [];

  for (const file of files) {
    const buffer = Buffer.from(await file.arrayBuffer());
    const fileType = classifyFileType(file.type);
    const resourceType = cloudinaryResourceType(file.type);

    const uploaded = await uploadFile(buffer, {
      folder: `glycofit/checkups/${completionId}`,
      resourceType,
    });

    const { rows } = await pool.query(
      `INSERT INTO checkup_attachments
        (checkup_completion_id, cloudinary_public_id, cloudinary_url, original_filename, file_type, file_size_bytes, uploaded_by_user_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id`,
      [completionId, uploaded.public_id, uploaded.secure_url, file.name, fileType, uploaded.bytes, userId]
    );

    const attachmentId = rows[0].id;
    attachments.push({ id: attachmentId, cloudinary_url: uploaded.secure_url, original_filename: file.name });

    // Create pending parse result
    await pool.query(
      `INSERT INTO checkup_parsed_results (checkup_attachment_id, parse_status, model_used)
       VALUES ($1, 'pending', 'gemini-3.5-flash')`,
      [attachmentId]
    );

    // Fire-and-forget: parse in background
    triggerParse(attachmentId, buffer, file.type).catch(err =>
      console.error(`Parse failed for attachment ${attachmentId}:`, err)
    );
  }

  return attachments;
}

const MAX_RETRIES = 2;
const INITIAL_RETRY_DELAY_MS = 2000;

async function triggerParse(attachmentId: number, buffer: Buffer, mimeType: string) {
  await pool.query(
    `UPDATE checkup_parsed_results SET parse_status = 'processing' WHERE checkup_attachment_id = $1`,
    [attachmentId]
  );

  let lastError: Error | undefined;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      if (attempt > 0) {
        const delay = INITIAL_RETRY_DELAY_MS * Math.pow(2, attempt - 1);
        await new Promise(resolve => setTimeout(resolve, delay));
      }

      const parsed = await parseDocument(buffer, mimeType);

      await pool.query(
        `UPDATE checkup_parsed_results
         SET parse_status = 'completed',
             document_type = $2,
             parsed_data = $3,
             confidence_score = $4,
             parsed_at = NOW()
         WHERE checkup_attachment_id = $1`,
        [attachmentId, parsed.document_type, JSON.stringify(parsed.data), parsed.confidence]
      );
      return;
    } catch (err) {
      lastError = err instanceof Error ? err : new Error("Unknown error");
      console.error(`Parse attempt ${attempt + 1}/${MAX_RETRIES + 1} failed for attachment ${attachmentId}:`, lastError.message);
    }
  }

  await pool.query(
    `UPDATE checkup_parsed_results
     SET parse_status = 'failed', error_message = $2, parsed_at = NOW()
     WHERE checkup_attachment_id = $1`,
    [attachmentId, lastError?.message ?? "Unknown error"]
  );
}

export async function retryParse(attachmentId: number) {
  const { rows } = await pool.query(
    `SELECT ca.cloudinary_url, ca.file_type
     FROM checkup_attachments ca
     JOIN checkup_parsed_results cpr ON cpr.checkup_attachment_id = ca.id
     WHERE ca.id = $1 AND cpr.parse_status = 'failed'`,
    [attachmentId]
  );
  if (rows.length === 0) return { error: "No se encontró un resultado fallido para reintentar" };

  // Fetch file from Cloudinary to re-parse
  const res = await fetch(rows[0].cloudinary_url);
  if (!res.ok) return { error: "No se pudo descargar el archivo" };

  const buffer = Buffer.from(await res.arrayBuffer());
  const mimeType = rows[0].file_type === "pdf" ? "application/pdf" : "image/jpeg";

  await pool.query(
    `UPDATE checkup_parsed_results SET parse_status = 'pending', error_message = NULL WHERE checkup_attachment_id = $1`,
    [attachmentId]
  );

  triggerParse(attachmentId, buffer, mimeType).catch(err =>
    console.error(`Retry parse failed for attachment ${attachmentId}:`, err)
  );

  return { ok: true };
}

export async function listByCompletion(completionId: number) {
  const { rows } = await pool.query(
    `SELECT ca.id, ca.cloudinary_url, ca.original_filename, ca.file_type, ca.file_size_bytes, ca.created_at,
            cpr.parse_status, cpr.document_type, cpr.parsed_data, cpr.confidence_score, cpr.error_message, cpr.parsed_at
     FROM checkup_attachments ca
     LEFT JOIN checkup_parsed_results cpr ON cpr.checkup_attachment_id = ca.id
     WHERE ca.checkup_completion_id = $1
     ORDER BY ca.created_at`,
    [completionId]
  );
  return rows;
}

export async function listByCompletionIds(completionIds: number[]) {
  if (completionIds.length === 0) return [];
  const placeholders = completionIds.map((_, i) => `$${i + 1}`).join(",");
  const { rows } = await pool.query(
    `SELECT ca.id, ca.checkup_completion_id, ca.cloudinary_url, ca.original_filename, ca.file_type,
            cpr.parse_status, cpr.document_type, cpr.parsed_data, cpr.confidence_score, cpr.error_message
     FROM checkup_attachments ca
     LEFT JOIN checkup_parsed_results cpr ON cpr.checkup_attachment_id = ca.id
     WHERE ca.checkup_completion_id IN (${placeholders})
     ORDER BY ca.created_at`,
    completionIds
  );
  return rows;
}

export async function findAttachment(attachmentId: number) {
  const { rows } = await pool.query(
    `SELECT ca.*, cc.patient_checkup_id,
            pc.patient_id
     FROM checkup_attachments ca
     JOIN checkup_completions cc ON cc.id = ca.checkup_completion_id
     JOIN patient_checkups pc ON pc.id = cc.patient_checkup_id
     WHERE ca.id = $1`,
    [attachmentId]
  );
  return rows[0] ?? null;
}

export async function deleteAttachment(attachmentId: number) {
  const { rows } = await pool.query(
    `DELETE FROM checkup_attachments WHERE id = $1
     RETURNING cloudinary_public_id, file_type`,
    [attachmentId]
  );
  if (rows.length === 0) return { error: "Archivo no encontrado" };

  const resourceType = rows[0].file_type === "pdf" ? "raw" : "image";
  await deleteFile(rows[0].cloudinary_public_id, resourceType).catch(err =>
    console.error(`Cloudinary delete failed for ${rows[0].cloudinary_public_id}:`, err)
  );

  return { ok: true };
}
