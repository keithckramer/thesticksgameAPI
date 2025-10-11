import { INVITE_ALLOW_ROLES } from "../config/invites.js";

export const requireRole = (allowedRoles = INVITE_ALLOW_ROLES) => {
  const normalizedRoles =
    allowedRoles && allowedRoles.length > 0 ? allowedRoles : INVITE_ALLOW_ROLES;

  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const { role } = req.user;
    if (!role || !normalizedRoles.includes(role)) {
      return res.status(403).json({ message: "Forbidden" });
    }

    return next();
  };
};

export default requireRole;
