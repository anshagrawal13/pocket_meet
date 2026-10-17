# Pocket Meet

Real-time video meetings in the browser. Multi-party WebRTC calls, screen sharing, live chat, contacts and instant invites, built from scratch on the MERN stack with a custom Socket.IO signalling server.

**React 19 + Vite** | **Node + Express 5** | **Socket.IO** | **MongoDB + Mongoose** | **WebRTC**

---

## What it can do

**Calls**

- Multi-party video and audio over a peer-to-peer WebRTC mesh, signalled through Socket.IO
- Screen sharing, including the browser's own "Stop sharing" button, with a Presenting badge for everyone else
- Active speaker highlight, detected from live audio levels with the Web Audio API
- Responsive video grid that adapts from one participant to many, on desktop and on phones
- Avatar with initials when a camera is off, and mic, camera and screen-share state synced to everyone
- Join with the camera or microphone blocked or missing; the call still works

**Reliability**

- Handles two people sending WebRTC offers at the same time (glare) so exactly one wins
- Restarts ICE when a connection fails, and rejoins automatically after a network drop
- Cleans up peers, streams, tracks and listeners on leave, refresh and disconnect, with no duplicate events

**Meetings and people**

- One-click meeting creation with unguessable codes like `abc-defg-hij`, shareable as a link
- Guests join with just a name; logged-in users appear under their real name, set by the server so it cannot be spoofed
- Host can end the meeting for everyone
- In-meeting chat with server-stamped sender and time, history for late joiners, and an unread badge
- Participants panel showing host, guests and live mic and camera status
- Contacts: search users, save and remove contacts, press Meet to start a meeting and send a live invite to contacts who are online
- Meeting history with one-click rejoin, and a profile page to change your name and password

**Security**

- Passwords hashed with bcrypt, login tokens stored hashed and expiring after 30 days
- Login and register rate limited, and all input validated on the server as well as in React
- Socket events checked for meeting membership; chat sender and display names come from the server, never from the client
- Unique database indexes on usernames and meeting codes, and a CORS allow-list for production

---

## How it works

```
Browser A  <------ WebRTC media (audio / video / screen) ------>  Browser B
    |                                                                 |
    +----------------- Socket.IO signalling and chat -----------------+
                                  |
                          Express + Socket.IO
                                  |
                               MongoDB
```

The server never touches the media. It only relays signalling messages between people in the same meeting, keeps the participant list and chat history, and stores accounts, contacts, meetings and history in MongoDB.

Meetings use a mesh (every person connects to every other person), which works well for small groups. Very large meetings would need a media server.

---

## Run it

**Backend**

```bash
cd backend
cp .env.example .env     # then edit if needed (Mongo URL, allowed frontend origin)
npm install
npm run dev              # http://localhost:8000
```

**Frontend**

```bash
cd frontend
npm install
npm run dev              # http://localhost:5173  (talks to localhost:8000 in dev)
```

`npm run build` talks to your Render backend by default; set `VITE_API_URL` in `frontend/.env` to change it.

Browsers only allow camera and microphone access on `localhost` or over HTTPS, so a deployed site must use HTTPS.

## Environment variables

| File          | Variable                                                      | Purpose                                                                                |
| ------------- | ------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| backend/.env  | `MONGODB_URI`                                                 | Mongo connection (default `mongodb://127.0.0.1:27017/zoom`)                            |
| backend/.env  | `CLIENT_ORIGIN`                                               | Comma separated frontend URLs allowed by CORS / Socket.IO. **Set this in production.** |
| backend/.env  | `PORT`                                                        | default 8000                                                                           |
| frontend/.env | `VITE_API_URL`                                                | backend URL override                                                                   |
| frontend/.env | `VITE_TURN_URL`, `VITE_TURN_USERNAME`, `VITE_TURN_CREDENTIAL` | optional TURN server for strict networks                                               |

Without a TURN server, some calls can fail on mobile data and strict firewalls.

## Database notes (no destructive changes)

- Existing users and history are kept. New `rooms` collection holds created meetings; `users` gets `tokenExpires` and `contacts` fields.
- Login tokens are now stored hashed, so everyone is logged out once and simply logs in again.
- New usernames are lower-case `[a-z0-9_]{3,20}`. Old accounts with other characters/capitals can still log in; they just can't be re-registered.
- Old meeting codes like `aljk23` are not valid any more - meetings must be created from the dashboard (codes look like `abc-defg-hij`).

## API (all under /api/v1)

`users`: `POST /register`, `POST /login`, `POST /logout`, `GET|PUT /me`, `PUT /me/password`, `POST /add_to_activity`, `GET /get_all_activity`, `GET /search?q=`, `GET|POST /contacts`, `DELETE /contacts/:username`

`meetings`: `POST /` (login required), `GET /:code`

Socket events (names kept): `join-call(code, {name,audio,video}, ack)`, `user-joined`, `user-left`, `signal`, `chat-message`. New: `participants`, `media-state`, `leave-call`, `end-meeting`, `meeting-ended`, `invite-contact`, `meeting-invite`.
