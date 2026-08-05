/**
 * Message personalization with guardrails.
 *
 * Templates carry clinical content authored by the doctor.  This module
 * selects, adapts tone, and fills personal detail (name, targets, regimen)
 * using Gemini — but NEVER produces dosing, treatment changes, or content
 * outside the template.
 *
 * On validation failure the unpersonalized (simple-substitution) version
 * is returned — a message is never dropped.
 */

import { GoogleGenerativeAI } from "@google/generative-ai";

// ── Public types ──────────────────────────────────────────────────────

export interface PersonalizationContext {
  patientName: string;
  participantCode: string;
  recentGlucose?: number;
  recentBP?: string;
  medicationNames?: string[];
  daysInactive?: number;
  checkupName?: string;
  appointmentDate?: string;
}

export interface PersonalizationProvenance {
  modelId: string | null;
  promptInputs: Record<string, unknown>;
  rawModelOutput: string | null;
  guardrailsModified: boolean;
  guardrailsRejected: boolean;
  fallbackUsed: boolean;
}

export interface PersonalizationResult {
  body: string;
  personalized: boolean;
  variablesUsed: Record<string, string>;
  provenance: PersonalizationProvenance;
}

// ── Constants ─────────────────────────────────────────────────────────

const GEMINI_MODEL_ID = "gemini-3.5-flash";
const MIN_LENGTH = 50;
const MAX_LENGTH = 500;
const REQUEST_TIMEOUT_MS = 15_000;

/**
 * Terms that must never appear in the AI output unless they were already
 * present in the original template body.  Checked case-insensitively.
 */
const FORBIDDEN_TERMS = ["mg", "ml", "unidades", "dosis"];

/**
 * Regex that matches standalone numerals (integers or decimals) that are
 * NOT part of a word.  Used to detect hallucinated dosing numbers.
 */
const NUMERAL_RE = /(?<!\w)\d+(?:\.\d+)?(?!\w)/g;

// ── Helpers ───────────────────────────────────────────────────────────

/** Map a variable name to the matching context field. */
function resolveVariable(
  name: string,
  ctx: PersonalizationContext
): string | undefined {
  const map: Record<string, string | undefined> = {
    patient_name: ctx.patientName,
    patientName: ctx.patientName,
    nombre: ctx.patientName,
    participant_code: ctx.participantCode,
    participantCode: ctx.participantCode,
    codigo: ctx.participantCode,
    recent_glucose: ctx.recentGlucose?.toString(),
    recentGlucose: ctx.recentGlucose?.toString(),
    glucosa: ctx.recentGlucose?.toString(),
    recent_bp: ctx.recentBP,
    recentBP: ctx.recentBP,
    presion: ctx.recentBP,
    medication_names: ctx.medicationNames?.join(", "),
    medicationNames: ctx.medicationNames?.join(", "),
    medicamentos: ctx.medicationNames?.join(", "),
    days_inactive: ctx.daysInactive?.toString(),
    daysInactive: ctx.daysInactive?.toString(),
    dias_inactivo: ctx.daysInactive?.toString(),
    checkup_name: ctx.checkupName,
    checkupName: ctx.checkupName,
    nombre_control: ctx.checkupName,
    appointment_date: ctx.appointmentDate,
    appointmentDate: ctx.appointmentDate,
    fecha_turno: ctx.appointmentDate,
  };
  return map[name];
}

/**
 * Simple moustache-style variable substitution — no AI involved.
 * Any placeholder whose value is unavailable is left as-is.
 */
function substituteVariables(
  templateBody: string,
  variables: string[],
  ctx: PersonalizationContext
): { body: string; variablesUsed: Record<string, string>; allFilled: boolean } {
  const variablesUsed: Record<string, string> = {};
  let allFilled = true;
  let body = templateBody;

  for (const v of variables) {
    const value = resolveVariable(v, ctx);
    if (value !== undefined) {
      variablesUsed[v] = value;
      body = body.replaceAll(`{{${v}}}`, value);
    } else {
      allFilled = false;
    }
  }

  return { body, variablesUsed, allFilled };
}

/**
 * Extract all standalone numerals from a string.
 */
function extractNumerals(text: string): Set<string> {
  return new Set(text.match(NUMERAL_RE) ?? []);
}

/**
 * Validate the AI-generated output against safety guardrails.
 *
 * Returns null if valid, or a reason string if invalid.
 */
function validateOutput(
  output: string,
  originalTemplate: string,
  variablesUsed: Record<string, string>
): string | null {
  // Length bounds
  if (output.length < MIN_LENGTH) {
    return `Output too short (${output.length} chars, min ${MIN_LENGTH})`;
  }
  if (output.length > MAX_LENGTH) {
    return `Output too long (${output.length} chars, max ${MAX_LENGTH})`;
  }

  // Build the set of "allowed" text: the template + every substituted value
  const allowedText = [originalTemplate, ...Object.values(variablesUsed)].join(
    " "
  );

  // Forbidden medical terms not present in allowed text
  const lowerOutput = output.toLowerCase();
  const lowerAllowed = allowedText.toLowerCase();
  for (const term of FORBIDDEN_TERMS) {
    // Use word-boundary-aware check
    const termRe = new RegExp(`(?<![a-záéíóúñ])${term}(?![a-záéíóúñ])`, "i");
    if (termRe.test(output) && !termRe.test(allowedText)) {
      return `Forbidden term "${term}" introduced by AI`;
    }
  }

  // Numerals not present in the allowed text
  const allowedNumerals = extractNumerals(allowedText);
  const outputNumerals = extractNumerals(output);
  for (const n of outputNumerals) {
    if (!allowedNumerals.has(n)) {
      return `Numeral "${n}" introduced by AI (not in template or variables)`;
    }
  }

  return null;
}

// ── Main function ─────────────────────────────────────────────────────

/**
 * Personalize a message template for a specific patient.
 *
 * 1. Replace {{variable}} placeholders with values from context.
 * 2. If all variables are filled, return immediately (no AI needed).
 * 3. Otherwise call Gemini with a tightly constrained prompt for tone
 *    adaptation.
 * 4. Validate the AI output — on failure, fall back to the simple
 *    substitution result (never drop the message).
 */
export async function personalizeMessage(
  templateBody: string,
  variables: string[],
  context: PersonalizationContext
): Promise<PersonalizationResult> {
  // Step 1 — simple substitution
  const { body: substituted, variablesUsed, allFilled } = substituteVariables(
    templateBody,
    variables,
    context
  );

  // Build prompt inputs for provenance regardless of path taken
  const promptInputs: Record<string, unknown> = {
    templateBody,
    variables,
    patientName: context.patientName,
    participantCode: context.participantCode,
    ...(context.recentGlucose !== undefined && { recentGlucose: context.recentGlucose }),
    ...(context.recentBP && { recentBP: context.recentBP }),
    ...(context.medicationNames?.length && { medicationNames: context.medicationNames }),
    ...(context.daysInactive !== undefined && { daysInactive: context.daysInactive }),
    ...(context.checkupName && { checkupName: context.checkupName }),
    ...(context.appointmentDate && { appointmentDate: context.appointmentDate }),
  };

  // Step 2 — if every placeholder is resolved, no AI needed
  if (allFilled) {
    return {
      body: substituted,
      personalized: false,
      variablesUsed,
      provenance: {
        modelId: null,
        promptInputs,
        rawModelOutput: null,
        guardrailsModified: false,
        guardrailsRejected: false,
        fallbackUsed: false,
      },
    };
  }

  // Step 3 — call Gemini for tone adaptation
  try {
    const aiBody = await callGemini(substituted, context);

    // Step 4 — validate
    const validationError = validateOutput(aiBody, templateBody, variablesUsed);

    if (validationError) {
      console.warn(
        `[personalize] Validation failed, falling back to simple substitution: ${validationError}`
      );
      return {
        body: substituted,
        personalized: false,
        variablesUsed,
        provenance: {
          modelId: GEMINI_MODEL_ID,
          promptInputs,
          rawModelOutput: aiBody,
          guardrailsModified: false,
          guardrailsRejected: true,
          fallbackUsed: true,
        },
      };
    }

    return {
      body: aiBody,
      personalized: true,
      variablesUsed,
      provenance: {
        modelId: GEMINI_MODEL_ID,
        promptInputs,
        rawModelOutput: aiBody,
        guardrailsModified: false,
        guardrailsRejected: false,
        fallbackUsed: false,
      },
    };
  } catch (err) {
    console.error(
      "[personalize] Gemini call failed, falling back to simple substitution:",
      err
    );
    return {
      body: substituted,
      personalized: false,
      variablesUsed,
      provenance: {
        modelId: GEMINI_MODEL_ID,
        promptInputs,
        rawModelOutput: null,
        guardrailsModified: false,
        guardrailsRejected: false,
        fallbackUsed: true,
      },
    };
  }
}

// ── Gemini integration ────────────────────────────────────────────────

function buildPrompt(
  templateBody: string,
  ctx: PersonalizationContext
): string {
  const contextLines: string[] = [];
  if (ctx.recentGlucose !== undefined)
    contextLines.push(`Recent glucose: ${ctx.recentGlucose}`);
  if (ctx.recentBP) contextLines.push(`Recent BP: ${ctx.recentBP}`);
  if (ctx.medicationNames?.length)
    contextLines.push(`Medications: ${ctx.medicationNames.join(", ")}`);
  if (ctx.daysInactive !== undefined)
    contextLines.push(`Days inactive: ${ctx.daysInactive}`);
  if (ctx.checkupName) contextLines.push(`Checkup: ${ctx.checkupName}`);
  if (ctx.appointmentDate)
    contextLines.push(`Appointment date: ${ctx.appointmentDate}`);

  return [
    "You are personalizing a health reminder message for a patient.",
    `Template: "${templateBody}"`,
    `Patient name: ${ctx.patientName}`,
    contextLines.length
      ? `Context:\n${contextLines.map((l) => `- ${l}`).join("\n")}`
      : "",
    "",
    "Rules:",
    "- Replace placeholders with the provided values",
    "- You may adapt the tone to be warmer or more encouraging",
    "- You may add the patient's name naturally",
    "- You MUST NOT add any medical dosing, numbers, or treatment recommendations",
    "- You MUST NOT change the medical content of the message",
    "- Keep the message between 50 and 500 characters",
    "- Respond in the same language as the template",
    "- Respond with ONLY the final message text, nothing else",
  ]
    .filter(Boolean)
    .join("\n");
}

async function callGemini(
  templateBody: string,
  ctx: PersonalizationContext
): Promise<string> {
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");
  const model = genAI.getGenerativeModel({ model: GEMINI_MODEL_ID });

  const prompt = buildPrompt(templateBody, ctx);

  const abortController = new AbortController();
  const timeout = setTimeout(() => abortController.abort(), REQUEST_TIMEOUT_MS);

  try {
    const result = await model.generateContent(
      {
        contents: [{ role: "user", parts: [{ text: prompt }] }],
      },
      { signal: abortController.signal }
    );

    const text = result.response.text().trim();
    return text;
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      throw new Error(
        `Gemini personalization timed out after ${REQUEST_TIMEOUT_MS / 1000}s`
      );
    }
    throw err;
  } finally {
    clearTimeout(timeout);
  }
}
