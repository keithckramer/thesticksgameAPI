import mongoose from "mongoose";

export async function dbConnect() {
  const uri = (process.env.DB_LINK || "").trim();
  console.log("Connecting to Mongo…");

  if (!uri) {
    console.error("❌ DB_LINK missing! Set it in your .env file.");
    process.exit(1);
  }

  try {
    await mongoose.connect(uri, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log("✅ Mongo connected");
  } catch (err) {
    console.error("❌ Mongo connection failed:", err.message);
    process.exit(1);
  }
}
