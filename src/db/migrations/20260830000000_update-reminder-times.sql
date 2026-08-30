-- Update glucemia reminder cron times to agreed schedule:
-- Fasting: 7:00 AM ART (was 7:00 — unchanged)
-- Postprandial: 2:00 PM ART (was 2:30 PM)
-- Pre-dinner: 7:00 PM ART (was 7:30 PM)

UPDATE message_schedule_rules SET cron_expr = '0 14 * * *' WHERE template_key = 'glucemia_reminder_postprandial';
UPDATE message_schedule_rules SET cron_expr = '0 19 * * *' WHERE template_key = 'glucemia_reminder_pre_dinner';

-- Down
-- UPDATE message_schedule_rules SET cron_expr = '30 14 * * *' WHERE template_key = 'glucemia_reminder_postprandial';
-- UPDATE message_schedule_rules SET cron_expr = '30 19 * * *' WHERE template_key = 'glucemia_reminder_pre_dinner';
