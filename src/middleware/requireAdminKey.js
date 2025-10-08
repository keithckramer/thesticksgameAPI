export const requireAdminKey = (req, res, next) => {
  const envKey = (process.env.ADMIN_KEY || "").trim();
  const headerKey = (req.headers["x-admin-key"] || "").toString().trim();

  // Helpful diagnostics in logs (no secrets printed)
  console.log("[admin-key] hasEnv=%s envLen=%d recvLen=%d match=%s",
    Boolean(envKey), envKey.length, headerKey.length, envKey && headerKey && envKey === headerKey);

  if (!envKey) {
    return res.status(500).json({ error: "ADMIN_KEY not set on server" });
  }
  if (headerKey !== envKey) {
    return res.status(403).json({ error: "forbidden (admin key mismatch)" });
  }
  return next();
};
