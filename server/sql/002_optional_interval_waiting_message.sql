-- Run against medication_tracker on your MariaDB server.
-- mysql -u medtracker -p medication_tracker < server/sql/002_optional_interval_waiting_message.sql

USE medication_tracker;

ALTER TABLE medications
  MODIFY COLUMN interval_minutes INT UNSIGNED NULL,
  ADD COLUMN waiting_message VARCHAR(200) NULL AFTER max_per_day;
