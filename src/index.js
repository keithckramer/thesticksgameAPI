import dotenv from "dotenv";

dotenv.config();

function validateEnv() {
  const missing = [];
  if (!process.env.JWT_SECRET) missing.push("JWT_SECRET");
  if (!process.env.ADMIN_KEY) missing.push("ADMIN_KEY");
  if (!process.env.DB_LINK) missing.push("DB_LINK");
  if (missing.length) {
    console.error("❌ Missing required env vars:", missing.join(", "));
    process.exit(1);
  }
}

validateEnv();

import "./passport.js";
import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import { dbConnect } from "./mongo/index.js";
import authRoutes from "./routes/auth.js";
import meRoutes from "./routes/me.js";
import adminRoutes from "./routes/admin.js";
import healthRoutes from "./routes/health.js";
import path from "path";
import * as fs from "fs";
import cron from "node-cron";
import ReseedAction from "./mongo/ReseedAction.js";

const PORT = process.env.PORT || 8080;
const app = express();

app.disable("x-powered-by");

const corsOrigin = process.env.WEB_ORIGIN || "http://localhost:3000";
const corsOptions = {
  origin: corsOrigin,
  credentials: true,
};

await dbConnect();

app.use(cors(corsOptions));
app.use(cookieParser());
app.use(express.json());
app.use(express.json({ type: "application/vnd.api+json", strict: false }));
app.use(express.urlencoded({ extended: true }));

app.get("/", function (req, res) {
  const __dirname = fs.realpathSync(".");
  res.sendFile(path.join(__dirname, "/src/landing/index.html"));
});

app.use("/", authRoutes);
app.use("/me", meRoutes);
app.use("/admin", adminRoutes);
app.use("/health", healthRoutes);

if (process.env.SCHEDULE_HOUR) {
  cron.schedule(`0 */${process.env.SCHEDULE_HOUR} * * *`, () => {
    ReseedAction();
  });
}

app.listen(PORT, () => console.log(`Server listening to port ${PORT}`));
