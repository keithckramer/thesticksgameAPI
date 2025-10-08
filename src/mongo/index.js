import mongoose from "mongoose";
import dotenv from "dotenv";

dotenv.config();

function buildConnectionString(rawLink = "") {
  if (!rawLink) {
    throw new Error("DB_LINK environment variable is required");
  }

  if (!rawLink.includes("://")) {
    const base = `mongodb+srv://${rawLink}`;
    return base.includes("?") ? base : `${base}?retryWrites=true&w=majority`;
  }

  try {
    const url = new URL(rawLink);

    if (url.username) {
      url.username = encodeURIComponent(decodeURIComponent(url.username));
    }

    if (url.password) {
      url.password = encodeURIComponent(decodeURIComponent(url.password));
    }

    return url.toString();
  } catch (error) {
    console.warn("Failed to normalize DB connection string:", error.message);
    return rawLink;
  }
}

export const dbConnect = () => {
  mongoose.connection.once("open", () => console.log("DB connection"));

  const connectionString = buildConnectionString(process.env.DB_LINK);

  return mongoose.connect(connectionString, { keepAlive: true });
};
