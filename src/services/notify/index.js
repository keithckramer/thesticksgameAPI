import nodemailer from "nodemailer";
import {
  MAIL_FROM,
  SMTP_HOST,
  SMTP_PORT,
  SMTP_USER,
  SMTP_PASS,
  TWILIO_ACCOUNT_SID,
  TWILIO_AUTH_TOKEN,
  TWILIO_FROM_NUMBER,
} from "../../config/invites.js";

let emailTransport;

const createEmailTransport = () => {
  if (emailTransport) {
    return emailTransport;
  }

  if (SMTP_HOST) {
    emailTransport = nodemailer.createTransport({
      host: SMTP_HOST,
      port: SMTP_PORT,
      secure: SMTP_PORT === 465,
      auth: SMTP_USER
        ? {
            user: SMTP_USER,
            pass: SMTP_PASS,
          }
        : undefined,
    });
  } else {
    console.warn(
      "SMTP not configured. Using Nodemailer stream transport for invite emails."
    );
    emailTransport = nodemailer.createTransport({
      streamTransport: true,
      newline: "unix",
      buffer: true,
    });
  }

  return emailTransport;
};

export const sendEmailInvite = async ({ to, link }) => {
  if (!to) {
    return;
  }

  const transport = createEmailTransport();

  try {
    await transport.sendMail({
      from: MAIL_FROM,
      to,
      subject: "You're invited!",
      text: `You've been invited to join. Click here: ${link}`,
      html: `<p>You've been invited to join.</p><p><a href="${link}">Accept your invite</a></p>`,
    });
  } catch (error) {
    console.warn("Failed to send invite email:", error.message);
  }
};

let twilioClientPromise;

const getTwilioClient = async () => {
  if (twilioClientPromise) {
    return twilioClientPromise;
  }

  if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN) {
    console.warn(
      "Twilio credentials not configured. SMS invites will not be sent."
    );
    twilioClientPromise = Promise.resolve(null);
    return twilioClientPromise;
  }

  twilioClientPromise = import("twilio")
    .then(({ default: twilio }) => twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN))
    .catch((error) => {
      console.warn(
        "Twilio SDK not available. SMS invites cannot be sent:",
        error.message
      );
      return null;
    });

  return twilioClientPromise;
};

export const sendSmsInvite = async ({ to, link }) => {
  if (!to) {
    return;
  }

  const client = await getTwilioClient();

  if (!client) {
    return;
  }

  if (!TWILIO_FROM_NUMBER) {
    console.warn("Twilio sender number not configured. SMS invite skipped.");
    return;
  }

  try {
    await client.messages.create({
      from: TWILIO_FROM_NUMBER,
      to,
      body: `You're invited! Join here: ${link}`,
    });
  } catch (error) {
    console.warn("Failed to send SMS invite:", error.message);
  }
};

export default {
  sendEmailInvite,
  sendSmsInvite,
};
