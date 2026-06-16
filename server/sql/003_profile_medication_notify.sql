-- Per-profile notification preferences for assigned medications.
-- mysql -u medtracker -p medication_tracker < server/sql/003_profile_medication_notify.sql

USE medication_tracker;

ALTER TABLE profile_medications
  ADD COLUMN notify_when_due TINYINT(1) NOT NULL DEFAULT 0,
  ADD COLUMN notify_minutes_before INT UNSIGNED NULL DEFAULT NULL;
