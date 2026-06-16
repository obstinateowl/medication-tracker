CREATE DATABASE IF NOT EXISTS medication_tracker
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE medication_tracker;

CREATE TABLE IF NOT EXISTS profiles (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_profiles_name (name)
);

CREATE TABLE IF NOT EXISTS medications (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(150) NOT NULL,
  interval_minutes INT UNSIGNED NULL,
  max_per_day INT UNSIGNED NULL,
  waiting_message VARCHAR(200) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS profile_medications (
  profile_id INT UNSIGNED NOT NULL,
  medication_id INT UNSIGNED NOT NULL,
  PRIMARY KEY (profile_id, medication_id),
  CONSTRAINT fk_pm_profile FOREIGN KEY (profile_id) REFERENCES profiles (id) ON DELETE CASCADE,
  CONSTRAINT fk_pm_medication FOREIGN KEY (medication_id) REFERENCES medications (id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS dose_logs (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  profile_id INT UNSIGNED NOT NULL,
  medication_id INT UNSIGNED NOT NULL,
  taken_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  logged_by_profile_id INT UNSIGNED NULL,
  CONSTRAINT fk_dl_profile FOREIGN KEY (profile_id) REFERENCES profiles (id) ON DELETE CASCADE,
  CONSTRAINT fk_dl_medication FOREIGN KEY (medication_id) REFERENCES medications (id) ON DELETE CASCADE,
  CONSTRAINT fk_dl_logged_by FOREIGN KEY (logged_by_profile_id) REFERENCES profiles (id) ON DELETE SET NULL,
  INDEX idx_dose_logs_profile_med_taken (profile_id, medication_id, taken_at)
);
