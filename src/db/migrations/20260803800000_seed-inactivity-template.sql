-- Up
INSERT INTO message_templates (key, version, channel, category, locale, body, variables, active)
VALUES (
  'inactivity_reminder', 1, 'whatsapp', 'utility', 'es_AR',
  'Hola {{nombre}}, hace {{dias}} días que no registrás tus mediciones en GlycoFit. Recordá que el seguimiento regular es clave para tu salud. ¿Necesitás ayuda? Escribinos.',
  '["nombre", "dias"]',
  true
);

INSERT INTO message_schedule_rules (template_key, trigger_type, params, active)
VALUES (
  'inactivity_reminder', 'inactivity',
  '{"days_threshold": 3}',
  true
);

-- Down
DELETE FROM message_schedule_rules WHERE template_key = 'inactivity_reminder' AND trigger_type = 'inactivity';
DELETE FROM message_templates WHERE key = 'inactivity_reminder' AND version = 1;
