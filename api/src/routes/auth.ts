import { createHash, randomUUID } from 'crypto';
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
import {
  emitLoginAttempt,
  emitLoginFailure,
  emitLoginSuccess,
} from '../observability/analytics';
import { signAccessToken, signRefreshToken, verifyRefreshToken } from '../utils/jwt';
import { features } from '../config/features';
import { DEFAULT_ROLE } from '../types/roles';
import { emailSchema, registerSchema } from '../utils/validators';
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

const loginInputSchema = z
  .object({
    email: emailSchema,
    password: z.string({ required_error: 'Password is required.' }).min(1, 'Password is required.'),
  })
  .strict();

type LoginInput = z.infer<typeof loginInputSchema>;

const sanitizeEmail = (value: string): string => value.trim().toLowerCase();

const buildUserResponse = (user: IUser) => ({
  id: user._id.toString(),
  email: user.email,
  phone: user.phone ?? null,
  role: user.role,
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

const getRefreshCookieOptions = () => ({
  httpOnly: true,
  secure: process.env.NODE_ENV !== 'development',
  sameSite: 'strict' as const,
  path: '/auth',
  maxAge: REFRESH_TOKEN_TTL_MS,
});

const setRefreshCookie = (res: Response, _req: Request, value: string, expiresAt?: Date): void => {
  const options = getRefreshCookieOptions();
  if (expiresAt) {
    res.cookie(REFRESH_TOKEN_COOKIE, value, { ...options, expires: expiresAt });
    return;
  }

  res.cookie(REFRESH_TOKEN_COOKIE, value, options);
};

const clearRefreshCookie = (res: Response, _req: Request): void => {
  const options = getRefreshCookieOptions();
  res.clearCookie(REFRESH_TOKEN_COOKIE, options);
};

const mintTokens = async (user: IUser, req: Request, res: Response) => {
  const jti = randomUUID();
  const expiresAt = new Date(Date.now() + REFRESH_TOKEN_TTL_MS);
  const refreshToken = signRefreshToken({ sub: user._id.toString(), jti });
  await RefreshToken.create({ userId: user._id, jti, expiresAt });

  const accessToken = signAccessToken({ sub: user._id.toString(), email: user.email, role: user.role });
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

const extractOrigin = (req: Request): string => {
  const { origin } = req.headers;
  if (Array.isArray(origin)) {
    return origin[0] ?? 'unknown';
  }

  if (typeof origin === 'string' && origin.trim().length > 0) {
    return origin;
  }

  return 'unknown';
};

const hashIpAddress = (req: Request): string => {
  const ip = req.ip ?? req.socket.remoteAddress ?? '';
  if (!ip) {
    return 'unknown';
  }

  return createHash('sha256').update(ip).digest('hex');
};

const requestHasEmail = (body: unknown): boolean => {
  if (!body || typeof body !== 'object') {
    return false;
  }

  const email = (body as Record<string, unknown>).email;
  return typeof email === 'string' && email.trim().length > 0;
};

type ValidationError = {
  field: string;
  code: string;
  message: string;
};

const formatZodErrors = (error: z.ZodError): ValidationError[] =>
  error.issues.flatMap((issue) => {
    if (issue.code === z.ZodIssueCode.unrecognized_keys) {
      const keys = 'keys' in issue && Array.isArray(issue.keys) ? issue.keys : [];
      return keys.map((key) => ({
        field: key,
        code: 'unrecognized_key',
        message: 'This field is not allowed.',
      }));
    }

    const field = issue.path.length > 0 ? issue.path.join('.') : 'root';

    if (issue.code === z.ZodIssueCode.invalid_string && issue.validation === 'email') {
      return [
        {
          field,
          code: 'invalid_email',
          message: 'Enter a valid email',
        },
      ];
    }

    return [
      {
        field,
        code: issue.code,
        message: issue.message,
      },
    ];
  });

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

router.post('/register', registerRateLimiter, async (req, res) => {
  const log = req.log ?? authLogger;
  const result = registerSchema.safeParse(req.body);

  if (!result.success) {
    res.status(400).json({ errors: formatZodErrors(result.error) });
    return;
  }

  try {
    const { email, phone, password, role } = result.data;
    const assignedRole = features.rbac ? role : DEFAULT_ROLE;
    const user = await User.create({ email, phone, password, role: assignedRole });

    recordAuthSignupSuccess();
    log.info({ event: 'auth.signup.success', userId: user._id.toString() });
    const { accessToken } = await mintTokens(user, req, res);
    res.status(201).json({ accessToken });
  } catch (error) {
    if (isDuplicateKeyError(error)) {
      const field = getDuplicateFieldName(error) ?? 'email';
      if (field === 'email') {
        res.status(409).json({ error: 'email_exists' });
        return;
      }

      res.status(409).json({ error: `${field}_exists` });
      return;
    }

    log.error({ event: 'auth.signup.error', err: error });
    res.status(500).json({ error: 'Unable to register user.' });
  }
});

router.all('/register', (_req, res) => {
  res.set('Allow', 'POST');
  res.status(405).json({ error: 'Method not allowed' });
});

router.post('/login', loginRateLimiter, async (req, res) => {
  const log = req.log ?? authLogger;
  const origin = extractOrigin(req);
  const ipHash = hashIpAddress(req);

  emitLoginAttempt({
    origin,
    hasEmail: requestHasEmail(req.body),
    ipHash,
  });
  try {
    const parseResult = loginInputSchema.safeParse(req.body);
    if (!parseResult.success) {
      emitLoginFailure({ origin, reason: 'validation', ipHash });
      res.status(400).json({ errors: formatZodErrors(parseResult.error) });
      return;
    }

    const input = parseResult.data as LoginInput;
    const identifier = input.email;

    if (isAccountLocked(identifier)) {
      recordAuthLoginFail();
      log.warn({ event: 'auth.login.failure', reason: 'account_locked' });
      emitLoginFailure({ origin, reason: 'auth', ipHash });
      res.status(429).json({ error: 'Too many login attempts. Please try again later.' });
      return;
    }

    const user = await User.findOne({ email: sanitizeEmail(input.email) });
    if (!user) {
      const lockedUntil = registerFailedLoginAttempt(identifier);
      if (lockedUntil) {
        recordAuthLoginFail();
        log.warn({ event: 'auth.login.failure', reason: 'account_locked' });
        emitLoginFailure({ origin, reason: 'auth', ipHash });
        res.status(429).json({ error: 'Too many login attempts. Please try again later.' });
        return;
      }

      recordAuthLoginFail();
      log.warn({ event: 'auth.login.failure', reason: 'user_not_found' });
      emitLoginFailure({ origin, reason: 'auth', ipHash });
      res.status(401).json({ error: 'Invalid credentials.' });
      return;
    }

    const passwordValid = await user.comparePassword(input.password);
    if (!passwordValid) {
      const lockedUntil = registerFailedLoginAttempt(identifier);
      recordAuthLoginFail();
      emitLoginFailure({ origin, reason: 'auth', ipHash });
      if (lockedUntil) {
        log.warn({ event: 'auth.login.failure', reason: 'account_locked' });
        res.status(429).json({ error: 'Too many login attempts. Please try again later.' });
        return;
      }

      log.warn({ event: 'auth.login.failure', reason: 'invalid_credentials', userId: user._id.toString() });
      res.status(401).json({ error: 'Invalid credentials.' });
      return;
    }

    resetLoginFailures(identifier);
    recordAuthLoginSuccess();
    log.info({ event: 'auth.login.success', userId: user._id.toString() });
    emitLoginSuccess({ origin, userId: user._id.toString(), ipHash });
    await handleAuthResponse(user, req, res, 200);
  } catch (error) {
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
