import mongoose from "mongoose";

export async function dbConnect() {
  const uri = (process.env.DB_LINK || "").trim();
  console.log("[db] DB_LINK present:", Boolean(uri), "length:", uri.length);
  if (!uri) {
    console.error("❌ DB_LINK is missing or empty.");
    process.exit(1);
  }
  mongoose.set("strictQuery", false);
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 10000 });
  console.log("✅ Mongo connected");
}
