import mongoose from "mongoose";
import User from "../schemas/user.schema.js";
import { dbConnect } from "../mongo/index.js";

async function clear() {
  dbConnect();
  await User.deleteMany({});
  console.log("DB cleared");
}

clear().then(() => {
  mongoose.connection.close();
});
