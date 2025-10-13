import { randomUUID } from 'crypto';
import type { Request, Response } from 'express';
import { Router } from 'express';
import { z } from 'zod';
import RefreshToken from '../models/RefreshToken';
import User, { type IUser } from '../models/User';
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
    .min(1, 'Name is required.')
    .max(100, 'Name must be 100 characters or fewer.')
    .transform(sanitizeString)
    .optional(),
  email: emailSchema,
  phone: phoneSchema.optional(),
  password: passwordSchema,
});

const loginInputSchema = z.object({
  email: emailSchema,
  password: z.string({ required_error: 'Password is required.' }).min(1, 'Password is required.'),
});

type RegisterInput = z.infer<typeof registerInputSchema>;
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

router.post('/register', registerRateLimiter, async (req, res) => {
  try {
    const input = registerInputSchema.parse(req.body) as RegisterInput;

    const existing = await User.findOne({ email: sanitizeEmail(input.email) });
    if (existing) {
      res.status(400).json({ error: 'Email is already registered.' });
      return;
    }

    const user = await User.create({
      email: input.email,
      phone: input.phone,
      password: input.password,
    });

    await handleAuthResponse(user, req, res, 201);
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: error.errors[0]?.message ?? 'Invalid input.' });
      return;
    }

    if (error && typeof error === 'object' && 'code' in error && (error as { code?: number }).code === 11000) {
      res.status(400).json({ error: 'Email is already registered.' });
      return;
    }

    console.error('Failed to register user.', error);
    res.status(500).json({ error: 'Unable to register user.' });
  }
});

router.post('/login', loginRateLimiter, async (req, res) => {
  try {
    const input = loginInputSchema.parse(req.body) as LoginInput;
    const identifier = input.email;

    if (isAccountLocked(identifier)) {
      res.status(429).json({ error: 'Too many login attempts. Please try again later.' });
      return;
    }

    const user = await User.findOne({ email: sanitizeEmail(input.email) });
    if (!user) {
      const lockedUntil = registerFailedLoginAttempt(identifier);
      if (lockedUntil) {
        res.status(429).json({ error: 'Too many login attempts. Please try again later.' });
        return;
      }

      res.status(401).json({ error: 'Invalid credentials.' });
      return;
    }

    const passwordValid = await user.comparePassword(input.password);
    if (!passwordValid) {
      const lockedUntil = registerFailedLoginAttempt(identifier);
      if (lockedUntil) {
        res.status(429).json({ error: 'Too many login attempts. Please try again later.' });
        return;
      }

      res.status(401).json({ error: 'Invalid credentials.' });
      return;
    }

    resetLoginFailures(identifier);
    await handleAuthResponse(user, req, res, 200);
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: error.errors[0]?.message ?? 'Invalid input.' });
      return;
    }

    console.error('Failed to process login.', error);
    res.status(500).json({ error: 'Unable to process login.' });
  }
});

router.post('/refresh', refreshRateLimiter, async (req, res) => {
  const token = getRefreshTokenFromRequest(req);
  if (!token) {
    res.status(401).json({ error: 'Refresh token is missing.' });
    return;
  }

  try {
    const payload = verifyRefreshToken(token);
    const refreshDoc = await RefreshToken.findOne({ userId: payload.sub, jti: payload.jti });

    if (!refreshDoc || refreshDoc.isRevoked()) {
      res.status(401).json({ error: 'Refresh token is invalid or expired.' });
      return;
    }

    if (refreshDoc.expiresAt <= new Date()) {
      refreshDoc.revokedAt = new Date();
      await refreshDoc.save();
      res.status(401).json({ error: 'Refresh token is invalid or expired.' });
      return;
    }

    const user = await User.findById(payload.sub);
    if (!user) {
      refreshDoc.revokedAt = new Date();
      await refreshDoc.save();
      console.info('Refresh token revoked for missing user.', { userId: payload.sub, jti: payload.jti });
      res.status(401).json({ error: 'Refresh token is invalid or expired.' });
      return;
    }

    refreshDoc.revokedAt = new Date();
    await refreshDoc.save();
    console.info('Refresh token rotated.', {
      userId: user._id.toString(),
      oldJti: payload.jti,
    });

    const { accessToken, jti } = await mintTokens(user, req, res);
    console.info('New refresh token issued.', {
      userId: user._id.toString(),
      jti,
    });

    res.status(200).json({ accessToken });
  } catch (error) {
    res.status(401).json({ error: 'Refresh token is invalid or expired.' });
  }
});

router.post('/logout', async (req, res) => {
  const token = getRefreshTokenFromRequest(req);
  if (token) {
    try {
      const payload = verifyRefreshToken(token);
      const refreshDoc = await RefreshToken.findOne({ userId: payload.sub, jti: payload.jti });
      if (refreshDoc && !refreshDoc.isRevoked()) {
        refreshDoc.revokedAt = new Date();
        await refreshDoc.save();
        console.info('Refresh token revoked via logout.', {
          userId: payload.sub,
          jti: payload.jti,
        });
      }
    } catch (error) {
      console.warn('Failed to revoke refresh token during logout.', error);
    }
  }

  clearRefreshCookie(res, req);
  res.status(200).json({ success: true });
});

export default router;
