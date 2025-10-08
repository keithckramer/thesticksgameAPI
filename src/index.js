import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import "./passport.js";
import { dbConnect } from "./mongo/index.js";
import authRoutes from "./routes/auth.js";
import meRoutes from "./routes/me.js";
import healthRoutes from "./routes/health.js";
import path from "path";
import * as fs from "fs";
import cron from "node-cron";
import ReseedAction from "./mongo/ReseedAction.js";

dotenv.config();

const PORT = process.env.PORT || 8080;
const app = express();

const whitelist = [process.env.APP_URL_CLIENT];
const corsOptions = {
  origin: function (origin, callback) {
    if (!origin || whitelist.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(new Error("Not allowed by CORS"));
    }
  },
  credentials: true,
};

dbConnect();

app.use(cors(corsOptions));
app.use(express.json());
app.use(express.json({ type: "application/vnd.api+json", strict: false }));
app.use(express.urlencoded({ extended: true }));

app.get("/", function (req, res) {
  const __dirname = fs.realpathSync(".");
  res.sendFile(path.join(__dirname, "/src/landing/index.html"));
});

app.use("/", authRoutes);
app.use("/me", meRoutes);
app.use("/health", healthRoutes);

if (process.env.SCHEDULE_HOUR) {
  cron.schedule(`0 */${process.env.SCHEDULE_HOUR} * * *`, () => {
    ReseedAction();
  });
}

app.listen(PORT, () => console.log(`Server listening to port ${PORT}`));
