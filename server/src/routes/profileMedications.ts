import { Router } from "express";
import pool, {
  type CountRow,
  type IdRow,
  type LastDoseRow,
  type MedicationRow,
} from "../db.js";
import { MEDICATION_COLUMNS, MEDICATION_COLUMNS_M } from "../medicationFields.js";
import { computeMedStatus, startOfLocalDay, endOfLocalDay } from "../medStatus.js";
import { refreshMqttState } from "../mqtt/poller.js";

const router = Router();

async function getMedStatusesForProfile(profileId: number) {
  const [medRows] = await pool.query<MedicationRow[]>(
    `SELECT ${MEDICATION_COLUMNS_M}
     FROM medications m
     INNER JOIN profile_medications pm ON pm.medication_id = m.id
     WHERE pm.profile_id = ?
     ORDER BY m.name`,
    [profileId]
  );

  const dayStart = startOfLocalDay();
  const dayEnd = endOfLocalDay();
  const now = new Date();

  const statuses = [];
  for (const med of medRows) {
    const [countRows] = await pool.query<CountRow[]>(
      `SELECT COUNT(*) AS cnt FROM dose_logs
       WHERE profile_id = ? AND medication_id = ? AND taken_at >= ? AND taken_at <= ?`,
      [profileId, med.id, dayStart, dayEnd]
    );
    const [lastRows] = await pool.query<LastDoseRow[]>(
      `SELECT taken_at FROM dose_logs
       WHERE profile_id = ? AND medication_id = ?
       ORDER BY taken_at DESC LIMIT 1`,
      [profileId, med.id]
    );
    statuses.push(
      computeMedStatus(
        med,
        countRows[0]?.cnt ?? 0,
        lastRows[0]?.taken_at ?? null,
        now
      )
    );
  }
  return statuses;
}

router.get("/:id/medications", async (req, res, next) => {
  try {
    const profileId = Number(req.params.id);
    const [profileRows] = await pool.query<IdRow[]>(
      "SELECT id FROM profiles WHERE id = ?",
      [profileId]
    );
    if (profileRows.length === 0) {
      res.status(404).json({ error: "Profile not found" });
      return;
    }
    const medications = await getMedStatusesForProfile(profileId);
    res.json(medications);
  } catch (err) {
    next(err);
  }
});

router.put("/:id/medications", async (req, res, next) => {
  const conn = await pool.getConnection();
  try {
    const profileId = Number(req.params.id);
    const medicationIds: number[] = Array.isArray(req.body.medication_ids)
      ? req.body.medication_ids.map(Number)
      : [];

    const [profileRows] = await conn.query<IdRow[]>(
      "SELECT id FROM profiles WHERE id = ?",
      [profileId]
    );
    if (profileRows.length === 0) {
      res.status(404).json({ error: "Profile not found" });
      return;
    }

    if (medicationIds.length > 0) {
      const placeholders = medicationIds.map(() => "?").join(",");
      const [validMeds] = await conn.query<IdRow[]>(
        `SELECT id FROM medications WHERE id IN (${placeholders})`,
        medicationIds
      );
      if (validMeds.length !== medicationIds.length) {
        res.status(400).json({ error: "One or more medication IDs are invalid" });
        return;
      }
    }

    await conn.beginTransaction();
    await conn.query("DELETE FROM profile_medications WHERE profile_id = ?", [
      profileId,
    ]);
    for (const medId of medicationIds) {
      await conn.query(
        "INSERT INTO profile_medications (profile_id, medication_id) VALUES (?, ?)",
        [profileId, medId]
      );
    }
    await conn.commit();

    const medications = await getMedStatusesForProfile(profileId);
    res.json(medications);
    refreshMqttState();
  } catch (err) {
    await conn.rollback();
    next(err);
  } finally {
    conn.release();
  }
});

export { getMedStatusesForProfile };
export default router;
