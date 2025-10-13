import 'dotenv/config';
import mongoose from 'mongoose';
import User from '../models/User';

const { MONGO_URI, DB_LINK } = process.env;
const connectionUri = MONGO_URI ?? DB_LINK;

if (!connectionUri) {
  console.error('Missing MONGO_URI environment variable.');
  process.exit(1);
}

const withPrefix = (message: string) => `[show-users] ${message}`;

async function run(): Promise<void> {
  try {
    await mongoose.connect(connectionUri);
    console.log(withPrefix('Connected to MongoDB.'));

    const users = await User.find({}, ['email', 'role', 'createdAt', 'name'])
      .sort({ createdAt: 1 })
      .lean();

    if (users.length === 0) {
      console.log(withPrefix('No users found.'));
      return;
    }

    console.table(
      users.map((user) => ({
        email: user.email,
        name: (user as { name?: string }).name ?? '',
        role: user.role,
        createdAt: user.createdAt,
      })),
    );
  } catch (error) {
    console.error(withPrefix('Failed to list users.'), error);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
    console.log(withPrefix('Disconnected from MongoDB.'));
  }
}

run().catch((error) => {
  console.error(withPrefix('Unexpected error when listing users.'), error);
  process.exit(1);
});
