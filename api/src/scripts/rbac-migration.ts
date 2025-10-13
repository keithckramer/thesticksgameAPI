import 'dotenv/config';
import mongoose from 'mongoose';
import User from '../models/User';
import { Roles } from '../types/roles';

const { MONGO_URI, DB_LINK } = process.env;
const connectionUri = MONGO_URI ?? DB_LINK;

if (!connectionUri) {
  console.error('Missing MONGO_URI environment variable.');
  process.exit(1);
}

const withPrefix = (message: string) => `[rbac-migration] ${message}`;

async function backfillRoles(): Promise<void> {
  const result = await User.updateMany(
    {
      $or: [
        { role: { $exists: false } },
        { role: null },
      ],
    },
    { $set: { role: Roles.member } },
  );

  console.log(
    withPrefix(
      `Backfilled ${result.modifiedCount ?? 0} user(s) with missing roles.`,
    ),
  );
}

async function ensureAdminExists(): Promise<void> {
  const existingAdmin = await User.findOne({ role: Roles.admin }).sort({ createdAt: 1 });
  if (existingAdmin) {
    console.log(withPrefix(`Admin present: ${existingAdmin.email}`));
    return;
  }

  const earliestUser = await User.findOne().sort({ createdAt: 1 }).lean();
  if (!earliestUser) {
    console.log(withPrefix('No users found to promote to admin.'));
    return;
  }

  await User.updateOne(
    { _id: earliestUser._id },
    { $set: { role: Roles.admin } },
    { runValidators: false },
  );
  console.log(withPrefix(`Promoted ${earliestUser.email} to admin (avoid lockout)`));
}

async function run(): Promise<void> {
  try {
    await mongoose.connect(connectionUri);
    console.log(withPrefix('Connected to MongoDB.'));

    await backfillRoles();
    await ensureAdminExists();

    console.log(withPrefix('Migration completed.'));
  } catch (error) {
    console.error(withPrefix('Migration failed.'), error);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
    console.log(withPrefix('Disconnected from MongoDB.'));
  }
}

run().catch((error) => {
  console.error(withPrefix('Unexpected error during migration.'), error);
  process.exit(1);
});
