# Apna Video Call

Video meeting app: React (Vite) + Express + Socket.IO + MongoDB + WebRTC.

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

## Environment variables

| File | Variable | Purpose |
|---|---|---|
| backend/.env | `MONGODB_URI` | Mongo connection (default `mongodb://127.0.0.1:27017/zoom`) |
| backend/.env | `CLIENT_ORIGIN` | Comma separated frontend URLs allowed by CORS / Socket.IO. **Set this in production.** |
| backend/.env | `PORT` | default 8000 |
| frontend/.env | `VITE_API_URL` | backend URL override |
| frontend/.env | `VITE_TURN_URL`, `VITE_TURN_USERNAME`, `VITE_TURN_CREDENTIAL` | optional TURN server for strict networks |

## Database notes (no destructive changes)
* Existing users and history are kept. New `rooms` collection holds created meetings; `users` gets `tokenExpires` and `contacts` fields.
* Login tokens are now stored hashed, so everyone is logged out once and simply logs in again.
* New usernames are lower-case `[a-z0-9_]{3,20}`. Old accounts with other characters/capitals can still log in; they just can't be re-registered.
* Old meeting codes like `aljk23` are not valid any more - meetings must be created from the dashboard (codes look like `abc-defg-hij`).

## API (all under /api/v1)
`users`: `POST /register`, `POST /login`, `POST /logout`, `GET|PUT /me`, `PUT /me/password`, `POST /add_to_activity`, `GET /get_all_activity`, `GET /search?q=`, `GET|POST /contacts`, `DELETE /contacts/:username`
`meetings`: `POST /` (login required), `GET /:code`

Socket events (names kept): `join-call(code, {name,audio,video}, ack)`, `user-joined`, `user-left`, `signal`, `chat-message`. New: `participants`, `media-state`, `leave-call`, `end-meeting`, `meeting-ended`, `invite-contact`, `meeting-invite`.
