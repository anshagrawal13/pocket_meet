import httpStatus from "http-status";
import { findUserByToken } from "../utils/token.js";

// The original client sent the token in the body / query string, so those are
// still accepted. The Authorization header is preferred.
export const getTokenFromRequest = (req) => {
  const header = req.headers.authorization;
  if (header?.startsWith("Bearer ")) return header.slice(7).trim();
  return req.body?.token || req.query?.token || null;
};

export const requireAuth = async (req, res, next) => {
  try {
    const user = await findUserByToken(getTokenFromRequest(req));
    if (!user) {
      return res
        .status(httpStatus.UNAUTHORIZED)
        .json({ message: "Please log in to continue" });
    }
    req.user = user;
    next();
  } catch (e) {
    next(e);
  }
};
