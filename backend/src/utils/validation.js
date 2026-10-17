import crypto from "node:crypto";

// Usernames are stored lower-case so "Ansh" and "ansh" are the same account.
export const USERNAME_RE = /^[a-z0-9_]{3,20}$/;
// Meeting codes look like "abc-defg-hij".
export const MEETING_CODE_RE = /^[a-z0-9]{3}-[a-z0-9]{4}-[a-z0-9]{3}$/;

export const normalizeUsername = (value) =>
  String(value ?? "")
    .trim()
    .toLowerCase();

export const validateUsername = (username) => {
  if (!USERNAME_RE.test(username)) {
    return "Username must be 3-20 characters: letters, numbers and underscores only";
  }
  return null;
};

export const cleanName = (value, max = 50) =>
  String(value ?? "")
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u001f\u007f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);

export const validateName = (name) =>
  name.length < 2 || name.length > 50
    ? "Name must be between 2 and 50 characters"
    : null;

export const validatePassword = (password) => {
  if (typeof password !== "string" || password.length < 8) {
    return "Password must be at least 8 characters";
  }
  // bcrypt silently ignores everything after 72 bytes
  if (Buffer.byteLength(password) > 72) {
    return "Password must be at most 72 bytes";
  }
  return null;
};

// 10 unpredictable characters from a crypto-secure source -> "abc-defg-hij"
const ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789";
export const generateMeetingCode = () => {
  const bytes = crypto.randomBytes(10);
  let s = "";
  for (const b of bytes) s += ALPHABET[b % ALPHABET.length];
  return `${s.slice(0, 3)}-${s.slice(3, 7)}-${s.slice(7)}`;
};
