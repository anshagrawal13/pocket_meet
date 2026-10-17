import { Router } from "express";
import { createMeeting, getMeeting } from "../controllers/meeting.controllers.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();

router.route("/").post(requireAuth, createMeeting);
// public on purpose: guests need to check a code before joining
router.route("/:code").get(getMeeting);

export default router;
