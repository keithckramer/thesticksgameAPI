import helmet from 'helmet';
import type { RequestHandler } from 'express';

const securityHeaders = (): RequestHandler =>
  helmet({
    crossOriginEmbedderPolicy: false,
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  });

export default securityHeaders;

