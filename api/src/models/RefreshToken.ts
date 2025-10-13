import { Schema, Model, Document, model, Types } from 'mongoose';

export interface IRefreshToken extends Document {
  jti: string;
  userId: Types.ObjectId;
  expiresAt: Date;
  revokedAt?: Date | null;
  isRevoked(): boolean;
}

export interface IRefreshTokenModel extends Model<IRefreshToken> {}

const RefreshTokenSchema = new Schema<IRefreshToken, IRefreshTokenModel>(
  {
    jti: {
      type: String,
      required: true,
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
    revokedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

RefreshTokenSchema.index({ userId: 1, jti: 1 }, { unique: true });
RefreshTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

RefreshTokenSchema.methods.isRevoked = function isRevoked(this: IRefreshToken): boolean {
  return Boolean(this.revokedAt && this.revokedAt <= new Date());
};

export const RefreshToken = model<IRefreshToken, IRefreshTokenModel>('RefreshToken', RefreshTokenSchema);

export default RefreshToken;
