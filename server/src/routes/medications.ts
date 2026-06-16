import { Router } from "express";
import pool, { type MedicationRow, type ResultSetHeader } from "../db.js";
import {
  MEDICATION_COLUMNS,
  MEDICATION_COLUMNS_M,
  parseOptionalIntervalMinutes,
  parseWaitingMessage,
} from "../medicationFields.js";

const router = Router();

router.get("/", async (req, res, next) => {
  try {
    const profileId = req.query.profile_id ? Number(req.query.profile_id) : null;

    if (profileId) {
      const [rows] = await pool.query<MedicationRow[]>(
        `SELECT ${MEDICATION_COLUMNS_M}
         FROM medications m
         INNER JOIN profile_medications pm ON pm.medication_id = m.id
         WHERE pm.profile_id = ?
         ORDER BY m.name`,
        [profileId]
      );
      res.json(rows);
      return;
    }

    const [rows] = await pool.query<MedicationRow[]>(
      `SELECT ${MEDICATION_COLUMNS} FROM medications ORDER BY name`
    );
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

router.post("/", async (req, res, next) => {
  try {
    const name = String(req.body.name ?? "").trim();
    const interval = parseOptionalIntervalMinutes(req.body.interval_minutes);
    const maxPerDay =
      req.body.max_per_day === null ||
      req.body.max_per_day === undefined ||
      req.body.max_per_day === ""
        ? null
        : Number(req.body.max_per_day);
    const waitingMessage = parseWaitingMessage(req.body.waiting_message);

    if (!name) {
      res.status(400).json({ error: "name is required" });
      return;
    }
    if (!interval.ok) {
      res.status(400).json({ error: interval.error });
      return;
    }
    if (maxPerDay !== null && (!Number.isFinite(maxPerDay) || maxPerDay <= 0)) {
      res.status(400).json({ error: "max_per_day must be a positive number when set" });
      return;
    }

    const [result] = await pool.query<ResultSetHeader>(
      `INSERT INTO medications (name, interval_minutes, max_per_day, waiting_message)
       VALUES (?, ?, ?, ?)`,
      [name, interval.value, maxPerDay, waitingMessage]
    );
    const [rows] = await pool.query<MedicationRow[]>(
      `SELECT ${MEDICATION_COLUMNS} FROM medications WHERE id = ?`,
      [result.insertId]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    next(err);
  }
});

router.put("/:id", async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const name = String(req.body.name ?? "").trim();
    const interval = parseOptionalIntervalMinutes(req.body.interval_minutes);
    const maxPerDay =
      req.body.max_per_day === null ||
      req.body.max_per_day === undefined ||
      req.body.max_per_day === ""
        ? null
        : Number(req.body.max_per_day);
    const waitingMessage = parseWaitingMessage(req.body.waiting_message);

    if (!name) {
      res.status(400).json({ error: "name is required" });
      return;
    }
    if (!interval.ok) {
      res.status(400).json({ error: interval.error });
      return;
    }
    if (maxPerDay !== null && (!Number.isFinite(maxPerDay) || maxPerDay <= 0)) {
      res.status(400).json({ error: "max_per_day must be a positive number when set" });
      return;
    }

    const [result] = await pool.query<ResultSetHeader>(
      `UPDATE medications SET name = ?, interval_minutes = ?, max_per_day = ?, waiting_message = ? WHERE id = ?`,
      [name, interval.value, maxPerDay, waitingMessage, id]
    );
    if (result.affectedRows === 0) {
      res.status(404).json({ error: "Medication not found" });
      return;
    }
    const [rows] = await pool.query<MedicationRow[]>(
      `SELECT ${MEDICATION_COLUMNS} FROM medications WHERE id = ?`,
      [id]
    );
    res.json(rows[0]);
  } catch (err) {
    next(err);
  }
});

router.delete("/:id", async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const [result] = await pool.query<ResultSetHeader>(
      "DELETE FROM medications WHERE id = ?",
      [id]
    );
    if (result.affectedRows === 0) {
      res.status(404).json({ error: "Medication not found" });
      return;
    }
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

export default router;
