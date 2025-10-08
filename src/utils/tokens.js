import crypto from "crypto";
export const genToken = (len = 16) => crypto.randomBytes(len).toString("hex");
