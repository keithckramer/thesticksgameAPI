import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

export const hashPassword = async (plain) => bcrypt.hash(plain, 10);
export const verifyPassword = async (plain, hash) => bcrypt.compare(plain, hash);

export const signToken = (user) => {
  const payload = { sub: user._id.toString(), roles: user.roles || [] };
  return jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: "7d" });
};
