import pool from "@/lib/db";
import { checkAndCreateAlert } from "@/lib/alerts";
import { getGlucemiaStatus, getBloodPressureStatus, type VitalStatus, type MeasurementContext } from "@/lib/thresholds";

interface CreateMeasurementInput {
  patientId: number;
  type: string;
  value?: number;
  systolic?: number;
  diastolic?: number;
  context?: string;
  notes?: string;
}

export async function listByPatient(patientId: number, limit = 50) {
  const { rows } = await pool.query(
    "SELECT id, type, value, unit, context, notes, recorded_at FROM measurements WHERE patient_id = $1 ORDER BY recorded_at DESC LIMIT $2",
    [patientId, limit]
  );
  return rows;
}

export async function listPaginated(
  patientId: number,
  options: { page: number; limit: number; type?: string }
) {
  const { page, limit, type } = options;
  const offset = (page - 1) * limit;

  let query = "SELECT * FROM measurements WHERE patient_id = $1";
  let countQuery = "SELECT COUNT(*) FROM measurements WHERE patient_id = $1";
  const queryParams: (number | string)[] = [patientId];
  const countParams: (number | string)[] = [patientId];

  if (type && ["glucemia", "blood_pressure"].includes(type)) {
    query += " AND type = $2";
    countQuery += " AND type = $2";
    queryParams.push(type);
    countParams.push(type);
  }

  query += ` ORDER BY recorded_at DESC LIMIT $${queryParams.length + 1} OFFSET $${queryParams.length + 2}`;
  queryParams.push(limit, offset);

  const [dataResult, countResult] = await Promise.all([
    pool.query(query, queryParams),
    pool.query(countQuery, countParams),
  ]);

  const total = parseInt(countResult.rows[0].count, 10);

  return {
    data: dataResult.rows,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
}

export async function getChartData(
  patientId: number,
  type: string,
  from?: string,
  to?: string
) {
  let query = `SELECT id, type, value, unit, context, notes, recorded_at
               FROM measurements WHERE patient_id = $1 AND type = $2`;
  const queryParams: (number | string)[] = [patientId, type];

  if (from) {
    queryParams.push(from);
    query += ` AND recorded_at >= $${queryParams.length}`;
  }
  if (to) {
    queryParams.push(to);
    query += ` AND recorded_at <= $${queryParams.length}`;
  }

  query += " ORDER BY recorded_at ASC";

  const [dataResult, rangesResult] = await Promise.all([
    pool.query(query, queryParams),
    pool.query(
      "SELECT sub_type, min_value, max_value, unit FROM measurement_reference_ranges WHERE type = $1",
      [type]
    ),
  ]);

  const referenceRanges: Record<string, { min: number; max: number; unit: string }> = {};
  for (const r of rangesResult.rows) {
    const key = r.sub_type || "value";
    referenceRanges[key] = { min: Number(r.min_value), max: Number(r.max_value), unit: r.unit };
  }

  return { type, data: dataResult.rows, referenceRanges };
}

export async function create(input: CreateMeasurementInput) {
  const { patientId, type, value, systolic, diastolic, context, notes } = input;

  let measValue: number;
  let unit: string;
  let measNotes = notes || null;

  if (type === "blood_pressure") {
    measValue = systolic!;
    unit = "mmHg";
    measNotes = `diastolic:${diastolic}${notes ? ` ${notes}` : ""}`;
  } else if (type === "glucemia") {
    measValue = Number(value) || 0;
    unit = "mg/dL";
  } else if (type === "weight") {
    measValue = Number(value) || 0;
    unit = "kg";
  } else {
    measValue = Number(value) || 0;
    unit = "";
  }

  const { rows } = await pool.query(
    `INSERT INTO measurements (patient_id, type, value, unit, context, recorded_by, notes, recorded_at)
     VALUES ($1, $2, $3, $4, $5, 'self', $6, NOW()) RETURNING *`,
    [patientId, type, measValue, unit, context || null, measNotes]
  );

  const measurement = rows[0];
  const alertResult = await checkAndCreateAlert(measurement);

  const ctx = (context as MeasurementContext) || undefined;
  let status: VitalStatus = "normal";
  if (alertResult) {
    status = alertResult.status;
  } else if (type === "glucemia") {
    status = getGlucemiaStatus(measValue, ctx);
  } else if (type === "blood_pressure") {
    status = getBloodPressureStatus(measValue, diastolic!);
  }

  return { measurement, alert: alertResult, status };
}
