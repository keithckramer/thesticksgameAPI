import { Router } from "express";
import mongoose from "mongoose";

const router = Router();

router.get("/", (_req, res) => {
  const mongoStates = ["disconnected", "connected", "connecting", "disconnecting"];
  const stateIdx = typeof mongoose.connection.readyState === "number" ? mongoose.connection.readyState : 0;

  res.json({
    ok: true,
    uptime: process.uptime(),
    mongo: mongoStates[stateIdx] || "unknown",
    env: process.env.NODE_ENV || "dev"
  });
});

export default router;
