import express from "express";
import bodyParser from "body-parser";
import cors from "cors";
import dotenv from "dotenv";
import "./passport.js";
import { dbConnect } from "./mongo/index.js"; // Keep this as you already have it
import { userRoutes, meRoutes, authRoutes, gameRoutes, weekScheduleRoutes } from './routes/index.js';
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

// MongoDB connection - Make sure this is connected
const uri = process.env.DB_LINK; // This should already be in your .env file
dbConnect(uri);

// Middleware
app.use(cors(corsOptions));
app.use(bodyParser.json({ type: "application/vnd.api+json", strict: false }));
app.use(express.json());

// Serve static landing page
app.get("/", function (req, res) {
  const __dirname = fs.realpathSync(".");
  res.sendFile(path.join(__dirname, "/src/landing/index.html"));
});

//Routes
app.use("/", authRoutes);
app.use("/me", meRoutes);
//app.use("/game",gameRoutes);
//app.use("/weekschedule", weekScheduleRoutes);
app.use('/api/users', userRoutes);
// app.use('/api/me', meRoutes);
// app.use('/api/auth', authRoutes);
app.use('/api/games', gameRoutes);
app.use("/api/weekschedule", weekScheduleRoutes);

// Cron job (Reseeding the database at a scheduled time)
if (process.env.SCHEDULE_HOUR) {
  cron.schedule(`0 */${process.env.SCHEDULE_HOUR} * * *'`, () => {
    ReseedAction();
  });
}

// Start the server
app.listen(PORT, () => console.log(`Server listening to port ${PORT}`));

// import express from "express";
// import bodyParser from "body-parser";
// import cors from "cors";
// import dotenv from "dotenv";
// import "./passport.js";
// import { dbConnect } from "./mongo/index.js";
// //import { meRoutes, authRoutes } from "./routes";
// import { meRoutes } from "./routes/index.js";
// import { authRoutes } from "./routes/index.js";
// import path from "path";
// import * as fs from "fs";
// import cron from "node-cron";
// import ReseedAction from "./mongo/ReseedAction.js";

// dotenv.config();

// const PORT = process.env.PORT || 8080;
// const app = express();

// const whitelist = [process.env.APP_URL_CLIENT];
// const corsOptions = {
//   origin: function (origin, callback) {
//     if (!origin || whitelist.indexOf(origin) !== -1) {
//       callback(null, true);
//     } else {
//       callback(new Error("Not allowed by CORS"));
//     }
//   },
//   credentials: true,
// };

// dbConnect();

// app.use(cors(corsOptions));
// app.use(bodyParser.json({ type: "application/vnd.api+json", strict: false }));

// app.get("/", function (req, res) {
//   const __dirname = fs.realpathSync(".");
//   res.sendFile(path.join(__dirname, "/src/landing/index.html"));
// });

// app.use("/", authRoutes);
// app.use("/me", meRoutes);

// if (process.env.SCHEDULE_HOUR) {
//   cron.schedule(`0 */${process.env.SCHEDULE_HOUR} * * *'`, () => {
//     ReseedAction();
//   });
// }

// app.listen(PORT, () => console.log(`Server listening to port ${PORT}`));
