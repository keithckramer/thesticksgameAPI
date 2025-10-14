import 'dotenv/config';
import cors, { type CorsOptions } from 'cors';
import cookieParser from 'cookie-parser';
import express, { type RequestHandler } from 'express';
import type { Server } from 'http';
import mongoose from 'mongoose';
import authRoutes from './routes/auth';
import passwordRoutes from './routes/password';
import { authenticate } from './middleware/auth';
import securityHeaders from './middleware/helmet';
import { logger, requestLoggingMiddleware } from './middleware/logging';
import User from './models/User';
import { metricsHandler } from './observability/metrics';

const app = express();

app.set('trust proxy', 1);
app.disable('x-powered-by');

const DEFAULT_ALLOWED_ORIGINS = ['http://localhost:3000'];

const parseAllowedOrigins = (value: string | undefined): string[] =>
  (value ?? '')
    .split(',')
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0);

const configuredOrigins = parseAllowedOrigins(process.env.WEB_ORIGIN);
const allowedOrigins = configuredOrigins.length > 0 ? configuredOrigins : DEFAULT_ALLOWED_ORIGINS;

if (configuredOrigins.length === 0) {
  logger.warn(
    {
      event: 'security.cors.configuration_missing',
    },
    'No allowed origins configured. Falling back to defaults.',
  );
}

const enforceAllowedOrigins: RequestHandler = (req, res, next) => {
  const origin = req.headers.origin;
  if (!origin || allowedOrigins.includes(origin)) {
    res.header('Vary', 'Origin');
    next();
    return;
  }

  req.log?.warn({ event: 'security.cors.blocked', origin });

  if (req.method === 'OPTIONS') {
    res.sendStatus(403);
    return;
  }

  res.status(403).json({ error: 'Origin not allowed.' });
};

const corsOptions: CorsOptions = {
  origin: (origin, callback) => {
    if (!origin) {
      if (allowedOrigins.length === 0) {
        callback(null, false);
        return;
      }

      callback(null, true);
      return;
    }

    if (allowedOrigins.length === 0) {
      callback(null, false);
      return;
    }

    callback(null, allowedOrigins.includes(origin));
  },
  credentials: true,
  optionsSuccessStatus: 204,
};

app.use(requestLoggingMiddleware);
app.use(enforceAllowedOrigins);
app.use(cors(corsOptions));
app.use(securityHeaders());
app.use(cookieParser());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get('/metrics', metricsHandler);

app.use('/auth', authRoutes);
app.use('/auth', passwordRoutes);

app.get('/profile', authenticate, async (req, res) => {
  const userId = req.auth?.userId;

  if (!userId) {
    res.status(401).json({ error: 'Authorization required.' });
    return;
  }

  const user = await User.findById(userId);
  if (!user) {
    res.status(404).json({ error: 'User not found.' });
    return;
  }

  res.json({
    user: {
      id: user._id.toString(),
      email: user.email,
      phone: user.phone ?? null,
      role: user.role,
    },
  });
});

const getMongoUri = (): string => {
  const uri = process.env.MONGO_URI ?? process.env.DATABASE_URL;
  if (uri) {
    return uri;
  }

  return 'mongodb://127.0.0.1:27017/thesticksgame';
};

export const connectDatabase = async (): Promise<typeof mongoose> => {
  if (mongoose.connection.readyState !== 0) {
    return mongoose;
  }

  const uri = getMongoUri();
  return mongoose.connect(uri);
};

export const startServer = async (): Promise<Server> => {
  await connectDatabase();
  const port = Number.parseInt(process.env.PORT ?? '8080', 10);

  return new Promise<Server>((resolve) => {
    const server = app.listen(port, () => {
      logger.info({ event: 'server.start', port }, 'Server listening');
      resolve(server);
    });
  });
};

if (process.env.NODE_ENV !== 'test') {
  startServer().catch((error) => {
    logger.error({ event: 'server.start.failure', err: error }, 'Failed to start server');
    process.exit(1);
  });
}

export default app;
