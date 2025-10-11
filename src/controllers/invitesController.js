import mongoose from "mongoose";
import InviteModel from "../models/Invite.js";
import {
  INVITE_ALLOW_ROLES,
  REGISTER_REDIRECT_URL,
} from "../config/invites.js";
import { generateInviteCode } from "../lib/id.js";
import { sendEmailInvite, sendSmsInvite } from "../services/notify/index.js";

let Invite = InviteModel;

export const setInviteModel = (model) => {
  Invite = model || InviteModel;
};

const maskEmail = (email = "") => {
  if (!email) {
    return null;
  }

  const [local, domain] = email.split("@");
  if (!domain) {
    return email;
  }

  const visible = local.slice(0, Math.min(2, local.length));
  const maskedLength = Math.max(local.length - visible.length, 1);
  return `${visible}${"*".repeat(maskedLength)}@${domain}`;
};

const maskPhone = (phone = "") => {
  if (!phone) {
    return null;
  }

  const clean = phone.replace(/\D+/g, "");
  if (clean.length <= 2) {
    return "*".repeat(clean.length);
  }

  const visible = clean.slice(-2);
  return `${"*".repeat(clean.length - visible.length)}${visible}`;
};

const ensureInviteNotExpired = async (invite) => {
  if (!invite) {
    return { invite: null, expired: false };
  }

  if (invite.isExpired()) {
    if (invite.status !== "expired") {
      invite.status = "expired";
      await invite.save();
    }
    return { invite, expired: true };
  }

  return { invite, expired: false };
};

const generateUniqueCode = async () => {
  const maxAttempts = 5;
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const code = generateInviteCode();
    const exists = await Invite.exists({ code });
    if (!exists) {
      return code;
    }
  }

  throw new Error("Unable to generate a unique invite code");
};

const resolveChannel = ({ email, phone }) => {
  if (email) {
    return "email";
  }

  if (phone) {
    return "sms";
  }

  return "link";
};

const sanitizeRole = (role) => {
  if (!role) {
    return "user";
  }

  return role.trim();
};

const buildSearchFilter = ({ status, q }) => {
  const filter = {};

  if (status) {
    filter.status = status;
  }

  if (q) {
    const regex = new RegExp(q, "i");
    filter.$or = [
      { email: regex },
      { phone: regex },
      { code: regex },
    ];
  }

  return filter;
};

export const createInvite = async (req, res) => {
  const { email, phone, role, metadata } = req.body || {};

  if (!email && !phone) {
    return res.status(400).json({ message: "Email or phone is required" });
  }

  const channel = resolveChannel({ email, phone });

  try {
    const code = await generateUniqueCode();
    const invite = new Invite({
      code,
      channel,
      email,
      phone,
      invitedBy: req.user._id || req.user.id,
      role: sanitizeRole(role),
      metadata,
    });

    if (channel === "email" || channel === "sms") {
      invite.sentAt = new Date();
    }

    await invite.save();

    const link = invite.inviteUrl;

    if (channel === "email") {
      await sendEmailInvite({ to: invite.email, link });
    } else if (channel === "sms") {
      await sendSmsInvite({ to: invite.phone, link });
    }

    return res.status(201).json(invite.toJSON());
  } catch (error) {
    console.error("Failed to create invite:", error);
    return res.status(500).json({ message: "Failed to create invite" });
  }
};

export const listInvites = async (req, res) => {
  const { status, q } = req.query || {};
  const page = Math.max(Number.parseInt(req.query?.page, 10) || 1, 1);
  const limit = Math.min(Math.max(Number.parseInt(req.query?.limit, 10) || 20, 1), 100);

  const filter = buildSearchFilter({ status, q });

  try {
    const [total, invites] = await Promise.all([
      Invite.countDocuments(filter),
      Invite.find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .exec(),
    ]);

    return res.json({
      data: invites.map((invite) => invite.toJSON()),
      meta: {
        total,
        page,
        limit,
      },
    });
  } catch (error) {
    console.error("Failed to list invites:", error);
    return res.status(500).json({ message: "Failed to list invites" });
  }
};

export const getInvite = async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(404).json({ message: "Invite not found" });
    }

    const invite = await Invite.findById(req.params.id)
      .exec();

    if (!invite) {
      return res.status(404).json({ message: "Invite not found" });
    }

    return res.json(invite.toJSON());
  } catch (error) {
    console.error("Failed to fetch invite:", error);
    return res.status(500).json({ message: "Failed to fetch invite" });
  }
};

export const updateInvite = async (req, res) => {
  const { status } = req.body || {};

  if (!status) {
    return res.status(400).json({ message: "Status is required" });
  }

  if (status !== "revoked") {
    return res.status(400).json({ message: "Only revoking invites is supported" });
  }

  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(404).json({ message: "Invite not found" });
    }

    const invite = await Invite.findById(req.params.id).exec();

    if (!invite) {
      return res.status(404).json({ message: "Invite not found" });
    }

    invite.status = "revoked";
    await invite.save();

    return res.json(invite.toJSON());
  } catch (error) {
    console.error("Failed to update invite:", error);
    return res.status(500).json({ message: "Failed to update invite" });
  }
};

export const resendInvite = async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(404).json({ message: "Invite not found" });
    }

    const invite = await Invite.findById(req.params.id).exec();

    if (!invite) {
      return res.status(404).json({ message: "Invite not found" });
    }

    const { expired } = await ensureInviteNotExpired(invite);
    if (expired) {
      return res.status(410).json({ message: "Invite has expired" });
    }

    if (invite.status === "revoked") {
      return res.status(403).json({ message: "Invite has been revoked" });
    }

    if (invite.channel === "email") {
      await sendEmailInvite({ to: invite.email, link: invite.inviteUrl });
    } else if (invite.channel === "sms") {
      await sendSmsInvite({ to: invite.phone, link: invite.inviteUrl });
    }

    invite.sentAt = new Date();
    await invite.save();

    return res.json(invite.toJSON());
  } catch (error) {
    console.error("Failed to resend invite:", error);
    return res.status(500).json({ message: "Failed to resend invite" });
  }
};

export const trackInvite = async (req, res) => {
  try {
    const invite = await Invite.findOne({ code: req.params.code }).exec();

    if (!invite) {
      return res.status(404).json({ message: "Invite not found" });
    }

    const { expired } = await ensureInviteNotExpired(invite);
    if (expired) {
      return res.status(410).json({ message: "Invite has expired" });
    }

    if (invite.status === "revoked") {
      return res.status(403).json({ message: "Invite has been revoked" });
    }

    if (!invite.clickedAt) {
      invite.clickedAt = new Date();
    }

    if (invite.status === "pending") {
      invite.status = "clicked";
    }

    await invite.save();

    const redirectUrl = `${REGISTER_REDIRECT_URL}?invite=${encodeURIComponent(
      invite.code
    )}`;

    return res.redirect(302, redirectUrl);
  } catch (error) {
    console.error("Failed to track invite:", error);
    return res.status(500).json({ message: "Failed to track invite" });
  }
};

export const acceptInvite = async (req, res) => {
  const { code } = req.body || {};

  if (!code) {
    return res.status(400).json({ message: "Invite code is required" });
  }

  try {
    const invite = await Invite.findOne({ code }).exec();

    if (!invite) {
      return res.status(404).json({ message: "Invite not found" });
    }

    const { expired } = await ensureInviteNotExpired(invite);
    if (expired) {
      return res.status(410).json({ message: "Invite has expired" });
    }

    if (invite.status === "revoked") {
      return res.status(403).json({ message: "Invite has been revoked" });
    }

    if (invite.status === "registered") {
      return res.status(409).json({ message: "Invite has already been used" });
    }

    invite.acceptedAt = invite.acceptedAt || new Date();
    invite.status = "accepted";
    await invite.save();

    return res.json({
      code: invite.code,
      channel: invite.channel,
      email: maskEmail(invite.email),
      phone: maskPhone(invite.phone),
      role: invite.role,
      inviteUrl: invite.inviteUrl,
      expiresAt: invite.expiresAt,
      allowRoles: INVITE_ALLOW_ROLES,
    });
  } catch (error) {
    console.error("Failed to accept invite:", error);
    return res.status(500).json({ message: "Failed to accept invite" });
  }
};

export default {
  createInvite,
  listInvites,
  getInvite,
  updateInvite,
  resendInvite,
  trackInvite,
  acceptInvite,
  setInviteModel,
};
