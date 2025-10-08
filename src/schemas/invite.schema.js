import mongoose from "mongoose";

const InviteSchema = new mongoose.Schema(
  {
    emailOrPhone: { type: String, index: true, required: true, trim: true, lowercase: true },
    token: { type: String, unique: true, index: true, required: true },
    status: { type: String, enum: ["pending","accepted","expired"], default: "pending" },
    invitedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    expiresAt: { type: Date, default: () => new Date(Date.now() + 7*24*60*60*1000) }
  },
  { timestamps: true }
);

// auto-clean only pending (accepted invites persist)
InviteSchema.index(
  { expiresAt: 1 },
  { expireAfterSeconds: 0, partialFilterExpression: { status: "pending" } }
);

export default mongoose.model("Invite", InviteSchema);
