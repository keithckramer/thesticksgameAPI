import { Schema, Model, Document, model, Types } from 'mongoose';

export interface IPasswordResetToken extends Document {
  token: string;
  userId: Types.ObjectId;
  expiresAt: Date;
  usedAt?: Date | null;
  isExpired(): boolean;
  isUsed(): boolean;
}

export interface IPasswordResetTokenModel extends Model<IPasswordResetToken> {}

const PasswordResetTokenSchema = new Schema<IPasswordResetToken, IPasswordResetTokenModel>(
  {
    token: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    expiresAt: {
      type: Date,
      required: true,
    },
    usedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

PasswordResetTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

PasswordResetTokenSchema.methods.isExpired = function isExpired(this: IPasswordResetToken): boolean {
  return this.expiresAt.getTime() <= Date.now();
};

PasswordResetTokenSchema.methods.isUsed = function isUsed(this: IPasswordResetToken): boolean {
  return Boolean(this.usedAt && this.usedAt.getTime() <= Date.now());
};

export const PasswordResetToken = model<IPasswordResetToken, IPasswordResetTokenModel>(
  'PasswordResetToken',
  PasswordResetTokenSchema
);

export default PasswordResetToken;

