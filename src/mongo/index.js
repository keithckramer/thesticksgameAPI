import mongoose from "mongoose";

export async function dbConnect() {
  const uri = (process.env.DB_LINK || "").trim();

  console.log("[db] Checking DB_LINK:", Boolean(uri), "length:", uri.length);

  if (!uri) {
    console.error("❌ DB_LINK missing. Set it in .env or server env vars.");
    process.exit(1);
  }

  try {
    mongoose.set("strictQuery", false);
    console.log("[db] Connecting to Mongo…");
    await mongoose.connect(uri);
    console.log("✅ Mongo connected");
  } catch (err) {
    console.error("❌ Mongo connection failed:", err.message);
    process.exit(1);
  }
}
