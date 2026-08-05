ALTER TABLE appointments
  ADD COLUMN IF NOT EXISTS attendance_status TEXT DEFAULT 'scheduled'
    CHECK (attendance_status IN ('scheduled','attended','no_show','cancelled_by_patient','cancelled_by_clinic','rescheduled')),
  ADD COLUMN IF NOT EXISTS attendance_recorded_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS attendance_recorded_by INTEGER REFERENCES users(id);
