import { Router } from "express";
const r = Router();

r.get("/ping", (req, res) => {
  const envKey = (process.env.ADMIN_KEY || "").trim();
  const headerKey = (req.headers["x-admin-key"] || "").toString().trim();
  // Do NOT return the actual keys; only booleans/lengths
  return res.json({
    ok: true,
    hasEnv: Boolean(envKey),
    envLen: envKey.length,
    recvLen: headerKey.length,
    match: Boolean(envKey && headerKey && envKey === headerKey)
  });
});

export default r;
