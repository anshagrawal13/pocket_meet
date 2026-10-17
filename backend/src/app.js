import express from "express";
import { createServer } from "node:http";
import { connectToSocket } from "./controllers/socketManager.js";
import cors from "cors";
import mongoose from "mongoose";
import userRoutes from "./routes/users.routes.js";
import meetingRoutes from "./routes/meetings.routes.js";

// Load backend/.env if it exists (Node 22+). Never overwrites real env vars.
try {
  process.loadEnvFile?.();
} catch {
  /* no .env file - fine, use defaults / real environment */
}

const MONGODB_URI = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/zoom";
// Comma separated list, e.g. "https://myapp.vercel.app,http://localhost:5173".
// If unset, every origin is allowed (OK for development only).
const allowedOrigins = (process.env.CLIENT_ORIGIN || "")
  .split(",")
  .map((o) => o.trim())
  .filter(Boolean);
if (allowedOrigins.length === 0) {
  console.warn("CLIENT_ORIGIN is not set - allowing requests from any origin.");
}
const corsOrigin = allowedOrigins.length ? allowedOrigins : true;

const app = express();
const server = createServer(app);
connectToSocket(server, corsOrigin);

app.set("port", process.env.PORT || 8000);
app.set("trust proxy", 1); // correct client IPs behind Render / nginx
app.use(cors({ origin: corsOrigin }));
app.use(express.json({ limit: "40kb" }));
app.use(express.urlencoded({ limit: "40kb", extended: true }));

app.get("/", (req, res) => {
  res.send("hyy");
});

app.use("/api/v1/users", userRoutes);
app.use("/api/v1/meetings", meetingRoutes);

app.use((req, res) => {
  res.status(404).json({ message: "Not found" });
});

// Express 5 forwards rejected async handlers here
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  if (err.type === "entity.parse.failed") {
    return res.status(400).json({ message: "Invalid JSON body" });
  }
  console.error("Unhandled error:", err.message);
  res.status(500).json({ message: "Something went wrong" });
});

const start = async () => {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log("DB Connected");
    server.listen(app.get("port"), () => {
      console.log(`Port is listening on ${app.get("port")}`);
    });
  } catch (e) {
    console.error(`Startup error: ${e.message}`);
    process.exit(1);
  }
};

if (!process.env.NO_AUTOSTART) start();

export { app, server };
