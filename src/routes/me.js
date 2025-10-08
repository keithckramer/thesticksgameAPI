import { Router } from "express";
import { requireAuth } from "../middleware/requireAuth.js";
import User from "../schemas/user.schema.js";

const r = Router();
r.get("/", requireAuth, async (req, res) => {
  const user = await User.findById(req.user.id).select("_id email phone name roles createdAt");
  if (!user) return res.status(404).json({ error: "not found" });
  res.json({ ok: true, user });
});
export default r;
