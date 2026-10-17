import { User } from "../models/user.model.js";
import { Meeting } from "../models/meeting.model.js";
import httpStatus from "http-status";
import bcrypt from "bcrypt";
import { createToken } from "../utils/token.js";
import {
  cleanName,
  normalizeUsername,
  validateName,
  validatePassword,
  validateUsername,
  MEETING_CODE_RE,
} from "../utils/validation.js";

const publicUser = (u) => ({ name: u.name, username: u.username });

const login = async (req, res) => {
  const username = normalizeUsername(req.body?.username);
  const password = req.body?.password;

  if (!username || typeof password !== "string" || !password) {
    return res
      .status(httpStatus.BAD_REQUEST)
      .json({ message: "Please provide username and password" });
  }

  try {
    // The raw value is also tried so accounts created before usernames were
    // lower-cased can still log in.
    const rawUsername = String(req.body.username).trim();
    let user = await User.findOne({
      username: { $in: [username, rawUsername] },
    });
    if (!user && /^[A-Za-z0-9_]{1,40}$/.test(rawUsername)) {
      // old account stored with different capitalisation than what was typed
      user = await User.findOne({
        username: { $regex: `^${rawUsername}$`, $options: "i" },
      });
    }

    // Same message for "no such user" and "wrong password" so the endpoint
    // can't be used to discover which usernames exist.
    const ok = user ? await bcrypt.compare(password, user.password) : false;
    if (!ok) {
      return res
        .status(httpStatus.UNAUTHORIZED)
        .json({ message: "Invalid username or password" });
    }

    const { token, hash, expires } = createToken();
    user.token = hash;
    user.tokenExpires = expires;
    await user.save();

    return res
      .status(httpStatus.OK)
      .json({ token, user: publicUser(user) });
  } catch (e) {
    console.error("login error:", e.message);
    return res
      .status(httpStatus.INTERNAL_SERVER_ERROR)
      .json({ message: "Something went wrong. Please try again." });
  }
};

const register = async (req, res) => {
  const name = cleanName(req.body?.name);
  const username = normalizeUsername(req.body?.username);
  const password = req.body?.password;

  const problem =
    validateName(name) || validateUsername(username) || validatePassword(password);
  if (problem) {
    return res.status(httpStatus.BAD_REQUEST).json({ message: problem });
  }

  try {
    // Case-insensitive check (username is [a-z0-9_] so it's safe in a regex)
    const existingUser = await User.findOne({
      username: { $regex: `^${username}$`, $options: "i" },
    });
    if (existingUser) {
      return res
        .status(httpStatus.CONFLICT)
        .json({ message: "That username is already taken" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    await new User({ name, username, password: hashedPassword }).save();

    res.status(httpStatus.CREATED).json({ message: "User Registered" });
  } catch (e) {
    // Two simultaneous registrations: the unique index decides the winner.
    if (e.code === 11000) {
      return res
        .status(httpStatus.CONFLICT)
        .json({ message: "That username is already taken" });
    }
    console.error("register error:", e.message);
    res
      .status(httpStatus.INTERNAL_SERVER_ERROR)
      .json({ message: "Something went wrong. Please try again." });
  }
};

const logout = async (req, res) => {
  req.user.token = undefined;
  req.user.tokenExpires = undefined;
  await req.user.save();
  res.json({ message: "Logged out" });
};

const getMe = async (req, res) => {
  res.json(publicUser(req.user));
};

const updateMe = async (req, res) => {
  const name = cleanName(req.body?.name);
  const problem = validateName(name);
  if (problem) return res.status(httpStatus.BAD_REQUEST).json({ message: problem });
  req.user.name = name;
  await req.user.save();
  res.json(publicUser(req.user));
};

const changePassword = async (req, res) => {
  const { currentPassword, newPassword } = req.body || {};
  if (typeof currentPassword !== "string" || !currentPassword) {
    return res
      .status(httpStatus.BAD_REQUEST)
      .json({ message: "Please enter your current password" });
  }
  const problem = validatePassword(newPassword);
  if (problem) return res.status(httpStatus.BAD_REQUEST).json({ message: problem });

  const ok = await bcrypt.compare(currentPassword, req.user.password);
  if (!ok) {
    return res
      .status(httpStatus.FORBIDDEN)
      .json({ message: "Current password is incorrect" });
  }
  req.user.password = await bcrypt.hash(newPassword, 10);
  await req.user.save();
  res.json({ message: "Password updated" });
};

/* ---------- meeting history ---------- */

const addToActivity = async (req, res) => {
  const code = String(req.body?.meeting_code ?? "").trim().toLowerCase();
  if (!MEETING_CODE_RE.test(code)) {
    return res
      .status(httpStatus.BAD_REQUEST)
      .json({ message: "Invalid meeting code" });
  }
  // user_id always comes from the verified token, never from the client
  await Meeting.create({ user_id: String(req.user._id), meeting_code: code });
  res.status(httpStatus.CREATED).json({ message: "Added code to history" });
};

const getAllActivity = async (req, res) => {
  const rows = await Meeting.find({ user_id: String(req.user._id) })
    .sort({ date: -1 })
    .limit(100)
    .lean();
  // meetingCode is kept as an alias for the old History page
  res.json(
    rows.map((m) => ({
      meeting_code: m.meeting_code,
      meetingCode: m.meeting_code,
      date: m.date,
    })),
  );
};

/* ---------- contacts ---------- */

const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const getContacts = async (req, res) => {
  const me = await User.findById(req.user._id).populate("contacts", "name username");
  res.json(me.contacts.map(publicUser));
};

const searchUsers = async (req, res) => {
  const q = normalizeUsername(req.query?.q);
  if (!/^[a-z0-9_]{2,20}$/.test(q)) return res.json([]);

  const users = await User.find({
    username: { $regex: `^${escapeRegex(q)}`, $options: "i" },
    _id: { $ne: req.user._id },
  })
    .select("name username")
    .limit(10);

  const mine = new Set(req.user.contacts.map(String));
  res.json(
    users.map((u) => ({ ...publicUser(u), isContact: mine.has(String(u._id)) })),
  );
};

const addContact = async (req, res) => {
  const username = normalizeUsername(req.body?.username);
  const target = await User.findOne({ username });
  if (!target) {
    return res.status(httpStatus.NOT_FOUND).json({ message: "User not found" });
  }
  if (String(target._id) === String(req.user._id)) {
    return res
      .status(httpStatus.BAD_REQUEST)
      .json({ message: "You can't add yourself as a contact" });
  }
  // $addToSet makes duplicates impossible even with parallel requests
  const result = await User.updateOne(
    { _id: req.user._id },
    { $addToSet: { contacts: target._id } },
  );
  if (result.modifiedCount === 0) {
    return res
      .status(httpStatus.CONFLICT)
      .json({ message: "Already in your contacts" });
  }
  res.status(httpStatus.CREATED).json(publicUser(target));
};

const removeContact = async (req, res) => {
  const username = normalizeUsername(req.params.username);
  const target = await User.findOne({ username });
  if (target) {
    // only ever touches the logged-in user's own list
    await User.updateOne({ _id: req.user._id }, { $pull: { contacts: target._id } });
  }
  res.json({ message: "Contact removed" });
};

export {
  login,
  register,
  logout,
  getMe,
  updateMe,
  changePassword,
  addToActivity,
  getAllActivity,
  getContacts,
  searchUsers,
  addContact,
  removeContact,
};
