-- Insert mock glucemia measurements for juancruzlambrechts@gmail.com
-- Spans the last 3 months with realistic daily readings across all contexts

DO $$
DECLARE
  v_patient_id INTEGER;
  v_day DATE;
  v_base NUMERIC;
  v_val NUMERIC;
BEGIN
  -- Resolve patient_id from email
  SELECT p.id INTO v_patient_id
  FROM patients p
  JOIN users u ON u.id = p.user_id
  WHERE u.email = 'juancruzlambrechts@gmail.com';

  IF v_patient_id IS NULL THEN
    RAISE NOTICE 'User not found, skipping seed';
    RETURN;
  END IF;

  -- Delete existing mock data to avoid duplicates on re-run
  DELETE FROM measurements
  WHERE patient_id = v_patient_id
    AND type = 'glucemia'
    AND recorded_at >= NOW() - INTERVAL '90 days';

  -- Generate 90 days of data
  FOR v_day IN SELECT generate_series(
    (CURRENT_DATE - INTERVAL '90 days')::date,
    CURRENT_DATE,
    '1 day'::interval
  )::date
  LOOP
    -- Simulate a gradual improvement trend: higher values 90 days ago, lower now
    v_base := 130 - (CURRENT_DATE - v_day) * 0.15;

    -- Fasting reading (morning) — typically 80-130
    v_val := v_base - 20 + (random() * 30);
    INSERT INTO measurements (patient_id, type, value, unit, context, recorded_at)
    VALUES (v_patient_id, 'glucemia', round(v_val), 'mg/dL', 'fasting',
            v_day + TIME '07:30' + (random() * INTERVAL '45 minutes'));

    -- Postprandial reading (after lunch) — typically 120-180
    v_val := v_base + 30 + (random() * 40);
    INSERT INTO measurements (patient_id, type, value, unit, context, recorded_at)
    VALUES (v_patient_id, 'glucemia', round(v_val), 'mg/dL', 'postprandial',
            v_day + TIME '13:30' + (random() * INTERVAL '60 minutes'));

    -- Pre-dinner reading — typically 90-140
    IF random() > 0.3 THEN  -- ~70% of days have a pre-dinner reading
      v_val := v_base - 5 + (random() * 30);
      INSERT INTO measurements (patient_id, type, value, unit, context, recorded_at)
      VALUES (v_patient_id, 'glucemia', round(v_val), 'mg/dL', 'pre_dinner',
              v_day + TIME '19:00' + (random() * INTERVAL '60 minutes'));
    END IF;

    -- Random reading — occasional, ~20% of days
    IF random() > 0.8 THEN
      v_val := v_base + 10 + (random() * 50);
      INSERT INTO measurements (patient_id, type, value, unit, context, recorded_at)
      VALUES (v_patient_id, 'glucemia', round(v_val), 'mg/dL', 'random',
              v_day + TIME '16:00' + (random() * INTERVAL '120 minutes'));
    END IF;

    -- Occasional spike days (~10%) to simulate outliers
    IF random() > 0.9 THEN
      v_val := 200 + (random() * 60);
      INSERT INTO measurements (patient_id, type, value, unit, context, recorded_at)
      VALUES (v_patient_id, 'glucemia', round(v_val), 'mg/dL', 'postprandial',
              v_day + TIME '15:00' + (random() * INTERVAL '30 minutes'));
    END IF;
  END LOOP;

  RAISE NOTICE 'Seeded glucemia data for patient_id %', v_patient_id;
END $$;
