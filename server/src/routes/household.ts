import { Router } from "express";
import pool, { type DoseLogRow, type ProfileRow } from "../db.js";
import { startOfLocalDay, endOfLocalDay } from "../medStatus.js";
import { getMedStatusesForProfile } from "./profileMedications.js";

const router = Router();

router.get("/overview", async (_req, res, next) => {
  try {
    const [profiles] = await pool.query<ProfileRow[]>(
      "SELECT id, name, created_at FROM profiles ORDER BY name"
    );

    const dayStart = startOfLocalDay();
    const dayEnd = endOfLocalDay();

    const overview = [];
    for (const profile of profiles) {
      const medications = await getMedStatusesForProfile(profile.id);
      const [logs] = await pool.query<DoseLogRow[]>(
        `SELECT dl.id, dl.profile_id, dl.medication_id, dl.taken_at, dl.logged_by_profile_id,
                m.name AS medication_name,
                lb.name AS logged_by_name
         FROM dose_logs dl
         INNER JOIN medications m ON m.id = dl.medication_id
         LEFT JOIN profiles lb ON lb.id = dl.logged_by_profile_id
         WHERE dl.profile_id = ? AND dl.taken_at >= ? AND dl.taken_at <= ?
         ORDER BY dl.taken_at DESC`,
        [profile.id, dayStart, dayEnd]
      );
      overview.push({
        profile,
        medications,
        logs_today: logs,
      });
    }

    res.json(overview);
  } catch (err) {
    next(err);
  }
});

export default router;
