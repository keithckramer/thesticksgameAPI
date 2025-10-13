import mongoose from 'mongoose';
import { DEFAULT_ROLE, Roles } from '../../types/roles';

const USERS_COLLECTION = 'users';

export const up = async (): Promise<void> => {
  const collection = mongoose.connection.collection(USERS_COLLECTION);

  await collection.updateMany(
    { $or: [{ role: { $exists: false } }, { role: { $in: [null, ''] } }] },
    { $set: { role: DEFAULT_ROLE } },
  );

  const admins = await collection.countDocuments({ role: Roles.admin });
  if (admins === 0) {
    const fallbackUser = await collection
      .find({})
      .sort({ createdAt: 1, _id: 1 })
      .limit(1)
      .next();

    if (fallbackUser) {
      await collection.updateOne({ _id: fallbackUser._id }, { $set: { role: Roles.admin } });
    }
  }

  const existingIndex = await collection.indexExists('role_1');
  if (!existingIndex) {
    await collection.createIndex({ role: 1 });
  }
};

export const down = async (): Promise<void> => {
  const collection = mongoose.connection.collection(USERS_COLLECTION);

  try {
    await collection.dropIndex('role_1');
  } catch (error) {
    const codeName =
      typeof error === 'object' && error && 'codeName' in error
        ? (error as { codeName?: unknown }).codeName
        : undefined;

    if (codeName !== 'IndexNotFound') {
      throw error;
    }
  }

  await collection.updateMany({}, { $unset: { role: '' } });
};

export default { up, down };
