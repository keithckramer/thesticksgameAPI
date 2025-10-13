import 'dotenv/config';
import cors, { type CorsOptions } from 'cors';
import express from 'express';
import type { Server } from 'http';
import mongoose from 'mongoose';
import authRoutes from './routes/auth';
import { authenticate } from './middleware/auth';
import User from './models/User';

const app = express();

app.set('trust proxy', 1);

const parseOrigins = (value: string | undefined): string[] =>
  (value ?? '')
    .split(',')
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0);

const allowedOrigins = parseOrigins(process.env.CORS_ORIGINS ?? process.env.CORS_ORIGIN);

const corsOptions: CorsOptions = {
  origin: allowedOrigins.length > 0 ? allowedOrigins : true,
  credentials: true,
};

app.use(cors(corsOptions));
app.use(express.json());

app.use('/auth', authRoutes);

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
      console.log(`Server listening on port ${port}`);
      resolve(server);
    });
  });
};

if (process.env.NODE_ENV !== 'test') {
  startServer().catch((error) => {
    console.error('Failed to start server.', error);
    process.exit(1);
  });
}

export default app;
