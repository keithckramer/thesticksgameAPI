import { randomUUID } from 'crypto';
import type { RequestHandler } from 'express';
import pino, { type Logger as PinoLogger } from 'pino';

export const logger = pino({
  level: process.env.LOG_LEVEL ?? 'info',
  base: undefined,
  messageKey: 'message',
  timestamp: pino.stdTimeFunctions.isoTime,
});

export type Logger = PinoLogger;

declare global {
  namespace Express {
    // eslint-disable-next-line @typescript-eslint/consistent-type-definitions
    interface Request {
      log?: Logger;
      requestId?: string;
    }
  }
}

export const requestLoggingMiddleware: RequestHandler = (req, res, next) => {
  const requestIdHeader = req.headers['x-request-id'];
  const requestId =
    (Array.isArray(requestIdHeader) ? requestIdHeader[0] : requestIdHeader) ?? randomUUID();

  const startTime = process.hrtime.bigint();

  const requestLogger = logger.child({
    requestId,
    method: req.method,
    path: req.originalUrl,
  });

  req.log = requestLogger;
  req.requestId = requestId;
  res.setHeader('X-Request-Id', requestId);

  res.on('finish', () => {
    const durationMs = Number(process.hrtime.bigint() - startTime) / 1_000_000;
    requestLogger.info({
      event: 'http.response',
      statusCode: res.statusCode,
      contentLength: res.getHeader('content-length'),
      durationMs,
    });
  });

  next();
};

export const authLogger = logger.child({ component: 'auth' });
export const auditLogger = logger.child({ component: 'audit' });

