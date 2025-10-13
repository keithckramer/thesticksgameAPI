import { Schema, Model, Document, model } from 'mongoose';
import { Roles, DEFAULT_ROLE, type Role } from '../types/roles';
import { comparePassword, hashPassword } from '../utils/hash';

export interface IUser extends Document {
  email: string;
  phone?: string;
  password: string;
  role: Role;
  comparePassword(candidate: string): Promise<boolean>;
}

export interface IUserModel extends Model<IUser> {}

const UserSchema = new Schema<IUser, IUserModel>(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      set: (value: string) => value.trim().toLowerCase(),
    },
    phone: {
      type: String,
      unique: true,
      sparse: true,
      trim: true,
      set: (value: string | undefined | null) => {
        if (typeof value !== 'string') {
          return value ?? undefined;
        }

        const sanitized = value.trim();
        return sanitized.length > 0 ? sanitized : undefined;
      },
    },
    password: {
      type: String,
      required: true,
      minlength: 12,
    },
    role: {
      type: String,
      enum: Object.values(Roles),
      default: DEFAULT_ROLE,
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

UserSchema.index({ email: 1 }, { unique: true });
UserSchema.index({ phone: 1 }, { unique: true, sparse: true });
UserSchema.index({ role: 1 });

UserSchema.pre('save', async function preSave(this: IUser, next) {
  if (!this.isModified('password')) {
    return next();
  }

  try {
    this.password = await hashPassword(this.password);
    return next();
  } catch (error) {
    return next(error as Error);
  }
});

UserSchema.methods.comparePassword = function compare(this: IUser, candidate: string): Promise<boolean> {
  return comparePassword(candidate, this.password);
};

export const User = model<IUser, IUserModel>('User', UserSchema);

export default User;
