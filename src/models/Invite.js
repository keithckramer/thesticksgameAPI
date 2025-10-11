import mongoose from "mongoose";
import {
  INVITES_EXPIRY_MS,
  PUBLIC_BASE_URL,
} from "../config/invites.js";

const { Schema } = mongoose;

const inviteSchema = new Schema(
  {
    code: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    channel: {
      type: String,
      enum: ["email", "sms", "link"],
      required: true,
    },
    email: {
      type: String,
      trim: true,
      lowercase: true,
    },
    phone: {
      type: String,
      trim: true,
    },
    invitedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    role: {
      type: String,
      default: "user",
      trim: true,
    },
    status: {
      type: String,
      enum: [
        "pending",
        "clicked",
        "accepted",
        "registered",
        "revoked",
        "expired",
      ],
      default: "pending",
      index: true,
    },
    expiresAt: {
      type: Date,
      default: () => new Date(Date.now() + INVITES_EXPIRY_MS),
      index: true,
    },
    sentAt: Date,
    clickedAt: Date,
    acceptedAt: Date,
    registeredUserId: {
      type: Schema.Types.ObjectId,
      ref: "User",
    },
    metadata: {
      type: Schema.Types.Mixed,
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

inviteSchema.virtual("inviteUrl").get(function () {
  const base = PUBLIC_BASE_URL.replace(/\/$/, "");
  return `${base}/join/${this.code}`;
});

inviteSchema.methods.isExpired = function isExpired() {
  return Boolean(this.expiresAt && this.expiresAt.getTime() < Date.now());
};

const InviteModel = mongoose.models.Invite || mongoose.model("Invite", inviteSchema);

export default InviteModel;
export { InviteModel };
