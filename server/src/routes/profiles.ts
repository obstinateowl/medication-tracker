import { Router } from "express";
import pool, { type ProfileRow, type ResultSetHeader } from "../db.js";

const router = Router();

router.get("/", async (_req, res, next) => {
  try {
    const [rows] = await pool.query<ProfileRow[]>(
      "SELECT id, name, created_at FROM profiles ORDER BY name"
    );
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

router.post("/", async (req, res, next) => {
  try {
    const name = String(req.body.name ?? "").trim();
    if (!name) {
      res.status(400).json({ error: "name is required" });
      return;
    }
    const [result] = await pool.query<ResultSetHeader>(
      "INSERT INTO profiles (name) VALUES (?)",
      [name]
    );
    const [rows] = await pool.query<ProfileRow[]>(
      "SELECT id, name, created_at FROM profiles WHERE id = ?",
      [result.insertId]
    );
    res.status(201).json(rows[0]);
  } catch (err: unknown) {
    if ((err as { code?: string }).code === "ER_DUP_ENTRY") {
      res.status(409).json({ error: "A profile with that name already exists" });
      return;
    }
    next(err);
  }
});

router.put("/:id", async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const name = String(req.body.name ?? "").trim();
    if (!name) {
      res.status(400).json({ error: "name is required" });
      return;
    }
    const [result] = await pool.query<ResultSetHeader>(
      "UPDATE profiles SET name = ? WHERE id = ?",
      [name, id]
    );
    if (result.affectedRows === 0) {
      res.status(404).json({ error: "Profile not found" });
      return;
    }
    const [rows] = await pool.query<ProfileRow[]>(
      "SELECT id, name, created_at FROM profiles WHERE id = ?",
      [id]
    );
    res.json(rows[0]);
  } catch (err: unknown) {
    if ((err as { code?: string }).code === "ER_DUP_ENTRY") {
      res.status(409).json({ error: "A profile with that name already exists" });
      return;
    }
    next(err);
  }
});

export default router;
