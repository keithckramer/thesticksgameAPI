import mongoose from "mongoose";
import dotenv from "dotenv";

dotenv.config();

export const dbConnect = () => {
  mongoose.connect(process.env.DB_LINK, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => {
    console.log('Connected to MongoDB');
  })
  .catch((err) => {
    console.error('Error connecting to MongoDB:', err);
  });
};
// export const dbConnect = () => {
//   mongoose.connection.once("open", () => console.log("DB connection"));
//   return mongoose.connect(
//     `mongodb+srv://${process.env.DB_LINK}?retryWrites=true&w=majority`,
//     { keepAlive: true }
//   );
// };
