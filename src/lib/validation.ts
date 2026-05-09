import { z } from "zod";

export const loginSchema = z.object({
  email: z.string().email("Email válido requerido"),
  password: z.string().min(1, "Contraseña requerida"),
});

export const registerSchema = z.object({
  email: z.string().email("Email válido requerido"),
  password: z.string().min(8, "La contraseña debe tener al menos 8 caracteres"),
});

export const measurementSchema = z.object({
  type: z.enum(["glucemia", "blood_pressure", "weight"], {
    error: "Tipo debe ser glucemia, blood_pressure o weight",
  }),
  value: z.number().optional(),
  systolic: z.number().min(40).max(300).optional(),
  diastolic: z.number().min(20).max(200).optional(),
  context: z.enum(["fasting", "postprandial", "pre_dinner"]).optional(),
  notes: z.string().optional(),
}).refine(
  data => data.type !== "blood_pressure" || (!!data.systolic && !!data.diastolic),
  { message: "Sistólica y diastólica requeridas" }
).refine(
  data => data.type !== "blood_pressure" || !data.systolic || !data.diastolic || data.systolic > data.diastolic,
  { message: "La presión sistólica debe ser mayor que la diastólica" }
).refine(
  data => data.type !== "glucemia" || !!data.context,
  { message: "Contexto requerido para glucemia (en ayunas, postprandial, antes de cenar)" }
);

export const deviceTokenSchema = z.object({
  token: z.string().min(16).max(512),
  platform: z.enum(["ios", "android", "web"]),
});

export const createUserSchema = z.object({
  email: z.string().email("Email válido requerido"),
  password: z.string().min(8, "La contraseña debe tener al menos 8 caracteres"),
  role: z.enum(["patient", "doctor", "admin"], {
    error: "Rol debe ser patient, doctor o admin",
  }),
});

export const assignPatientSchema = z.object({
  doctor_user_id: z.number({ message: "doctor_user_id requerido" }).int().positive(),
  patient_id: z.number({ message: "patient_id requerido" }).int().positive(),
});

export const createAppointmentSchema = z.object({
  patient_id: z.number({ message: "patient_id requerido" }).int().positive(),
  scheduled_at: z.string({ message: "Fecha requerida" }).min(1, "Fecha requerida"),
  duration_minutes: z.number().int().min(5).max(480).optional(),
  location: z.string().max(500).optional(),
  type: z.enum(["in_person", "virtual", "phone"]).optional(),
  reason: z.string().max(1000).optional(),
  notes: z.string().max(2000).optional(),
});

export const updateAppointmentSchema = z.object({
  scheduled_at: z.string().min(1).optional(),
  duration_minutes: z.number().int().min(5).max(480).optional(),
  location: z.string().max(500).optional(),
  type: z.enum(["in_person", "virtual", "phone"]).optional(),
  status: z.enum(["pending", "confirmed", "cancelled", "completed"]).optional(),
  reason: z.string().max(1000).optional(),
  notes: z.string().max(2000).optional(),
}).refine(
  data => Object.values(data).some(v => v !== undefined),
  { message: "Al menos un campo requerido" }
);
