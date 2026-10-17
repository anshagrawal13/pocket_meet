import httpStatus from "http-status";
import { Room } from "../models/room.model.js";
import { generateMeetingCode, MEETING_CODE_RE } from "../utils/validation.js";

export const createMeeting = async (req, res) => {
  // Retry in the (astronomically unlikely) case of a code collision;
  // the unique index guarantees we never reuse a code.
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = generateMeetingCode();
    try {
      await Room.create({ code, host: req.user._id });
      return res.status(httpStatus.CREATED).json({ code });
    } catch (e) {
      if (e.code !== 11000) throw e;
    }
  }
  res
    .status(httpStatus.INTERNAL_SERVER_ERROR)
    .json({ message: "Could not create a meeting. Please try again." });
};

export const getMeeting = async (req, res) => {
  const code = String(req.params.code ?? "").trim().toLowerCase();
  if (!MEETING_CODE_RE.test(code)) {
    return res
      .status(httpStatus.BAD_REQUEST)
      .json({ message: "That doesn't look like a valid meeting code" });
  }
  const room = await Room.findOne({ code }).populate("host", "name");
  if (!room) {
    return res
      .status(httpStatus.NOT_FOUND)
      .json({ message: "Meeting not found. Check the code and try again." });
  }
  if (room.endedAt) {
    return res
      .status(httpStatus.GONE)
      .json({ message: "This meeting has ended." });
  }
  res.json({ code, host: room.host?.name ?? null });
};
