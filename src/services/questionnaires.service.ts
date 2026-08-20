import pool from "@/lib/db";

export async function listActive() {
  const { rows } = await pool.query(
    `SELECT id, code, title, description, version, created_at
     FROM questionnaires
     WHERE active = true
     ORDER BY created_at DESC`
  );
  return rows;
}

export async function listAll() {
  const { rows } = await pool.query(
    `SELECT id, code, title, description, version, active, created_at
     FROM questionnaires
     ORDER BY created_at DESC`
  );
  return rows;
}

export async function getWithItems(questionnaireId: number) {
  const { rows: qRows } = await pool.query(
    `SELECT id, code, title, description, version, active, created_at
     FROM questionnaires
     WHERE id = $1`,
    [questionnaireId]
  );
  if (qRows.length === 0) return null;

  const { rows: items } = await pool.query(
    `SELECT id, item_order, prompt, response_type, options, required
     FROM questionnaire_items
     WHERE questionnaire_id = $1
     ORDER BY item_order`,
    [questionnaireId]
  );

  return { ...qRows[0], items };
}

export async function createQuestionnaire(input: {
  code: string;
  title: string;
  description?: string;
  items: Array<{
    item_order: number;
    prompt: string;
    response_type: string;
    options?: unknown;
    required?: boolean;
  }>;
}) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const { rows } = await client.query(
      `INSERT INTO questionnaires (code, title, description)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [input.code, input.title, input.description ?? null]
    );
    const questionnaire = rows[0];

    for (const item of input.items) {
      await client.query(
        `INSERT INTO questionnaire_items (questionnaire_id, item_order, prompt, response_type, options, required)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          questionnaire.id,
          item.item_order,
          item.prompt,
          item.response_type,
          item.options ? JSON.stringify(item.options) : null,
          item.required ?? true,
        ]
      );
    }

    await client.query("COMMIT");
    return questionnaire;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

export async function createResponse(
  participantId: number,
  questionnaireId: number,
  studyVisitId?: number
) {
  const { rows } = await pool.query(
    `INSERT INTO questionnaire_responses (participant_id, questionnaire_id, study_visit_id)
     VALUES ($1, $2, $3)
     RETURNING *`,
    [participantId, questionnaireId, studyVisitId ?? null]
  );
  return rows[0];
}

export async function submitAnswers(
  responseId: number,
  answers: Array<{ itemId: number; value: string }>
) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    for (const answer of answers) {
      await client.query(
        `INSERT INTO questionnaire_answers (response_id, item_id, value)
         VALUES ($1, $2, $3)`,
        [responseId, answer.itemId, answer.value]
      );
    }

    await client.query(
      `UPDATE questionnaire_responses SET completed_at = now() WHERE id = $1`,
      [responseId]
    );

    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

export async function getResponses(participantId: number) {
  const { rows } = await pool.query(
    `SELECT qr.id, qr.questionnaire_id, qr.study_visit_id, qr.started_at, qr.completed_at,
            q.code, q.title, q.version
     FROM questionnaire_responses qr
     JOIN questionnaires q ON q.id = qr.questionnaire_id
     WHERE qr.participant_id = $1
     ORDER BY qr.started_at DESC`,
    [participantId]
  );
  return rows;
}

export async function getResponseDetail(responseId: number) {
  const { rows: rRows } = await pool.query(
    `SELECT qr.*, q.code, q.title, q.version
     FROM questionnaire_responses qr
     JOIN questionnaires q ON q.id = qr.questionnaire_id
     WHERE qr.id = $1`,
    [responseId]
  );
  if (rRows.length === 0) return null;

  const { rows: answers } = await pool.query(
    `SELECT qa.id, qa.item_id, qa.value,
            qi.prompt, qi.response_type, qi.options, qi.item_order
     FROM questionnaire_answers qa
     JOIN questionnaire_items qi ON qi.id = qa.item_id
     WHERE qa.response_id = $1
     ORDER BY qi.item_order`,
    [responseId]
  );

  return { ...rRows[0], answers };
}
