import { randomUUID } from 'crypto';
import type { Request, Response } from 'express';
import { Router } from 'express';
import { z } from 'zod';
import RefreshToken from '../models/RefreshToken';
import User, { type IUser } from '../models/User';
import { authLogger } from '../middleware/logging';
import {
  recordAuthLoginFail,
  recordAuthLoginSuccess,
  recordAuthRefreshFail,
  recordAuthRefreshSuccess,
  recordAuthSignupSuccess,
} from '../observability/metrics';
import { signAccessToken, signRefreshToken, verifyRefreshToken } from '../utils/jwt';
import { emailSchema, passwordSchema, phoneSchema, sanitizeString } from '../utils/validators';
import {
  isAccountLocked,
  loginRateLimiter,
  refreshRateLimiter,
  registerFailedLoginAttempt,
  registerRateLimiter,
  resetLoginFailures,
} from '../middleware/rateLimit';

const router = Router();

const REFRESH_TOKEN_COOKIE = 'refreshToken';
const REFRESH_TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

const registerInputSchema = z.object({
  name: z
    .string({ required_error: 'Name is required.' })
    .transform((value) => sanitizeString(value))
    .pipe(
      z
        .string()
        .min(1, 'Name is required.')
        .max(100, 'Name must be 100 characters or fewer.'),
    ),
  email: emailSchema,
  phone: phoneSchema.optional(),
  password: passwordSchema,
});

const loginInputSchema = z.object({
  email: emailSchema,
  password: z.string({ required_error: 'Password is required.' }).min(1, 'Password is required.'),
});

type LoginInput = z.infer<typeof loginInputSchema>;

const sanitizeEmail = (value: string): string => value.trim().toLowerCase();

const buildUserResponse = (user: IUser) => ({
  id: user._id.toString(),
  email: user.email,
  phone: user.phone ?? null,
});

const parseCookies = (cookieHeader: string | undefined): Record<string, string> => {
  if (!cookieHeader) {
    return {};
  }

  return cookieHeader.split(';').reduce<Record<string, string>>((acc, part) => {
    const [rawKey, ...rest] = part.trim().split('=');
    if (!rawKey) {
      return acc;
    }

    const key = decodeURIComponent(rawKey);
    const value = rest.length > 0 ? rest.join('=') : '';
    acc[key] = decodeURIComponent(value);
    return acc;
  }, {});
};

const getRefreshTokenFromRequest = (req: Request): string | undefined => {
  const cookies = parseCookies(req.headers.cookie);
  return cookies[REFRESH_TOKEN_COOKIE];
};

const isSecureCookie = (req: Request): boolean => {
  if (process.env.COOKIE_SECURE === 'false') {
    return false;
  }

  if (process.env.COOKIE_SECURE === 'true') {
    return true;
  }

  if (process.env.NODE_ENV !== 'production') {
    return false;
  }

  const hostname = req.hostname;
  if (!hostname) {
    return true;
  }

  return !(hostname === 'localhost' || hostname === '127.0.0.1');
};

const getRefreshCookieOptions = (req: Request) => ({
  httpOnly: true,
  secure: isSecureCookie(req),
  sameSite: 'strict' as const,
  path: '/auth',
  maxAge: REFRESH_TOKEN_TTL_MS,
});

const setRefreshCookie = (res: Response, req: Request, value: string, expiresAt?: Date): void => {
  const options = getRefreshCookieOptions(req);
  if (expiresAt) {
    res.cookie(REFRESH_TOKEN_COOKIE, value, { ...options, expires: expiresAt });
    return;
  }

  res.cookie(REFRESH_TOKEN_COOKIE, value, options);
};

const clearRefreshCookie = (res: Response, req: Request): void => {
  const options = getRefreshCookieOptions(req);
  res.clearCookie(REFRESH_TOKEN_COOKIE, options);
};

const mintTokens = async (user: IUser, req: Request, res: Response) => {
  const jti = randomUUID();
  const expiresAt = new Date(Date.now() + REFRESH_TOKEN_TTL_MS);
  const refreshToken = signRefreshToken({ sub: user._id.toString(), jti });
  await RefreshToken.create({ userId: user._id, jti, expiresAt });

  const accessToken = signAccessToken({ sub: user._id.toString(), email: user.email });
  setRefreshCookie(res, req, refreshToken, expiresAt);

  return { accessToken, refreshToken, jti, expiresAt };
};

const handleAuthResponse = async (user: IUser, req: Request, res: Response, status: number) => {
  const { accessToken } = await mintTokens(user, req, res);
  res.status(status).json({
    accessToken,
    user: buildUserResponse(user),
  });
};

type ValidationError = {
  field: string;
  code: string;
  message: string;
};

const formatZodErrors = (error: z.ZodError): ValidationError[] =>
  error.issues.map((issue) => ({
    field: issue.path.length > 0 ? issue.path.join('.') : 'root',
    code: issue.code,
    message: issue.message,
  }));

const isDuplicateKeyError = (
  error: unknown,
): error is { code: number; keyPattern?: Record<string, unknown> } =>
  Boolean(
    error &&
      typeof error === 'object' &&
      'code' in error &&
      (error as { code?: number }).code === 11000,
  );

const getDuplicateFieldName = (error: { keyPattern?: Record<string, unknown> }): string | undefined => {
  const keyPattern = error.keyPattern;
  if (!keyPattern || typeof keyPattern !== 'object') {
    return undefined;
  }

  const [field] = Object.keys(keyPattern);
  return field;
};

const duplicateFieldMessage: Record<string, string> = {
  email: 'Email is already registered.',
  phone: 'Phone number is already registered.',
};

const buildDuplicateFieldResponse = (field: string) => ({
  errors: [
    {
      field,
      code: 'duplicate',
      message: duplicateFieldMessage[field] ?? 'Value is already registered.',
    },
  ],
});

router.post('/register', registerRateLimiter, async (req, res) => {
  const log = req.log ?? authLogger;
  try {
    const input = registerInputSchema.parse(req.body);

    const { email, phone, password } = input;
    const existing = await User.findOne({ email });
    if (existing) {
      res.status(400).json(buildDuplicateFieldResponse('email'));
      return;
    }

    const user = await User.create({
      email,
      phone,
      password,
    });

    recordAuthSignupSuccess();
    log.info({ event: 'auth.signup.success', userId: user._id.toString() });
    const { accessToken } = await mintTokens(user, req, res);
    res.status(201).json({ accessToken });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ errors: formatZodErrors(error) });
      return;
    }

    if (isDuplicateKeyError(error)) {
      const field = getDuplicateFieldName(error) ?? 'email';
      res.status(400).json(buildDuplicateFieldResponse(field));
      return;
    }

    log.error({ event: 'auth.signup.error', err: error });
    res.status(500).json({ error: 'Unable to register user.' });
  }
});

router.post('/login', loginRateLimiter, async (req, res) => {
  const log = req.log ?? authLogger;
  try {
    const input = loginInputSchema.parse(req.body) as LoginInput;
    const identifier = input.email;

    if (isAccountLocked(identifier)) {
      recordAuthLoginFail();
      log.warn({ event: 'auth.login.failure', reason: 'account_locked' });
      res.status(429).json({ error: 'Too many login attempts. Please try again later.' });
      return;
    }

    const user = await User.findOne({ email: sanitizeEmail(input.email) });
    if (!user) {
      const lockedUntil = registerFailedLoginAttempt(identifier);
      if (lockedUntil) {
        recordAuthLoginFail();
        log.warn({ event: 'auth.login.failure', reason: 'account_locked' });
        res.status(429).json({ error: 'Too many login attempts. Please try again later.' });
        return;
      }

      recordAuthLoginFail();
      log.warn({ event: 'auth.login.failure', reason: 'user_not_found' });
      res.status(401).json({ error: 'Invalid credentials.' });
      return;
    }

    const passwordValid = await user.comparePassword(input.password);
    if (!passwordValid) {
      const lockedUntil = registerFailedLoginAttempt(identifier);
      if (lockedUntil) {
        recordAuthLoginFail();
        log.warn({ event: 'auth.login.failure', reason: 'account_locked' });
        res.status(429).json({ error: 'Too many login attempts. Please try again later.' });
        return;
      }

      recordAuthLoginFail();
      log.warn({ event: 'auth.login.failure', reason: 'invalid_credentials', userId: user._id.toString() });
      res.status(401).json({ error: 'Invalid credentials.' });
      return;
    }

    resetLoginFailures(identifier);
    recordAuthLoginSuccess();
    log.info({ event: 'auth.login.success', userId: user._id.toString() });
    await handleAuthResponse(user, req, res, 200);
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: error.errors[0]?.message ?? 'Invalid input.' });
      return;
    }

    log.error({ event: 'auth.login.error', err: error });
    res.status(500).json({ error: 'Unable to process login.' });
  }
});

router.post('/refresh', refreshRateLimiter, async (req, res) => {
  const log = req.log ?? authLogger;
  const token = getRefreshTokenFromRequest(req);
  if (!token) {
    recordAuthRefreshFail();
    log.warn({ event: 'auth.refresh.failure', reason: 'missing_token' });
    res.status(401).json({ error: 'Refresh token is missing.' });
    return;
  }

  try {
    const payload = verifyRefreshToken(token);
    const refreshDoc = await RefreshToken.findOne({ userId: payload.sub, jti: payload.jti });

    if (!refreshDoc || refreshDoc.isRevoked()) {
      recordAuthRefreshFail();
      log.warn({ event: 'auth.refresh.failure', reason: 'revoked' });
      res.status(401).json({ error: 'Refresh token is invalid or expired.' });
      return;
    }

    if (refreshDoc.expiresAt <= new Date()) {
      refreshDoc.revokedAt = new Date();
      await refreshDoc.save();
      recordAuthRefreshFail();
      log.warn({ event: 'auth.refresh.failure', reason: 'expired' });
      res.status(401).json({ error: 'Refresh token is invalid or expired.' });
      return;
    }

    const user = await User.findById(payload.sub);
    if (!user) {
      refreshDoc.revokedAt = new Date();
      await refreshDoc.save();
      recordAuthRefreshFail();
      log.warn({ event: 'auth.refresh.failure', reason: 'user_missing', userId: payload.sub });
      res.status(401).json({ error: 'Refresh token is invalid or expired.' });
      return;
    }

    refreshDoc.revokedAt = new Date();
    await refreshDoc.save();

    const { accessToken, jti } = await mintTokens(user, req, res);
    recordAuthRefreshSuccess();
    log.info({
      event: 'auth.refresh.success',
      userId: user._id.toString(),
      oldJti: payload.jti,
      newJti: jti,
    });

    res.status(200).json({ accessToken });
  } catch (error) {
    recordAuthRefreshFail();
    log.warn({ event: 'auth.refresh.failure', reason: 'verification_error', err: error });
    res.status(401).json({ error: 'Refresh token is invalid or expired.' });
  }
});

router.post('/logout', async (req, res) => {
  const log = req.log ?? authLogger;
  const token = getRefreshTokenFromRequest(req);
  if (token) {
    try {
      const payload = verifyRefreshToken(token);
      const refreshDoc = await RefreshToken.findOne({ userId: payload.sub, jti: payload.jti });
      if (refreshDoc && !refreshDoc.isRevoked()) {
        refreshDoc.revokedAt = new Date();
        await refreshDoc.save();
        log.info({ event: 'auth.logout.token_revoked', userId: payload.sub, jti: payload.jti });
      }
    } catch (error) {
      log.warn({ event: 'auth.logout.revocation_failed', err: error });
    }
  }

  clearRefreshCookie(res, req);
  res.status(200).json({ success: true });
});

export default router;
