import mongoose from "mongoose";

export const dbConnect = async () => {
  const uri = (process.env.DB_LINK || "").trim();
  if (!uri) throw new Error("DB_LINK is missing");
  console.log("Connecting to Mongo…");
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 10000 });
  console.log("Mongo connected");
};
