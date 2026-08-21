import pool from "@/lib/db";

/**
 * Data-rights service — Ley 25.326 / Consent §6
 * Provides patient data export and erasure of identifying information.
 */

export async function exportPatientData(patientId: number) {
  // Resolve user_id from patients table
  const { rows: patientRows } = await pool.query(
    "SELECT id, user_id, date_of_birth, gender, height_cm FROM patients WHERE id = $1",
    [patientId]
  );
  if (patientRows.length === 0) throw new Error("Patient not found");
  const patient = patientRows[0];
  const userId = patient.user_id;

  // User info
  const { rows: userRows } = await pool.query(
    "SELECT id, email, first_name, last_name, phone, created_at FROM users WHERE id = $1",
    [userId]
  );
  const userInfo = userRows[0] ?? null;

  // Measurements
  const { rows: measurements } = await pool.query(
    "SELECT id, type, value, unit, context, notes, systolic, diastolic, recorded_at FROM measurements WHERE patient_id = $1 ORDER BY recorded_at DESC",
    [patientId]
  );

  // Alerts
  const { rows: alerts } = await pool.query(
    "SELECT id, type, severity, title, message, read, created_at FROM alerts WHERE patient_id = $1 ORDER BY created_at DESC",
    [patientId]
  );

  // Appointments
  const { rows: appointments } = await pool.query(
    "SELECT id, scheduled_at, type, status, reason, notes, attendance_status, created_at FROM appointments WHERE patient_id = $1 ORDER BY scheduled_at DESC",
    [patientId]
  );

  // Prescriptions + items
  const { rows: prescriptions } = await pool.query(
    `SELECT p.id, p.diagnosis, p.notes, p.created_at,
            json_agg(json_build_object(
              'id', pi.id, 'medication_name', pi.medication_name,
              'dose', pi.dose, 'frequency', pi.frequency, 'route', pi.route
            )) FILTER (WHERE pi.id IS NOT NULL) AS items
     FROM prescriptions p
     LEFT JOIN prescription_items pi ON pi.prescription_id = p.id
     WHERE p.patient_id = $1
     GROUP BY p.id
     ORDER BY p.created_at DESC`,
    [patientId]
  );

  // Checkups + completions
  const { rows: checkupCompletions } = await pool.query(
    `SELECT cc.id, cc.patient_checkup_id, ct.name AS checkup_name, cc.completed_at, cc.notes
     FROM checkup_completions cc
     JOIN patient_checkups pc ON pc.id = cc.patient_checkup_id
     JOIN checkup_types ct ON ct.id = pc.checkup_type_id
     WHERE pc.patient_id = $1
     ORDER BY cc.completed_at DESC`,
    [patientId]
  );

  // Medical history — family
  const { rows: familyHistory } = await pool.query(
    "SELECT id, condition, has_condition, notes FROM patient_family_history WHERE patient_id = $1",
    [patientId]
  );

  // Medical history — personal
  const { rows: personalHistory } = await pool.query(
    "SELECT id, condition, has_condition, notes FROM patient_personal_history WHERE patient_id = $1",
    [patientId]
  );

  // Medical history — medications
  const { rows: patientMedications } = await pool.query(
    "SELECT id, condition, medication_text FROM patient_medications WHERE patient_id = $1",
    [patientId]
  );

  // Lab results
  const { rows: labResults } = await pool.query(
    "SELECT id, timepoint, analyte, value, unit, source, collected_on, verified_by, verified_at FROM lab_results WHERE patient_id = $1 ORDER BY collected_on DESC",
    [patientId]
  );

  // Body composition
  const { rows: bodyComposition } = await pool.query(
    "SELECT id, adipose_pct, muscle_pct, recorded_at FROM body_composition WHERE patient_id = $1 ORDER BY recorded_at DESC",
    [patientId]
  );

  // App sessions
  const { rows: appSessions } = await pool.query(
    "SELECT id, channel, started_at FROM app_sessions WHERE patient_id = $1 ORDER BY started_at DESC",
    [patientId]
  );

  // Study participation
  let studyParticipation = null;
  const { rows: spRows } = await pool.query(
    "SELECT * FROM study_participants WHERE patient_id = $1",
    [patientId]
  );
  if (spRows.length > 0) {
    const sp = spRows[0];
    const { rows: visits } = await pool.query(
      "SELECT id, visit_type, scheduled_date, performed_date, notes FROM study_visits WHERE participant_id = $1 ORDER BY scheduled_date",
      [sp.id]
    );
    studyParticipation = {
      participant_code: sp.participant_code,
      arm: sp.arm,
      consent_version: sp.consent_version,
      consent_signed_at: sp.consent_signed_at,
      enrolled_at: sp.enrolled_at,
      withdrawn_at: sp.withdrawn_at,
      withdrawal_reason: sp.withdrawal_reason,
      visits,
    };
  }

  return {
    exported_at: new Date().toISOString(),
    user: userInfo
      ? {
          first_name: userInfo.first_name,
          last_name: userInfo.last_name,
          email: userInfo.email,
          phone: userInfo.phone,
          date_of_birth: patient.date_of_birth,
          gender: patient.gender,
          height_cm: patient.height_cm,
          account_created_at: userInfo.created_at,
        }
      : null,
    measurements,
    alerts,
    appointments,
    prescriptions,
    checkup_completions: checkupCompletions,
    medical_history: {
      family: familyHistory,
      personal: personalHistory,
      medications: patientMedications,
    },
    lab_results: labResults,
    body_composition: bodyComposition,
    app_sessions: appSessions,
    study_participation: studyParticipation,
  };
}

export async function erasePatientData(patientId: number, adminUserId: number) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // Resolve user_id
    const { rows: patientRows } = await client.query(
      "SELECT id, user_id FROM patients WHERE id = $1",
      [patientId]
    );
    if (patientRows.length === 0) throw new Error("Patient not found");
    const userId = patientRows[0].user_id;

    // Get current identifying info for the audit log
    const { rows: userRows } = await client.query(
      "SELECT first_name, last_name, email, phone FROM users WHERE id = $1",
      [userId]
    );
    const originalUser = userRows[0];

    // Null out identifying fields on users
    await client.query(
      `UPDATE users
       SET first_name = NULL, last_name = NULL, phone = NULL,
           email = $1
       WHERE id = $2`,
      [`erased_${userId}@deleted`, userId]
    );

    // Null out identifying fields on patients
    await client.query(
      "UPDATE patients SET date_of_birth = NULL, gender = NULL WHERE id = $1",
      [patientId]
    );

    // Build description of what was erased
    const erasedFields: string[] = [];
    if (originalUser.first_name) erasedFields.push("first_name");
    if (originalUser.last_name) erasedFields.push("last_name");
    if (originalUser.email) erasedFields.push("email");
    if (originalUser.phone) erasedFields.push("phone");
    erasedFields.push("date_of_birth", "gender");

    const description = `Data erasure (Ley 25.326): nulled identifying fields [${erasedFields.join(", ")}] for user ${userId}. Participant code and clinical data retained.`;

    // Write study_incidents entry if participant exists
    const { rows: spRows } = await client.query(
      "SELECT id FROM study_participants WHERE patient_id = $1",
      [patientId]
    );
    if (spRows.length > 0) {
      await client.query(
        `INSERT INTO study_incidents (participant_id, occurred_on, kind, description, recorded_by)
         VALUES ($1, CURRENT_DATE, 'erasure', $2, $3)`,
        [spRows[0].id, description, adminUserId]
      );
    }

    await client.query("COMMIT");

    return {
      erased: true,
      user_id: userId,
      patient_id: patientId,
      fields_erased: erasedFields,
      description,
    };
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}
