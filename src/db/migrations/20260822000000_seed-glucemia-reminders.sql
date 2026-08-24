-- Seed 3 glucemia reminder templates + schedule rules
-- These are system templates, pre-approved and active.

-- En ayunas (fasting) reminder
INSERT INTO message_templates (key, version, channel, category, body, variables, active, approved_at)
VALUES (
  'glucemia_reminder_fasting', 1, 'push', 'reminder',
  'Hola {{nombre}}. Recordá medir tu glucemia en ayunas antes de desayunar. Registrala en GlycoFit cuando estés lista.',
  '["nombre"]'::jsonb,
  true, NOW()
);

-- 2h post almuerzo (postprandial) reminder
INSERT INTO message_templates (key, version, channel, category, body, variables, active, approved_at)
VALUES (
  'glucemia_reminder_postprandial', 1, 'push', 'reminder',
  'Hola {{nombre}}. Ya pasaron 2 horas desde el almuerzo — es buen momento para medir tu glucemia postprandial.',
  '["nombre"]'::jsonb,
  true, NOW()
);

-- Antes de cenar (pre_dinner) reminder
INSERT INTO message_templates (key, version, channel, category, body, variables, active, approved_at)
VALUES (
  'glucemia_reminder_pre_dinner', 1, 'push', 'reminder',
  'Hola {{nombre}}. Antes de cenar, medí tu glucemia y registrala en GlycoFit.',
  '["nombre"]'::jsonb,
  true, NOW()
);

-- Schedule rules: cron times in Argentina time (UTC-3)
-- Scheduler cron runs every 5 min, so use multiples of 5

-- Fasting: 7:00 AM Argentina
INSERT INTO message_schedule_rules (template_key, trigger_type, cron_expr, params)
VALUES ('glucemia_reminder_fasting', 'cron', '0 7 * * *', '{"measurement_context": "fasting"}');

-- Postprandial: 2:30 PM Argentina
INSERT INTO message_schedule_rules (template_key, trigger_type, cron_expr, params)
VALUES ('glucemia_reminder_postprandial', 'cron', '30 14 * * *', '{"measurement_context": "postprandial"}');

-- Pre-dinner: 7:30 PM Argentina
INSERT INTO message_schedule_rules (template_key, trigger_type, cron_expr, params)
VALUES ('glucemia_reminder_pre_dinner', 'cron', '30 19 * * *', '{"measurement_context": "pre_dinner"}');
