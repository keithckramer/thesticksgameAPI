import mongoose from "mongoose";

const UserSchema = new mongoose.Schema(
  {
    email: { type: String, unique: true, sparse: true, trim: true, lowercase: true },
    phone: { type: String, unique: true, sparse: true, trim: true },
    name:  { type: String, trim: true },
    passwordHash: { type: String, required: true },
    roles: { type: [String], default: ["user"] },
    lastLoginAt: Date,
  },
  { timestamps: true }
);

export default mongoose.model("User", UserSchema);
