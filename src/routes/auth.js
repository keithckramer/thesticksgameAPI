import { Router } from "express";
import bcrypt from "bcryptjs";
import { z } from "zod";
import User from "../schemas/user.schema.js";
import Invite from "../schemas/invite.schema.js";
import { verifyPassword, signToken } from "../utils/auth.js";
import { genToken } from "../utils/tokens.js";
import { requireAdminKey } from "../middleware/requireAdminKey.js";

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

const RegisterSchema = z.object({
  name: z.string().trim().min(1, "Name is required"),
  email: z
    .string()
    .trim()
    .email("Enter a valid email")
    .transform((value) => value.toLowerCase()),
  password: z
    .string()
    .min(12, "Password must be at least 12 characters"),
  phone: z
    .string()
    .optional()
    .transform((value) => {
      if (typeof value !== "string") return undefined;
      const trimmed = value.trim();
      return trimmed.length ? trimmed : undefined;
    }),
});

const toZodIssue = (issue) => {
  const field = (issue.path && issue.path[0]) || "form";
  let code = "invalid";
  if (field === "email" && issue.code === "invalid_string") code = "invalid_email";
  else if (field === "password" && issue.code === "too_small") code = "weak_password";
  else if (issue.code === "too_small") code = "required";
  return { field, code, message: issue.message };
};

// POST /auth/register  { name, email, password, phone? }
r.post("/auth/register", async (req, res) => {
  const parsed = RegisterSchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    return res.status(400).json({ errors: parsed.error.issues.map(toZodIssue) });
  }

  const { name, email, password, phone } = parsed.data;

  const existing = await User.findOne({ email });
  if (existing) {
    return res.status(409).json({ error: "email_exists" });
  }

  if (phone) {
    const phoneOwner = await User.findOne({ phone });
    if (phoneOwner) {
      return res.status(409).json({ error: "phone_exists" });
    }
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const user = await User.create({ name, email, phone, passwordHash });

  const inviteQuery = [];
  if (email) inviteQuery.push({ emailOrPhone: email });
  if (phone) inviteQuery.push({ emailOrPhone: phone });
  if (inviteQuery.length) {
    const invite = await Invite.findOne({
      status: "pending",
      $or: inviteQuery,
    });
    if (invite) {
      invite.status = "accepted";
      await invite.save();
    }
  }

  const jwt = signToken(user);
  return res.status(201).json({
    accessToken: jwt,
    ok: true,
    token: jwt,
    user: {
      id: user._id,
      email: user.email,
      phone: user.phone,
      name: user.name,
    },
  });
});

r.all("/auth/register", (_req, res) => res.status(405).send("Method Not Allowed"));

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
