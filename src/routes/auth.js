import { Router } from "express";
import User from "../schemas/user.schema.js";
import Invite from "../schemas/invite.schema.js";
import { hashPassword, verifyPassword, signToken } from "../utils/auth.js";
import { genToken } from "../utils/tokens.js";
import { requireAdminKey } from "../middleware/requireAdmin.js";

const r = Router();

// POST /invites  { emailOrPhone }  (protected by ADMIN KEY header)
r.post("/invites", requireAdminKey, async (req, res) => {
  const { emailOrPhone } = req.body || {};
  const value = typeof emailOrPhone === "string" ? emailOrPhone.trim() : "";
  if (!value) return res.status(400).json({ error: "emailOrPhone required" });
  const normalized = value.includes("@") ? value.toLowerCase() : value;
  const token = genToken(24);
  const inv = await Invite.create({ emailOrPhone: normalized, token });
  return res.json({ ok: true, inviteId: inv._id, token });
});

// POST /auth/accept-invite  { token }
r.post("/auth/accept-invite", async (req, res) => {
  const { token } = req.body || {};
  const inv = await Invite.findOne({ token, status: "pending" });
  if (!inv) return res.status(400).json({ error: "invalid or used invite" });
  return res.json({ ok: true, invite: { emailOrPhone: inv.emailOrPhone, token } });
});

// POST /auth/register  { emailOrPhone, password, name?, token? }
r.post("/auth/register", async (req, res) => {
  const { emailOrPhone, password, name, token } = req.body || {};
  const rawContact = typeof emailOrPhone === "string" ? emailOrPhone.trim() : "";
  if (!rawContact || !password) return res.status(400).json({ error: "missing fields" });
  const normalizedContact = rawContact.includes("@") ? rawContact.toLowerCase() : rawContact;

  // require a pending invite for MVP
  const inv = await Invite.findOne({ emailOrPhone: normalizedContact, status: "pending" });
  if (!inv) return res.status(400).json({ error: "no pending invite" });
  if (token && token !== inv.token) return res.status(400).json({ error: "token mismatch" });

  const passwordHash = await hashPassword(password);
  const doc = { passwordHash, name };
  if (normalizedContact.includes("@")) doc.email = normalizedContact;
  else doc.phone = normalizedContact;

  const or = [];
  if (doc.email) or.push({ email: doc.email });
  if (doc.phone) or.push({ phone: doc.phone });
  const existing = await User.findOne(or.length ? { $or: or } : {});
  if (existing) return res.status(409).json({ error: "user exists" });

  const user = await User.create(doc);
  inv.status = "accepted"; await inv.save();

  const jwt = signToken(user);
  return res.json({ ok: true, token: jwt, user: { id: user._id, email: user.email, phone: user.phone, name: user.name } });
});

// POST /auth/login  { emailOrPhone, password }
r.post("/auth/login", async (req, res) => {
  const { emailOrPhone, password } = req.body || {};
  const contact = typeof emailOrPhone === "string" ? emailOrPhone.trim() : "";
  if (!contact || !password) return res.status(400).json({ error: "missing fields" });

  const query = contact.includes("@")
    ? { email: contact.toLowerCase() }
    : { phone: contact };
  const user = await User.findOne(query);
  if (!user) return res.status(401).json({ error: "invalid credentials" });

  const ok = await verifyPassword(password, user.passwordHash);
  if (!ok) return res.status(401).json({ error: "invalid credentials" });

  user.lastLoginAt = new Date(); await user.save();
  const jwt = signToken(user);
  return res.json({ ok: true, token: jwt, user: { id: user._id, email: user.email, phone: user.phone, name: user.name } });
});

export default r;
