import { Router } from "express";
import pool, {
  type IdRow,
  type MedicationRow,
  type ProfileMedicationRow,
} from "../db.js";
import {
  parseNotifyMinutesBefore,
  parseNotifyWhenDue,
} from "../notificationFields.js";
import {
  getMedStatusesForProfile,
  getProfileMedicationsForProfile,
} from "../profileMedicationQueries.js";
import { refreshMqttState } from "../mqtt/poller.js";

const router = Router();

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
    const medications = await getProfileMedicationsForProfile(profileId);
    res.json(medications);
  } catch (err) {
    next(err);
  }
});

router.put("/:id/medications", async (req, res, next) => {
  const conn = await pool.getConnection();
  try {
    const profileId = Number(req.params.id);
    const rawIds: unknown[] = Array.isArray(req.body.medication_ids)
      ? req.body.medication_ids
      : [];
    const medicationIds = [
      ...new Set(
        rawIds
          .map((id) => Number(id))
          .filter((id): id is number => Number.isFinite(id))
      ),
    ];

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

    const [currentRows] = await conn.query<ProfileMedicationRow[]>(
      "SELECT profile_id, medication_id FROM profile_medications WHERE profile_id = ?",
      [profileId]
    );
    const currentIds = new Set(currentRows.map((r) => r.medication_id));
    const newIds = new Set(medicationIds);

    const toRemove = [...currentIds].filter((id) => !newIds.has(id));
    const toAdd = [...newIds].filter((id) => !currentIds.has(id));

    await conn.beginTransaction();

    if (toRemove.length > 0) {
      const placeholders = toRemove.map(() => "?").join(",");
      await conn.query(
        `DELETE FROM profile_medications
         WHERE profile_id = ? AND medication_id IN (${placeholders})`,
        [profileId, ...toRemove]
      );
    }

    for (const medId of toAdd) {
      await conn.query(
        `INSERT INTO profile_medications
           (profile_id, medication_id, notify_when_due, notify_minutes_before)
         VALUES (?, ?, 0, NULL)`,
        [profileId, medId]
      );
    }

    await conn.commit();

    const medications = await getProfileMedicationsForProfile(profileId);
    res.json(medications);
    refreshMqttState();
  } catch (err) {
    await conn.rollback();
    next(err);
  } finally {
    conn.release();
  }
});

router.put("/:id/medication-notifications", async (req, res, next) => {
  const conn = await pool.getConnection();
  try {
    const profileId = Number(req.params.id);
    const settings = Array.isArray(req.body.settings) ? req.body.settings : [];

    const [profileRows] = await conn.query<IdRow[]>(
      "SELECT id FROM profiles WHERE id = ?",
      [profileId]
    );
    if (profileRows.length === 0) {
      res.status(404).json({ error: "Profile not found" });
      return;
    }

    type ParsedSetting = {
      medication_id: number;
      notify_when_due: boolean;
      notify_minutes_before: number | null;
    };
    const parsed: ParsedSetting[] = [];

    for (const item of settings) {
      const medicationId = Number(item.medication_id);
      if (!Number.isFinite(medicationId)) {
        res.status(400).json({ error: "Each setting requires a valid medication_id" });
        return;
      }

      const notifyWhenDue = parseNotifyWhenDue(item.notify_when_due);
      const minutes = parseNotifyMinutesBefore(item.notify_minutes_before);
      if (!minutes.ok) {
        res.status(400).json({ error: minutes.error });
        return;
      }

      parsed.push({
        medication_id: medicationId,
        notify_when_due: notifyWhenDue,
        notify_minutes_before: minutes.value,
      });
    }

    if (parsed.length > 0) {
      const medIds = parsed.map((s) => s.medication_id);
      const placeholders = medIds.map(() => "?").join(",");
      const [assigned] = await conn.query<ProfileMedicationRow[]>(
        `SELECT medication_id FROM profile_medications
         WHERE profile_id = ? AND medication_id IN (${placeholders})`,
        [profileId, ...medIds]
      );
      if (assigned.length !== medIds.length) {
        res.status(400).json({
          error: "Settings may only be updated for medications assigned to this profile",
        });
        return;
      }

      const [medRows] = await conn.query<MedicationRow[]>(
        `SELECT id, interval_minutes FROM medications WHERE id IN (${placeholders})`,
        medIds
      );
      const intervalByMed = new Map(medRows.map((m) => [m.id, m.interval_minutes]));

      for (const setting of parsed) {
        if (
          setting.notify_minutes_before != null &&
          intervalByMed.get(setting.medication_id) == null
        ) {
          res.status(400).json({
            error: `Early reminder requires an interval on medication id ${setting.medication_id}`,
          });
          return;
        }
      }
    }

    await conn.beginTransaction();
    for (const setting of parsed) {
      await conn.query(
        `UPDATE profile_medications
         SET notify_when_due = ?, notify_minutes_before = ?
         WHERE profile_id = ? AND medication_id = ?`,
        [
          setting.notify_when_due ? 1 : 0,
          setting.notify_minutes_before,
          profileId,
          setting.medication_id,
        ]
      );
    }
    await conn.commit();

    const medications = await getProfileMedicationsForProfile(profileId);
    res.json(medications);
    refreshMqttState();
  } catch (err) {
    await conn.rollback();
    next(err);
  } finally {
    conn.release();
  }
});

export { getMedStatusesForProfile, getProfileMedicationsForProfile };
export default router;
