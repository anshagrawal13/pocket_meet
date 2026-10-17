import { Server } from "socket.io";
import { Room } from "../models/room.model.js";
import { User } from "../models/user.model.js";
import { findUserByToken } from "../utils/token.js";
import { cleanName, MEETING_CODE_RE } from "../utils/validation.js";

// rooms: meeting code -> { hostId, participants: Map(socketId -> participant), messages: [] }
// Only the server decides who is in which room and what their name is.
const rooms = new Map();
// userId -> Set(socketId): used to deliver meeting invitations
const userSockets = new Map();

const MAX_MESSAGE_LENGTH = 1000;
const MAX_HISTORY = 200;
const MAX_SIGNAL_SIZE = 20000;

export const connectToSocket = (server, corsOrigin = true) => {
  const io = new Server(server, {
    cors: {
      origin: corsOrigin,
      methods: ["GET", "POST"],
    },
  });

  // Logged-in users pass their token in the handshake. No/invalid token =
  // guest. The identity is stored server-side on the socket from here on.
  io.use(async (socket, next) => {
    try {
      const user = await findUserByToken(socket.handshake.auth?.token);
      if (user) {
        socket.data.user = {
          id: String(user._id),
          username: user.username,
          name: user.name,
        };
      }
    } catch (e) {
      console.error("socket auth error:", e.message);
    }
    next();
  });

  const publicParticipants = (room) =>
    [...room.participants.values()].map((p) => ({
      id: p.id,
      name: p.name,
      username: p.username,
      isGuest: p.isGuest,
      isHost: Boolean(p.userId && p.userId === room.hostId),
      audio: p.audio,
      video: p.video,
      screen: p.screen,
    }));

  const broadcastParticipants = (code) => {
    const room = rooms.get(code);
    if (room) io.to(code).emit("participants", publicParticipants(room));
  };

  const leaveRoom = (socket) => {
    const code = socket.data.room;
    if (!code) return;
    socket.data.room = null;
    socket.leave(code);

    const room = rooms.get(code);
    if (!room) return;
    room.participants.delete(socket.id);

    if (room.participants.size === 0) {
      rooms.delete(code); // empty meeting: free chat history and state
      return;
    }
    io.to(code).emit("user-left", socket.id);
    broadcastParticipants(code);
  };

  io.on("connection", (socket) => {
    const authUser = socket.data.user;
    if (authUser) {
      if (!userSockets.has(authUser.id)) userSockets.set(authUser.id, new Set());
      userSockets.get(authUser.id).add(socket.id);
    }

    socket.on("join-call", async (code, options, ack) => {
      const reply = typeof ack === "function" ? ack : () => {};
      try {
        if (socket.data.room) return reply({ ok: true, alreadyJoined: true });

        code = String(code ?? "").trim().toLowerCase();
        if (!MEETING_CODE_RE.test(code)) {
          return reply({ ok: false, error: "Invalid meeting code" });
        }
        const doc = await Room.findOne({ code });
        if (!doc) return reply({ ok: false, error: "Meeting not found" });
        if (doc.endedAt) {
          return reply({ ok: false, error: "This meeting has ended", ended: true });
        }
        // the socket may have joined while we were waiting for the database
        if (socket.data.room) return reply({ ok: true, alreadyJoined: true });

        let name;
        let username = null;
        let userId = null;
        if (authUser) {
          name = authUser.name; // never taken from the client
          username = authUser.username;
          userId = authUser.id;
        } else {
          name = cleanName(options?.name, 30);
          if (name.length < 2) {
            return reply({ ok: false, error: "Please enter a name (2-30 characters)" });
          }
        }

        let room = rooms.get(code);
        if (!room) {
          room = { hostId: String(doc.host), participants: new Map(), messages: [] };
          rooms.set(code, room);
        }

        const participant = {
          id: socket.id,
          name,
          username,
          userId,
          isGuest: !authUser,
          audio: options?.audio !== false,
          video: options?.video !== false,
          screen: false,
        };
        room.participants.set(socket.id, participant);
        socket.join(code);
        socket.data.room = code;

        reply({
          ok: true,
          you: { id: socket.id, name, username, isGuest: !authUser },
          isHost: Boolean(userId && userId === room.hostId),
        });

        // Existing events kept: everyone gets the full list of socket ids,
        // the newcomer then sends offers to the others.
        io.to(code).emit("user-joined", socket.id, [...room.participants.keys()]);
        broadcastParticipants(code);

        // replay chat history to the newcomer only
        for (const m of room.messages) {
          socket.emit("chat-message", m.data, m.sender, m.socketId, m.ts, m.id);
        }
      } catch (e) {
        console.error("join-call error:", e.message);
        reply({ ok: false, error: "Could not join the meeting" });
      }
    });

    socket.on("signal", (toId, message) => {
      const room = rooms.get(socket.data.room);
      // only relay between people who are in the same meeting
      if (!room || !room.participants.has(toId)) return;
      if (typeof message !== "string" || message.length > MAX_SIGNAL_SIZE) return;
      io.to(toId).emit("signal", socket.id, message);
    });

    socket.on("chat-message", (data) => {
      const code = socket.data.room;
      const room = rooms.get(code);
      const me = room?.participants.get(socket.id);
      if (!me) return; // not a member of any meeting

      const text = typeof data === "string" ? data.trim() : "";
      if (!text || text.length > MAX_MESSAGE_LENGTH) return;

      const message = {
        id: (room.messages.at(-1)?.id ?? 0) + 1,
        data: text,
        sender: me.name, // the client's idea of its own name is ignored
        socketId: socket.id,
        ts: new Date().toISOString(),
      };
      room.messages.push(message);
      if (room.messages.length > MAX_HISTORY) room.messages.shift();

      io.to(code).emit(
        "chat-message",
        message.data,
        message.sender,
        message.socketId,
        message.ts,
        message.id,
      );
    });

    // mic / camera / screen-share state so other people can show the right UI
    socket.on("media-state", (state) => {
      const me = rooms.get(socket.data.room)?.participants.get(socket.id);
      if (!me || typeof state !== "object" || state === null) return;
      if (typeof state.audio === "boolean") me.audio = state.audio;
      if (typeof state.video === "boolean") me.video = state.video;
      if (typeof state.screen === "boolean") me.screen = state.screen;
      broadcastParticipants(socket.data.room);
    });

    socket.on("end-meeting", async (ack) => {
      const reply = typeof ack === "function" ? ack : () => {};
      try {
        const code = socket.data.room;
        const room = rooms.get(code);
        if (!room || !authUser || authUser.id !== room.hostId) {
          return reply({ ok: false, error: "Only the host can end the meeting" });
        }
        await Room.updateOne({ code }, { endedAt: new Date() });
        io.to(code).emit("meeting-ended");
        for (const id of [...room.participants.keys()]) {
          const s = io.sockets.sockets.get(id);
          if (s) {
            s.leave(code);
            s.data.room = null;
          }
        }
        rooms.delete(code);
        reply({ ok: true });
      } catch (e) {
        console.error("end-meeting error:", e.message);
        reply({ ok: false, error: "Could not end the meeting" });
      }
    });

    socket.on("leave-call", () => leaveRoom(socket));

    // Ask a saved contact to join a meeting you're in / created.
    socket.on("invite-contact", async (username, code, ack) => {
      const reply = typeof ack === "function" ? ack : () => {};
      try {
        if (!authUser) return reply({ ok: false, error: "Log in to invite contacts" });
        code = String(code ?? "").trim().toLowerCase();
        if (!MEETING_CODE_RE.test(code)) return reply({ ok: false, error: "Invalid meeting code" });

        const me = await User.findById(authUser.id).populate("contacts", "username");
        const target = me?.contacts.find((c) => c.username === String(username));
        if (!target) return reply({ ok: false, error: "That user isn't in your contacts" });

        const doc = await Room.findOne({ code });
        if (!doc || doc.endedAt) return reply({ ok: false, error: "Meeting not available" });

        const sockets = userSockets.get(String(target._id));
        sockets?.forEach((id) =>
          io.to(id).emit("meeting-invite", { code, from: authUser.name }),
        );
        reply({ ok: true, delivered: Boolean(sockets?.size) });
      } catch (e) {
        console.error("invite error:", e.message);
        reply({ ok: false, error: "Could not send invite" });
      }
    });

    socket.on("disconnect", () => {
      leaveRoom(socket);
      if (authUser) {
        const set = userSockets.get(authUser.id);
        set?.delete(socket.id);
        if (set?.size === 0) userSockets.delete(authUser.id);
      }
    });
  });

  return io;
};
