import jwt from "jsonwebtoken";

export const requireAuth = (req, res, next) => {
  const h = req.headers.authorization || "";
  const m = h.match(/^Bearer\s+(.+)$/i);
  if (!m) return res.status(401).json({ error: "missing token" });
  try {
    const payload = jwt.verify(m[1], process.env.JWT_SECRET);
    req.user = { id: payload.sub, roles: payload.roles || [] };
    next();
  } catch {
    return res.status(401).json({ error: "invalid token" });
  }
};
