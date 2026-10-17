// Mirrors backend/src/utils/validation.js - the server re-checks everything.
export const USERNAME_RE = /^[a-z0-9_]{3,20}$/;
export const MEETING_CODE_RE = /^[a-z0-9]{3}-[a-z0-9]{4}-[a-z0-9]{3}$/;

export const normalizeUsername = (v) => String(v ?? "").trim().toLowerCase();

export const usernameError = (v) =>
  USERNAME_RE.test(normalizeUsername(v))
    ? ""
    : "3-20 characters: letters, numbers and underscores only";

export const nameError = (v) => {
  const n = String(v ?? "").trim();
  return n.length < 2 || n.length > 50 ? "Enter 2-50 characters" : "";
};

export const passwordError = (v) =>
  !v || v.length < 8 ? "Use at least 8 characters" : "";

// accepts a full invite link or a code, returns a normalized code ("" if invalid)
export const extractMeetingCode = (input) => {
  let s = String(input ?? "").trim().toLowerCase();
  const m = s.match(/([a-z0-9]{3}-[a-z0-9]{4}-[a-z0-9]{3})(?:[/?#]|$)/);
  s = m ? m[1] : s;
  return MEETING_CODE_RE.test(s) ? s : "";
};

export const initials = (name) =>
  String(name ?? "?")
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("") || "?";

export const errorMessage = (err, fallback = "Something went wrong") =>
  err?.response?.data?.message ||
  (err?.request ? "Can't reach the server. Check your connection." : fallback);
