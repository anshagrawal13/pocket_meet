import io from "socket.io-client";
import server from "../environment";

// One lightweight socket per logged-in tab: receives meeting invitations from
// contacts and lets us send them. (The meeting room uses its own socket.)
let socket = null;

export const connectInviteSocket = () => {
  const token = localStorage.getItem("token");
  if (!token) return null;
  if (!socket) socket = io(server, { auth: { token } });
  return socket;
};

export const getInviteSocket = () => socket;

export const disconnectInviteSocket = () => {
  socket?.disconnect();
  socket = null;
};
