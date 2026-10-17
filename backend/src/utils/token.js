import crypto from "node:crypto";
import { User } from "../models/user.model.js";

const TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

// Only the SHA-256 hash of a token is stored, so a leaked database
// does not leak working login tokens.
export const hashToken = (token) =>
  crypto.createHash("sha256").update(String(token)).digest("hex");

export const createToken = () => {
  const token = crypto.randomBytes(32).toString("hex");
  return {
    token,
    hash: hashToken(token),
    expires: new Date(Date.now() + TOKEN_TTL_MS),
  };
};

export const findUserByToken = async (token) => {
  if (!token || typeof token !== "string") return null;
  return User.findOne({
    token: hashToken(token),
    tokenExpires: { $gt: new Date() },
  });
};
