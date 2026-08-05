/**
 * Provenance logging for AI-generated messages.
 *
 * Every personalised message gets a row in `message_generations` so the
 * exact model, template, inputs, raw output, guardrail actions and final
 * body can be traced and audited.
 */

import pool from "@/lib/db";

export interface ProvenanceParams {
  messageId: number;
  modelId: string | null;
  templateKey: string;
  templateVersion: number;
  promptInputs: Record<string, unknown>;
  rawModelOutput: string | null;
  guardrailsModified: boolean;
  guardrailsRejected: boolean;
  fallbackUsed: boolean;
  finalBody: string;
}

export async function logProvenance(params: ProvenanceParams): Promise<void> {
  await pool.query(
    `INSERT INTO message_generations
       (message_id, model_id, template_key, template_version,
        prompt_inputs, raw_model_output,
        guardrails_modified, guardrails_rejected, fallback_used,
        final_body)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
    [
      params.messageId,
      params.modelId,
      params.templateKey,
      params.templateVersion,
      JSON.stringify(params.promptInputs),
      params.rawModelOutput,
      params.guardrailsModified,
      params.guardrailsRejected,
      params.fallbackUsed,
      params.finalBody,
    ]
  );
}
