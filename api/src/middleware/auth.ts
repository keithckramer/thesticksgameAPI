import type { NextFunction, Response, Request } from 'express';
import type { Logger } from './logging';
import type { Role } from '../types/roles';
import { verifyAccessToken, type AccessTokenPayload } from '../utils/jwt';

export interface AuthContext {
  userId: string;
  email?: string;
  claims: AccessTokenPayload;
  token: string;
  role?: Role;
}

export type AuthenticatedRequest = Request & {
  auth?: AuthContext;
  log?: Logger;
  requestId?: string;
};

declare global {
  namespace Express {
    // eslint-disable-next-line @typescript-eslint/consistent-type-definitions
    interface Request {
      auth?: AuthContext;
    }
  }
}

const AUTH_ERROR = { error: 'Authorization required.' } as const;
const INVALID_TOKEN_ERROR = { error: 'Invalid or expired access token.' } as const;

export const authenticate = (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
  const authHeader = req.get('authorization');

  if (!authHeader) {
    res.status(401).json(AUTH_ERROR);
    return;
  }

  const [scheme, token] = authHeader.split(' ');

  if (!scheme || scheme.toLowerCase() !== 'bearer' || !token) {
    res.status(401).json(AUTH_ERROR);
    return;
  }

  try {
    const payload = verifyAccessToken(token);
    if (!payload.sub) {
      res.status(401).json(INVALID_TOKEN_ERROR);
      return;
    }

    req.auth = {
      userId: payload.sub,
      email: typeof payload.email === 'string' ? payload.email : undefined,
      claims: payload,
      token,
    };

    next();
  } catch (error) {
    res.status(401).json(INVALID_TOKEN_ERROR);
  }
};

export default authenticate;
