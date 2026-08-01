import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

const PARSE_PROMPT = `You are a medical document parser. Analyze the uploaded document and extract structured data.

Respond with JSON matching this schema:
{
  "document_type": "lab_results" | "imaging" | "prescription" | "other",
  "confidence": 0.0-1.0,
  "document_date": "YYYY-MM-DD" or null,
  "institution_name": string or null,
  "patient_name": string or null,
  "data": {
    // For lab_results:
    "tests": [
      {
        "name": string,
        "value": number or string,
        "unit": string or null,
        "reference_range": string or null,
        "flag": "normal" | "high" | "low" | "unknown"
      }
    ],
    // For imaging:
    "study_type": string,
    "findings": string,
    "impressions": string or null,
    // For prescription:
    "medications": [{ "name": string, "dosage": string, "frequency": string }],
    // For other:
    "summary": string
  }
}

Rules:
- Extract ALL test results visible in the document
- Use the exact test names as written in the document (usually Spanish)
- For flags: compare value against reference range if available
- If you cannot determine a field, use null
- Set confidence based on image quality and extraction certainty
- Do NOT invent or hallucinate values — only extract what is clearly visible`;

export interface ParsedDocument {
  document_type: "lab_results" | "imaging" | "prescription" | "other";
  confidence: number;
  document_date: string | null;
  institution_name: string | null;
  patient_name: string | null;
  data: Record<string, unknown>;
}

const REQUEST_TIMEOUT_MS = 30_000;

export async function parseDocument(
  buffer: Buffer,
  mimeType: string
): Promise<ParsedDocument> {
  const model = genAI.getGenerativeModel({
    model: "gemini-3.5-flash",
    generationConfig: {
      responseMimeType: "application/json",
    },
  });

  const abortController = new AbortController();
  const timeout = setTimeout(() => abortController.abort(), REQUEST_TIMEOUT_MS);

  try {
    const result = await model.generateContent(
      {
        contents: [
          {
            role: "user",
            parts: [
              { text: PARSE_PROMPT },
              {
                inlineData: {
                  mimeType,
                  data: buffer.toString("base64"),
                },
              },
            ],
          },
        ],
      },
      { signal: abortController.signal }
    );

    const text = result.response.text();
    return JSON.parse(text) as ParsedDocument;
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      throw new Error(`Gemini request timed out after ${REQUEST_TIMEOUT_MS / 1000}s`);
    }
    throw err;
  } finally {
    clearTimeout(timeout);
  }
}
