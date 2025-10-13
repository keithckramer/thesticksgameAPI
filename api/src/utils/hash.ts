import bcrypt from 'bcrypt';

const MIN_COST = 12;
const envCost = Number.parseInt(process.env.BCRYPT_COST ?? '', 10);
const WORK_FACTOR = Number.isInteger(envCost) && envCost >= MIN_COST ? envCost : MIN_COST;

/**
 * Hashes a plain text password using bcrypt with a minimum work factor of 12.
 */
export const hashPassword = async (plainText: string, cost: number = WORK_FACTOR): Promise<string> => {
  if (!plainText) {
    throw new Error('Cannot hash an empty password.');
  }

  const effectiveCost = Number.isInteger(cost) && cost >= MIN_COST ? cost : WORK_FACTOR;
  return bcrypt.hash(plainText, effectiveCost);
};

/**
 * Compares a plain text password against a bcrypt hash.
 */
export const comparePassword = (plainText: string, hash: string): Promise<boolean> => {
  return bcrypt.compare(plainText, hash);
};

export const getWorkFactor = (): number => WORK_FACTOR;

export default {
  hashPassword,
  comparePassword,
  getWorkFactor,
};
