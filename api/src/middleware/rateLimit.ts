import type { NextFunction, Request, Response } from 'express';

type RateLimitKeyGenerator = (req: Request) => string;

type RateLimitStoreEntry = {
  count: number;
  expiresAt: number;
};

export interface RateLimitOptions {
  windowMs: number;
  max: number;
  keyGenerator?: RateLimitKeyGenerator;
  message?: string;
  statusCode?: number;
}

const DEFAULT_STATUS = 429;
const loginFailures = new Map<string, { count: number; firstFailure: number; lockedUntil?: number }>();

const LOCKOUT_MAX_ATTEMPTS = 5;
const LOCKOUT_WINDOW_MS = 15 * 60 * 1000;

const toIdentifier = (value: unknown): string => {
  if (typeof value !== 'string') {
    return '';
  }

  return value.trim().toLowerCase();
};

const defaultKeyGenerator: RateLimitKeyGenerator = (req) => req.ip ?? 'unknown';

const cleanupStore = (store: Map<string, RateLimitStoreEntry>, now: number): void => {
  for (const [key, entry] of store) {
    if (entry.expiresAt <= now) {
      store.delete(key);
    }
  }
};

export const createRateLimiter = ({
  windowMs,
  max,
  keyGenerator = defaultKeyGenerator,
  message = 'Too many requests. Please try again later.',
  statusCode = DEFAULT_STATUS,
}: RateLimitOptions) => {
  const store = new Map<string, RateLimitStoreEntry>();

  return (req: Request, res: Response, next: NextFunction): void => {
    const now = Date.now();
    cleanupStore(store, now);

    const key = keyGenerator(req) || defaultKeyGenerator(req);
    const entry = store.get(key);

    if (!entry || entry.expiresAt <= now) {
      store.set(key, {
        count: 1,
        expiresAt: now + windowMs,
      });
      next();
      return;
    }

    if (entry.count >= max) {
      res.status(statusCode).json({ error: message });
      return;
    }

    entry.count += 1;
    store.set(key, entry);
    next();
  };
};

const identifierKeyGenerator: RateLimitKeyGenerator = (req) => {
  const email = toIdentifier((req.body as Record<string, unknown> | undefined)?.email);
  return `${req.ip ?? 'unknown'}:${email}`;
};

const getCookieValue = (req: Request, name: string): string => {
  const header = req.headers.cookie;
  if (!header) {
    return '';
  }

  const cookies = header.split(';');
  for (const part of cookies) {
    const [rawKey, ...rest] = part.trim().split('=');
    if (!rawKey) {
      continue;
    }

    const key = decodeURIComponent(rawKey);
    if (key === name) {
      const value = rest.length > 0 ? rest.join('=') : '';
      return decodeURIComponent(value);
    }
  }

  return '';
};

export const registerRateLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  max: 5,
  keyGenerator: identifierKeyGenerator,
  message: 'Too many registration attempts. Please try again later.',
});

export const loginRateLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  max: 5,
  keyGenerator: identifierKeyGenerator,
  message: 'Too many login attempts. Please try again later.',
});

export const refreshRateLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  max: 5,
  keyGenerator: (req) => {
    const token = getCookieValue(req, 'refreshToken');
    return `${req.ip ?? 'unknown'}:${token}`;
  },
  message: 'Too many refresh attempts. Please slow down.',
});

const getLockoutEntry = (identifier: string) => loginFailures.get(identifier);

const resetLockoutIfExpired = (identifier: string, entry: { count: number; firstFailure: number; lockedUntil?: number }, now: number): boolean => {
  if (entry.lockedUntil && entry.lockedUntil <= now) {
    loginFailures.delete(identifier);
    return true;
  }

  if (!entry.lockedUntil && now - entry.firstFailure >= LOCKOUT_WINDOW_MS) {
    loginFailures.delete(identifier);
    return true;
  }

  return false;
};

export const isAccountLocked = (identifier: string): boolean => {
  const normalized = toIdentifier(identifier);
  const entry = getLockoutEntry(normalized);
  const now = Date.now();

  if (!entry) {
    return false;
  }

  const cleared = resetLockoutIfExpired(normalized, entry, now);
  if (cleared) {
    return false;
  }

  if (entry.lockedUntil && entry.lockedUntil > now) {
    return true;
  }

  return false;
};

export const registerFailedLoginAttempt = (identifier: string): Date | null => {
  const normalized = toIdentifier(identifier);
  const now = Date.now();
  const existing = getLockoutEntry(normalized);

  if (!existing) {
    loginFailures.set(normalized, { count: 1, firstFailure: now });
    return null;
  }

  if (existing.lockedUntil && existing.lockedUntil > now) {
    return new Date(existing.lockedUntil);
  }

  if (resetLockoutIfExpired(normalized, existing, now)) {
    loginFailures.set(normalized, { count: 1, firstFailure: now });
    return null;
  }

  existing.count += 1;

  if (existing.count >= LOCKOUT_MAX_ATTEMPTS) {
    existing.lockedUntil = now + LOCKOUT_WINDOW_MS;
    loginFailures.set(normalized, existing);
    return new Date(existing.lockedUntil);
  }

  loginFailures.set(normalized, existing);
  return null;
};

export const resetLoginFailures = (identifier: string): void => {
  const normalized = toIdentifier(identifier);
  loginFailures.delete(normalized);
};

export const getLockoutExpiration = (identifier: string): Date | null => {
  const normalized = toIdentifier(identifier);
  const entry = getLockoutEntry(normalized);
  if (!entry) {
    return null;
  }

  const now = Date.now();
  if (resetLockoutIfExpired(normalized, entry, now)) {
    return null;
  }

  if (entry.lockedUntil && entry.lockedUntil > now) {
    return new Date(entry.lockedUntil);
  }

  return null;
};

export default createRateLimiter;
