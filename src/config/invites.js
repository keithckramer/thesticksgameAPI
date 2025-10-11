import dotenv from "dotenv";

dotenv.config();

const parseNumber = (value, fallback) => {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const parseCsv = (value, fallback) => {
  if (!value || typeof value !== "string") {
    return fallback;
  }

  const roles = value
    .split(",")
    .map((role) => role.trim())
    .filter(Boolean);

  return roles.length > 0 ? Array.from(new Set(roles)) : fallback;
};

export const PUBLIC_BASE_URL =
  process.env.PUBLIC_BASE_URL ||
  process.env.APP_URL_CLIENT ||
  "http://localhost:3000";

export const INVITES_EXPIRY_DAYS = parseNumber(
  process.env.INVITES_EXPIRY_DAYS,
  14
);

export const INVITE_ALLOW_ROLES = parseCsv(
  process.env.INVITE_ALLOW_ROLES,
  ["admin"]
);

export const MAIL_FROM =
  process.env.MAIL_FROM ||
  "SSG <no-reply@ssg.local>";

export const SMTP_HOST = process.env.SMTP_HOST;
export const SMTP_PORT = parseNumber(process.env.SMTP_PORT, 587);
export const SMTP_USER = process.env.SMTP_USER;
export const SMTP_PASS = process.env.SMTP_PASS;

export const TWILIO_ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID;
export const TWILIO_AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN;
export const TWILIO_FROM_NUMBER = process.env.TWILIO_FROM_NUMBER;

export const INVITES_EXPIRY_MS = INVITES_EXPIRY_DAYS * 24 * 60 * 60 * 1000;

export const REGISTER_REDIRECT_URL = `${PUBLIC_BASE_URL.replace(/\/$/, "")}/register`;

export default {
  PUBLIC_BASE_URL,
  INVITES_EXPIRY_DAYS,
  INVITE_ALLOW_ROLES,
  MAIL_FROM,
  SMTP_HOST,
  SMTP_PORT,
  SMTP_USER,
  SMTP_PASS,
  TWILIO_ACCOUNT_SID,
  TWILIO_AUTH_TOKEN,
  TWILIO_FROM_NUMBER,
  INVITES_EXPIRY_MS,
  REGISTER_REDIRECT_URL,
};
