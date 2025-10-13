import nodemailer, { type Transporter } from 'nodemailer';

type SendMailOptions = {
  to: string;
  subject: string;
  text: string;
  html: string;
};

type PasswordResetEmailOptions = {
  to: string;
  token: string;
  expiresAt: Date;
};

let cachedTransporter: Transporter | null = null;

const isProduction = () => process.env.NODE_ENV === 'production';

const createTransporter = (): Transporter | null => {
  if (cachedTransporter) {
    return cachedTransporter;
  }

  if (!isProduction()) {
    const user = process.env.MAILTRAP_USER;
    const pass = process.env.MAILTRAP_PASSWORD ?? process.env.MAILTRAP_PASS;

    if (!user || !pass) {
      console.warn('Mailtrap credentials missing. Emails will not be delivered.');
      return null;
    }

    cachedTransporter = nodemailer.createTransport({
      host: process.env.MAILTRAP_HOST ?? 'sandbox.smtp.mailtrap.io',
      port: Number.parseInt(process.env.MAILTRAP_PORT ?? '587', 10),
      auth: { user, pass },
    });

    return cachedTransporter;
  }

  const smtpHost = process.env.SMTP_HOST;
  const smtpPort = process.env.SMTP_PORT;
  const smtpUser = process.env.SMTP_USER;
  const smtpPass = process.env.SMTP_PASSWORD ?? process.env.SMTP_PASS;

  if (!smtpHost || !smtpPort) {
    console.warn('SMTP configuration missing. Emails will not be delivered.');
    return null;
  }

  cachedTransporter = nodemailer.createTransport({
    host: smtpHost,
    port: Number.parseInt(smtpPort, 10),
    secure: Number.parseInt(smtpPort, 10) === 465,
    auth: smtpUser && smtpPass ? { user: smtpUser, pass: smtpPass } : undefined,
  });

  return cachedTransporter;
};

const sendMail = async ({ to, subject, text, html }: SendMailOptions): Promise<void> => {
  const transporter = createTransporter();
  if (!transporter) {
    console.info('Email send skipped due to missing transporter.', { subject });
    return;
  }

  const from = process.env.MAIL_FROM ?? 'no-reply@thesticksgame.local';

  await transporter.sendMail({
    from,
    to,
    subject,
    text,
    html,
  });
};

const buildResetUrl = (token: string): string => {
  const baseUrl = (process.env.APP_URL_CLIENT ?? 'http://localhost:3000').replace(/\/$/, '');
  return `${baseUrl}/auth/reset-password?token=${encodeURIComponent(token)}`;
};

export const sendPasswordResetEmail = async ({ to, token, expiresAt }: PasswordResetEmailOptions): Promise<void> => {
  const resetUrl = buildResetUrl(token);
  const expiration = expiresAt.toUTCString();

  const subject = 'Password reset requested';
  const text = `A password reset was requested for your account. Use the following link to reset your password: ${resetUrl}. This link expires on ${expiration}. If you did not request a password reset, you can safely ignore this email.`;
  const html = `
    <p>A password reset was requested for your account.</p>
    <p><a href="${resetUrl}">Click here to reset your password</a>. This link expires on <strong>${expiration}</strong>.</p>
    <p>If you did not request a password reset, you can safely ignore this email.</p>
  `;

  await sendMail({ to, subject, text, html });
};

export default sendPasswordResetEmail;

