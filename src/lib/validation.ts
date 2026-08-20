import { z } from "zod";

export const loginSchema = z.object({
  email: z.string().email("Email válido requerido"),
  password: z.string().min(1, "Contraseña requerida"),
});

export const registerSchema = z.object({
  email: z.string().email("Email válido requerido"),
  password: z.string().min(8, "La contraseña debe tener al menos 8 caracteres"),
  first_name: z.string().min(1, "Nombre requerido").max(100),
  last_name: z.string().min(1, "Apellido requerido").max(100),
  date_of_birth: z.string().optional(),
  gender: z.enum(["male", "female", "other"]).optional(),
  phone: z.string().max(30).optional(),
  doctorCode: z.string().optional(),
  role: z.enum(["patient", "doctor"]).optional(),
});

export const measurementSchema = z.object({
  type: z.enum(["glucemia", "blood_pressure", "weight"], {
    error: "Tipo debe ser glucemia, blood_pressure o weight",
  }),
  value: z.number().optional(),
  systolic: z.number().min(40).max(300).optional(),
  diastolic: z.number().min(20).max(200).optional(),
  context: z.enum(["fasting", "postprandial", "pre_dinner", "random"]).optional(),
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

export const updateAccountSchema = z.object({
  first_name: z.string().min(1, "Nombre requerido").max(100),
  last_name: z.string().min(1, "Apellido requerido").max(100),
  phone: z.string().max(30).optional(),
  date_of_birth: z.string().optional(),
  gender: z.enum(["male", "female", "other"]).optional(),
});

export const changePasswordSchema = z.object({
  current_password: z.string().min(1, "Contraseña actual requerida"),
  new_password: z.string().min(8, "La nueva contraseña debe tener al menos 8 caracteres"),
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
  checkup_type_id: z.number().int().positive().optional(),
});

export const updateAppointmentSchema = z.object({
  scheduled_at: z.string().min(1).optional(),
  duration_minutes: z.number().int().min(5).max(480).optional(),
  location: z.string().max(500).optional(),
  type: z.enum(["in_person", "virtual", "phone"]).optional(),
  status: z.enum(["pending", "confirmed", "cancelled", "completed"]).optional(),
  reason: z.string().max(1000).optional(),
  notes: z.string().max(2000).optional(),
  attendance_status: z.enum(["scheduled", "attended", "no_show", "cancelled_by_patient", "cancelled_by_clinic", "rescheduled"]).optional(),
}).refine(
  data => Object.values(data).some(v => v !== undefined),
  { message: "Al menos un campo requerido" }
);

export const completeCheckupSchema = z.object({
  completed_at: z.string({ message: "Fecha requerida" }).min(1, "Fecha requerida"),
  notes: z.string().max(2000).optional(),
});

export const checkupOnboardingSchema = z.object({
  entries: z.array(z.object({
    patient_checkup_id: z.number({ message: "patient_checkup_id requerido" }).int().positive(),
    last_completed_at: z.string().nullable(),
  })).min(1, "Al menos una entrada requerida"),
});

export const updatePatientCheckupSchema = z.object({
  frequency_months_override: z.number().int().min(1).max(60).nullable().optional(),
  active: z.boolean().optional(),
}).refine(
  data => data.frequency_months_override !== undefined || data.active !== undefined,
  { message: "Al menos un campo requerido" }
);

export const forgotPasswordSchema = z.object({
  email: z.string().email("Email válido requerido"),
});

export const resetPasswordSchema = z.object({
  token: z.string().min(1, "Token requerido"),
  password: z.string().min(8, "La contraseña debe tener al menos 8 caracteres"),
});

export const verifyEmailSchema = z.object({
  token: z.string().min(1, "Token requerido"),
});

export const resendVerificationSchema = z.object({
  email: z.string().email("Email válido requerido"),
});

// Template schemas

export const createTemplateSchema = z.object({
  key: z.string().min(1, "Key requerido").max(100),
  channel: z.enum(["whatsapp", "push"], {
    error: "Canal debe ser whatsapp o push",
  }),
  category: z.string().min(1, "Categoría requerida").max(100),
  body: z.string().min(1, "Cuerpo del mensaje requerido"),
  variables: z.array(z.string()).default([]),
});

export const newVersionSchema = z.object({
  body: z.string().min(1, "Cuerpo del mensaje requerido"),
  variables: z.array(z.string()).default([]),
});

// Study schemas

export const studyArmEnum = z.enum(["intervention", "control"], {
  error: "Brazo debe ser intervention o control",
});

export const enrollParticipantSchema = z.object({
  patientId: z.number({ message: "patient_id requerido" }).int().positive(),
  arm: studyArmEnum.optional(),
  consentVersion: z.string().min(1, "Versión de consentimiento requerida"),
  consentSignedAt: z.string().min(1, "Fecha de firma requerida"),
  baselineHba1c: z.number().min(0).max(20).optional(),
});

export const changeArmSchema = z.object({
  newArm: studyArmEnum,
  reason: z.string().min(1, "Razón requerida"),
});

export const withdrawParticipantSchema = z.object({
  reason: z.string().min(1, "Razón requerida"),
});

export const screeningSchema = z.object({
  patientId: z.number({ message: "patient_id requerido" }).int().positive(),
  eligible: z.boolean({ message: "eligible requerido" }),
  reason: z.string().optional(),
});

export const incidentSchema = z.object({
  participantId: z.number({ message: "participant_id requerido" }).int().positive(),
  occurredOn: z.string().min(1, "Fecha requerida"),
  kind: z.string().min(1, "Tipo de incidente requerido"),
  description: z.string().min(1, "Descripción requerida"),
});

export const manualLabResultSchema = z.object({
  timepoint: z.enum(["baseline", "month_3", "month_6", "unscheduled"], {
    message: "Timepoint debe ser baseline, month_3, month_6 o unscheduled",
  }),
  collectedOn: z.string().min(1, "Fecha de recolección requerida"),
  analyte: z.enum(
    ["hba1c", "glucose_fasting", "total_cholesterol", "hdl", "ldl", "triglycerides", "urea", "creatinine"],
    { message: "Analito inválido" }
  ),
  value: z.number({ message: "Valor numérico requerido" }).positive("El valor debe ser positivo"),
  unit: z.string().min(1, "Unidad requerida").max(30),
  studyVisitId: z.number().int().positive().optional(),
});

// Questionnaire schemas

export const createQuestionnaireSchema = z.object({
  code: z.string().min(1, "Código requerido").max(100),
  title: z.string().min(1, "Título requerido").max(500),
  description: z.string().max(2000).optional(),
  items: z.array(z.object({
    item_order: z.number().int().positive(),
    prompt: z.string().min(1, "Pregunta requerida"),
    response_type: z.enum(["single_choice", "likert_5", "numeric", "free_text"], {
      message: "Tipo debe ser single_choice, likert_5, numeric o free_text",
    }),
    options: z.array(z.string()).optional(),
    required: z.boolean().optional(),
  })).min(1, "Al menos una pregunta requerida"),
});

export const submitQuestionnaireSchema = z.object({
  answers: z.array(z.object({
    itemId: z.number().int().positive(),
    value: z.string().min(1, "Respuesta requerida"),
  })).min(1, "Al menos una respuesta requerida"),
  studyVisitId: z.number().int().positive().optional(),
});

export const verifyLabResultsSchema = z.object({
  labResultIds: z.array(
    z.number().int().positive()
  ).min(1, "Al menos un resultado requerido"),
});

export const setFlagSchema = z.object({
  flagKey: z.string().min(1, "Flag key requerido"),
  arm: studyArmEnum,
  enabled: z.boolean({ message: "enabled requerido" }),
  reason: z.string().optional(),
});
