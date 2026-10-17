import { Router } from "express";
import {
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
} from "../controllers/user.controllers.js";
import { requireAuth } from "../middleware/auth.js";
import { rateLimit } from "../middleware/rateLimit.js";

const router = Router();

// 10 attempts per 15 minutes per IP + username
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  keyFn: (req) => `${req.ip}:${String(req.body?.username ?? "").toLowerCase()}`,
});

router.route("/login").post(authLimiter, login);
router.route("/register").post(authLimiter, register);
router.route("/logout").post(requireAuth, logout);

router.route("/me").get(requireAuth, getMe).put(requireAuth, updateMe);
router.route("/me/password").put(requireAuth, changePassword);

router.route("/add_to_activity").post(requireAuth, addToActivity);
router.route("/get_all_activity").get(requireAuth, getAllActivity);

router.route("/search").get(requireAuth, searchUsers);
router
  .route("/contacts")
  .get(requireAuth, getContacts)
  .post(requireAuth, addContact);
router.route("/contacts/:username").delete(requireAuth, removeContact);

export default router;
