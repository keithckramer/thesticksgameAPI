import jwt, { JwtPayload, SignOptions } from 'jsonwebtoken';

const ACCESS_TOKEN_TTL = '15m';
const REFRESH_TOKEN_TTL = '30d';

const getSecret = (): string => {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('JWT_SECRET is not configured.');
  }

  return secret;
};

export interface AccessTokenPayload extends JwtPayload {
  sub: string;
  email?: string;
  [key: string]: unknown;
}

export interface RefreshTokenPayload extends JwtPayload {
  sub: string;
  jti: string;
}

const signToken = (payload: object, options: SignOptions): string => {
  return jwt.sign(payload, getSecret(), options);
};

export const signAccessToken = (payload: AccessTokenPayload): string => {
  const { sub, exp, iat, nbf, ...claims } = payload;
  return signToken(claims, { expiresIn: ACCESS_TOKEN_TTL, subject: sub });
};

export const signRefreshToken = ({ sub, jti }: RefreshTokenPayload): string => {
  return signToken({ jti }, { expiresIn: REFRESH_TOKEN_TTL, subject: sub });
};

export const verifyAccessToken = (token: string): AccessTokenPayload => {
  const payload = jwt.verify(token, getSecret()) as AccessTokenPayload;
  if (!payload.sub) {
    throw new Error('Access token missing subject.');
  }

  return payload;
};

export const verifyRefreshToken = (token: string): RefreshTokenPayload => {
  const payload = jwt.verify(token, getSecret()) as RefreshTokenPayload;
  if (!payload.sub || !payload.jti) {
    throw new Error('Refresh token missing required claims.');
  }

  return payload;
};

export default {
  signAccessToken,
  signRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
};
