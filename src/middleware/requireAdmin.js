export const requireAdminKey = (req, res, next) => {
  const adminKey = process.env.ADMIN_KEY || "";
  if (!adminKey || req.headers["x-admin-key"] !== adminKey) {
    return res.status(403).json({ error: "forbidden" });
  }
  next();
};
