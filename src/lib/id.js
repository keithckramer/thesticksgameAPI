import crypto from "crypto";

const INVITE_ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
const INVITE_CODE_LENGTH = 10;

export const generateInviteCode = (length = INVITE_CODE_LENGTH) => {
  const bytes = crypto.randomBytes(length);
  let code = "";

  for (let index = 0; index < length; index += 1) {
    const value = bytes[index] % INVITE_ALPHABET.length;
    code += INVITE_ALPHABET[value];
  }

  return code;
};

export default generateInviteCode;
