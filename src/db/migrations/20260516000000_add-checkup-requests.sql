-- Checkup order requests: patients request orders from their doctor
CREATE TABLE checkup_requests (
  id SERIAL PRIMARY KEY,
  patient_checkup_id INT NOT NULL REFERENCES patient_checkups(id),
  patient_id INT NOT NULL REFERENCES patients(id),
  doctor_id INT NOT NULL REFERENCES doctors(id),
  status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'seen')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  seen_at TIMESTAMPTZ
);

CREATE INDEX idx_checkup_requests_doctor_status ON checkup_requests(doctor_id, status) WHERE status = 'pending';
CREATE INDEX idx_checkup_requests_patient_checkup ON checkup_requests(patient_checkup_id, status);
