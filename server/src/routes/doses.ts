import { Router } from "express";
import pool, {
  type DoseLogRow,
  type MedicationRow,
  type ResultSetHeader,
  type RowDataPacket,
} from "../db.js";
import {
  parseTakenAt,
  validateBackdatedDose,
  validateEditedDose,
  validateImmediateDose,
} from "../doseValidation.js";
import {
  DOSE_LOG_SELECT,
  fetchDoseLogById,
  fetchDoseLogsForProfile,
} from "../doseLogQueries.js";
import { MEDICATION_COLUMNS } from "../medicationFields.js";
import { startOfLocalDay, endOfLocalDay } from "../medStatus.js";
import { getDoseHistoryForProfile } from "../doseHistory.js";
import { getMedStatusesForProfile } from "./profileMedications.js";
import { refreshMqttState } from "../mqtt/poller.js";

const router = Router();

type ExistsRow = RowDataPacket & { ok: number };

router.post("/", async (req, res, next) => {
  try {
    const profileId = Number(req.body.profile_id);
    const medicationId = Number(req.body.medication_id);
    const loggedByProfileId =
      req.body.logged_by_profile_id != null
        ? Number(req.body.logged_by_profile_id)
        : profileId;
    const takenAtRaw = req.body.taken_at;
    const takenAtParsed = parseTakenAt(takenAtRaw);
    const isBackdated = takenAtRaw != null && takenAtRaw !== "";

    if (!Number.isFinite(profileId) || !Number.isFinite(medicationId)) {
      res.status(400).json({ error: "profile_id and medication_id are required" });
      return;
    }

    if (isBackdated && !takenAtParsed) {
      res.status(400).json({ error: "taken_at must be a valid ISO date/time" });
      return;
    }

    const [assignRows] = await pool.query<ExistsRow[]>(
      `SELECT 1 AS ok FROM profile_medications WHERE profile_id = ? AND medication_id = ?`,
      [profileId, medicationId]
    );
    if (assignRows.length === 0) {
      res.status(400).json({ error: "Medication is not assigned to this profile" });
      return;
    }

    const [medRows] = await pool.query<MedicationRow[]>(
      `SELECT ${MEDICATION_COLUMNS} FROM medications WHERE id = ?`,
      [medicationId]
    );
    if (medRows.length === 0) {
      res.status(404).json({ error: "Medication not found" });
      return;
    }
    const med = medRows[0];
    const now = new Date();

    const validation = isBackdated
      ? await validateBackdatedDose(
          profileId,
          medicationId,
          med,
          takenAtParsed!,
          now,
          undefined,
          true
        )
      : await validateImmediateDose(profileId, medicationId, med, now);

    if (!validation.ok) {
      res.status(409).json({
        error: validation.error,
        blocked_reason: validation.blocked_reason ?? null,
      });
      return;
    }

    const takenAt = isBackdated ? takenAtParsed! : now;

    const [result] = await pool.query<ResultSetHeader>(
      `INSERT INTO dose_logs (profile_id, medication_id, logged_by_profile_id, taken_at)
       VALUES (?, ?, ?, ?)`,
      [
        profileId,
        medicationId,
        loggedByProfileId !== profileId ? loggedByProfileId : null,
        takenAt,
      ]
    );

    const [logRows] = await pool.query<DoseLogRow[]>(
      `${DOSE_LOG_SELECT} WHERE dl.id = ?`,
      [result.insertId]
    );

    const updatedStatuses = await getMedStatusesForProfile(profileId);
    const updatedStatus = updatedStatuses.find((s) => s.id === medicationId);

    res.status(201).json({ log: logRows[0], status: updatedStatus });
    refreshMqttState();
  } catch (err) {
    next(err);
  }
});

router.get("/logs", async (req, res, next) => {
  try {
    const profileId = Number(req.query.profile_id);
    const days = req.query.days ? Number(req.query.days) : 30;

    if (!Number.isFinite(profileId)) {
      res.status(400).json({ error: "profile_id is required" });
      return;
    }
    if (!Number.isFinite(days) || days < 1 || days > 365) {
      res.status(400).json({ error: "days must be between 1 and 365" });
      return;
    }

    const logs = await fetchDoseLogsForProfile(pool, profileId, days);
    res.json(logs);
  } catch (err) {
    next(err);
  }
});

router.get("/history", async (req, res, next) => {
  try {
    const profileId = Number(req.query.profile_id);
    const days = req.query.days ? Number(req.query.days) : 7;

    if (!Number.isFinite(profileId)) {
      res.status(400).json({ error: "profile_id is required" });
      return;
    }
    if (!Number.isFinite(days) || days < 1 || days > 31) {
      res.status(400).json({ error: "days must be between 1 and 31" });
      return;
    }

    const history = await getDoseHistoryForProfile(pool, profileId, days);
    res.json(history);
  } catch (err) {
    next(err);
  }
});

router.get("/today", async (req, res, next) => {
  try {
    const profileId = req.query.profile_id ? Number(req.query.profile_id) : null;
    const dayStart = startOfLocalDay();
    const dayEnd = endOfLocalDay();

    let sql = `
      SELECT dl.id, dl.profile_id, dl.medication_id, dl.taken_at, dl.logged_by_profile_id,
             m.name AS medication_name,
             lb.name AS logged_by_name
      FROM dose_logs dl
      INNER JOIN medications m ON m.id = dl.medication_id
      LEFT JOIN profiles lb ON lb.id = dl.logged_by_profile_id
      WHERE dl.taken_at >= ? AND dl.taken_at <= ?
    `;
    const params: unknown[] = [dayStart, dayEnd];

    if (profileId) {
      sql += " AND dl.profile_id = ?";
      params.push(profileId);
    }
    sql += " ORDER BY dl.taken_at DESC";

    const [rows] = await pool.query<DoseLogRow[]>(sql, params);
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

router.put("/:id", async (req, res, next) => {
  try {
    const logId = Number(req.params.id);
    const takenAtParsed = parseTakenAt(req.body.taken_at);

    if (!Number.isFinite(logId)) {
      res.status(400).json({ error: "Invalid dose log id" });
      return;
    }
    if (!takenAtParsed) {
      res.status(400).json({ error: "taken_at must be a valid ISO date/time" });
      return;
    }

    const existing = await fetchDoseLogById(pool, logId);
    if (!existing) {
      res.status(404).json({ error: "Dose log not found" });
      return;
    }

    const [medRows] = await pool.query<MedicationRow[]>(
      `SELECT ${MEDICATION_COLUMNS} FROM medications WHERE id = ?`,
      [existing.medication_id]
    );
    if (medRows.length === 0) {
      res.status(404).json({ error: "Medication not found" });
      return;
    }

    const validation = await validateEditedDose(
      logId,
      existing.profile_id,
      existing.medication_id,
      medRows[0],
      takenAtParsed
    );
    if (!validation.ok) {
      res.status(409).json({
        error: validation.error,
        blocked_reason: validation.blocked_reason ?? null,
      });
      return;
    }

    await pool.query<ResultSetHeader>(
      "UPDATE dose_logs SET taken_at = ? WHERE id = ?",
      [takenAtParsed, logId]
    );

    const updated = await fetchDoseLogById(pool, logId);
    refreshMqttState();
    res.json(updated);
  } catch (err) {
    next(err);
  }
});

router.delete("/:id", async (req, res, next) => {
  try {
    const logId = Number(req.params.id);
    if (!Number.isFinite(logId)) {
      res.status(400).json({ error: "Invalid dose log id" });
      return;
    }

    const existing = await fetchDoseLogById(pool, logId);
    if (!existing) {
      res.status(404).json({ error: "Dose log not found" });
      return;
    }

    const [result] = await pool.query<ResultSetHeader>(
      "DELETE FROM dose_logs WHERE id = ?",
      [logId]
    );
    if (result.affectedRows === 0) {
      res.status(404).json({ error: "Dose log not found" });
      return;
    }

    refreshMqttState();
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

export default router;
