import pool from "@/lib/db";

export const FAMILY_CONDITIONS = [
  "cancer",
  "hipertension",
  "diabetes",
  "problemas_cardiacos",
  "problemas_renales",
  "tiroides",
  "problemas_hepaticos",
] as const;

export const PERSONAL_CONDITIONS = [
  "alergia_medicamentos",
  "cancer",
  "hipertension",
  "diabetes",
  "problemas_cardiacos",
  "problemas_renales",
  "tiroides",
  "problemas_hepaticos",
  "otros",
] as const;

export const CONDITION_LABELS: Record<string, string> = {
  cancer: "Cáncer",
  hipertension: "Hipertensión",
  diabetes: "Diabetes",
  problemas_cardiacos: "Problemas cardíacos",
  problemas_renales: "Problemas renales",
  tiroides: "Tiroides",
  problemas_hepaticos: "Problemas hepáticos",
  alergia_medicamentos: "Alergia a medicamentos",
  otros: "Otros",
};

export type FamilyCondition = typeof FAMILY_CONDITIONS[number];
export type PersonalCondition = typeof PERSONAL_CONDITIONS[number];

interface ConditionEntry {
  condition: string;
  has_condition: boolean;
  notes: string | null;
}

interface MedicationEntry {
  id?: number;
  condition: string;
  medication_text: string;
}

export async function isCompleted(patientId: number): Promise<boolean> {
  const { rows } = await pool.query(
    "SELECT medical_history_completed FROM patients WHERE id = $1",
    [patientId]
  );
  return rows[0]?.medical_history_completed ?? false;
}

export async function getFamilyHistory(patientId: number): Promise<ConditionEntry[]> {
  const { rows } = await pool.query(
    "SELECT condition, has_condition, notes FROM patient_family_history WHERE patient_id = $1 ORDER BY id",
    [patientId]
  );
  return rows;
}

export async function getPersonalHistory(patientId: number): Promise<ConditionEntry[]> {
  const { rows } = await pool.query(
    "SELECT condition, has_condition, notes FROM patient_personal_history WHERE patient_id = $1 ORDER BY id",
    [patientId]
  );
  return rows;
}

export async function getMedications(patientId: number): Promise<MedicationEntry[]> {
  const { rows } = await pool.query(
    "SELECT id, condition, medication_text FROM patient_medications WHERE patient_id = $1 ORDER BY id",
    [patientId]
  );
  return rows;
}

export async function getFullHistory(patientId: number) {
  const [familyHistory, personalHistory, medications, completed] = await Promise.all([
    getFamilyHistory(patientId),
    getPersonalHistory(patientId),
    getMedications(patientId),
    isCompleted(patientId),
  ]);
  return { familyHistory, personalHistory, medications, completed };
}

export async function saveHistory(
  patientId: number,
  data: {
    familyHistory: ConditionEntry[];
    personalHistory: ConditionEntry[];
    medications: MedicationEntry[];
  }
) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // Upsert family history
    for (const entry of data.familyHistory) {
      await client.query(
        `INSERT INTO patient_family_history (patient_id, condition, has_condition, notes, updated_at)
         VALUES ($1, $2, $3, $4, NOW())
         ON CONFLICT (patient_id, condition)
         DO UPDATE SET has_condition = $3, notes = $4, updated_at = NOW()`,
        [patientId, entry.condition, entry.has_condition, entry.notes || null]
      );
    }

    // Upsert personal history
    for (const entry of data.personalHistory) {
      await client.query(
        `INSERT INTO patient_personal_history (patient_id, condition, has_condition, notes, updated_at)
         VALUES ($1, $2, $3, $4, NOW())
         ON CONFLICT (patient_id, condition)
         DO UPDATE SET has_condition = $3, notes = $4, updated_at = NOW()`,
        [patientId, entry.condition, entry.has_condition, entry.notes || null]
      );
    }

    // Replace medications
    await client.query("DELETE FROM patient_medications WHERE patient_id = $1", [patientId]);
    for (const med of data.medications) {
      if (med.medication_text.trim()) {
        await client.query(
          `INSERT INTO patient_medications (patient_id, condition, medication_text)
           VALUES ($1, $2, $3)`,
          [patientId, med.condition, med.medication_text.trim()]
        );
      }
    }

    // Mark as completed
    await client.query(
      "UPDATE patients SET medical_history_completed = TRUE WHERE id = $1",
      [patientId]
    );

    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}
