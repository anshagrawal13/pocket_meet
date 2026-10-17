import {
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { useNavigate, useParams } from "react-router-dom";
import io from "socket.io-client";
import {
  Alert,
  Badge,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  IconButton,
  Snackbar,
  TextField,
  Tooltip,
} from "@mui/material";
import VideocamIcon from "@mui/icons-material/Videocam";
import VideocamOffIcon from "@mui/icons-material/VideocamOff";
import CallEndIcon from "@mui/icons-material/CallEnd";
import MicIcon from "@mui/icons-material/Mic";
import MicOffIcon from "@mui/icons-material/MicOff";
import ScreenShareIcon from "@mui/icons-material/ScreenShare";
import StopScreenShareIcon from "@mui/icons-material/StopScreenShare";
import ChatIcon from "@mui/icons-material/Chat";
import PeopleAltIcon from "@mui/icons-material/PeopleAlt";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import CloseIcon from "@mui/icons-material/Close";
import SendIcon from "@mui/icons-material/Send";
import styles from "../styles/videoComponent.module.css";
import server from "../environment";
import { AuthContext } from "../contexts/AuthContext";
import { errorMessage, initials } from "../utils/validation";

const server_url = server;

// STUN works for most networks. Add a TURN server (see frontend/.env.example)
// so calls also work behind strict firewalls and some mobile networks.
const iceServers = [{ urls: "stun:stun.l.google.com:19302" }];
if (import.meta.env.VITE_TURN_URL) {
  iceServers.push({
    urls: import.meta.env.VITE_TURN_URL,
    username: import.meta.env.VITE_TURN_USERNAME,
    credential: import.meta.env.VITE_TURN_CREDENTIAL,
  });
}
const peerConfigConnections = { iceServers };

const colsFor = (n) => (n <= 1 ? 1 : n <= 4 ? 2 : n <= 9 ? 3 : 4);
const colsForMobile = (n) => (n <= 2 ? 1 : 2);

const AVATAR_COLORS = ["#2563eb", "#7c3aed", "#db2777", "#ea580c", "#16a34a", "#0891b2"];
const colorFor = (name = "") =>
  AVATAR_COLORS[[...name].reduce((a, c) => a + c.charCodeAt(0), 0) % AVATAR_COLORS.length];

const formatTime = (ts) =>
  ts ? new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "";

/* Plays a MediaStream. Always mounted for remote people so their audio keeps
   playing even while their camera is off (the video is just hidden). */
function VideoSurface({ stream, muted = false, mirror = false, fit = "cover", hidden = false }) {
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current;
    if (el && el.srcObject !== stream) {
      el.srcObject = stream || null;
    }
    el?.play?.().catch(() => {});
  }, [stream]);
  return (
    <video
      ref={ref}
      autoPlay
      playsInline
      muted={muted}
      className={`${styles.video} ${hidden ? styles.videoHidden : ""}`}
      style={{ objectFit: fit, transform: mirror ? "scaleX(-1)" : undefined }}
    />
  );
}

function Tile({ name, stream, showVideo, muted, isLocal, audioOn, speaking, presenting, host, mirror }) {
  return (
    <div className={`${styles.tile} ${speaking ? styles.speaking : ""}`}>
      <VideoSurface
        stream={stream}
        muted={isLocal || muted}
        mirror={mirror}
        fit={presenting ? "contain" : "cover"}
        hidden={!showVideo}
      />
      {!showVideo && (
        <div className={styles.avatarWrap}>
          <div className={styles.avatar} style={{ background: colorFor(name) }}>
            {initials(name)}
          </div>
        </div>
      )}
      <div className={styles.nameTag}>
        {!audioOn && <MicOffIcon sx={{ fontSize: 16 }} />}
        <span>
          {name}
          {isLocal ? " (You)" : ""}
        </span>
        {host && <span className={styles.badge}>Host</span>}
        {presenting && <span className={styles.badge}>Presenting</span>}
      </div>
    </div>
  );
}

function ControlButton({ label, onClick, icon, off, danger, badge, active }) {
  return (
    <Tooltip title={label} describeChild>
      <span>
        <IconButton
          onClick={onClick}
          aria-label={label}
          aria-pressed={active}
          className={`${styles.ctrl} ${off ? styles.ctrlOff : ""} ${danger ? styles.ctrlDanger : ""} ${active ? styles.ctrlActive : ""}`}
        >
          <Badge badgeContent={badge} max={99} color="warning">
            {icon}
          </Badge>
        </IconButton>
      </span>
    </Tooltip>
  );
}

/* Highlights whoever is talking by measuring audio levels (Web Audio). It is
   best effort: if the browser can't do it, nobody is highlighted. */
function useActiveSpeaker(streams) {
  const [active, setActive] = useState(null);
  const key = Object.entries(streams)
    .map(([id, s]) => `${id}:${s.getAudioTracks().map((t) => t.id).join(",")}`)
    .join("|");

  useEffect(() => {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx || !key) return undefined;
    let ctx;
    const nodes = [];
    try {
      ctx = new Ctx();
      Object.entries(streams).forEach(([id, stream]) => {
        const audioTracks = stream.getAudioTracks();
        if (!audioTracks.length) return;
        const source = ctx.createMediaStreamSource(new MediaStream(audioTracks));
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 512;
        source.connect(analyser);
        nodes.push({ id, source, analyser, data: new Uint8Array(analyser.fftSize) });
      });
    } catch (error) {
      console.warn("Active speaker detection unavailable:", error);
    }

    const timer = setInterval(() => {
      let best = null;
      let bestLevel = 0.03;
      for (const n of nodes) {
        n.analyser.getByteTimeDomainData(n.data);
        let sum = 0;
        for (const v of n.data) {
          const x = (v - 128) / 128;
          sum += x * x;
        }
        const rms = Math.sqrt(sum / n.data.length);
        if (rms > bestLevel) {
          bestLevel = rms;
          best = n.id;
        }
      }
      setActive((prev) => (prev === best ? prev : best));
    }, 300);

    return () => {
      clearInterval(timer);
      nodes.forEach((n) => {
        try {
          n.source.disconnect();
        } catch {
          /* already disconnected */
        }
      });
      ctx?.close?.().catch(() => {});
      setActive(null);
    };
    // `key` changes whenever the set of audio tracks changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return active;
}

export default function VideoMeetComponent() {
  const { url } = useParams();
  const code = String(url || "").toLowerCase();
  const navigate = useNavigate();
  const { getMeeting, getMe, addToUserHistory, userData } = useContext(AuthContext);
  const me = userData; // logged-in user (name comes from the server, not from the browser)

  const socketRef = useRef(null);
  const socketIdRef = useRef(null);
  const connections = useRef({});
  const localStreamRef = useRef(null);
  const screenStreamRef = useRef(null);
  const remoteStreamsRef = useRef({});
  const iceCandidatesRef = useRef({});
  const makingOfferRef = useRef({});
  const acquireIdRef = useRef(0);
  const hasJoinedRef = useRef(false);
  const seenMessagesRef = useRef(new Set());
  const audioOnRef = useRef(true);
  const videoOnRef = useRef(true);
  const screenOnRef = useRef(false);
  const guestNameRef = useRef("");
  const panelRef = useRef(null);
  const chatEndRef = useRef(null);

  const [status, setStatus] = useState("checking"); // checking | invalid | ended | lobby | joining | joined
  const [statusMessage, setStatusMessage] = useState("");
  const [guestName, setGuestName] = useState(() => {
    try {
      return localStorage.getItem("guestName") || "";
    } catch {
      return "";
    }
  });
  const [joinError, setJoinError] = useState("");
  const [localStream, setLocalStream] = useState(null);
  const [screenStream, setScreenStream] = useState(null);
  const [mediaNotices, setMediaNotices] = useState([]);
  const [video, setVideo] = useState(true);
  const [audio, setAudio] = useState(true);
  const [screen, setScreen] = useState(false);
  const [screenAvailable] = useState(() => Boolean(navigator.mediaDevices?.getDisplayMedia));
  const [remoteStreams, setRemoteStreams] = useState({});
  const [participants, setParticipants] = useState([]);
  const [myId, setMyId] = useState(null);
  const [isHost, setIsHost] = useState(false);
  const [connection, setConnection] = useState("ok"); // ok | reconnecting
  const [panel, setPanel] = useState(null); // null | chat | people
  const [messages, setMessages] = useState([]);
  const [message, setMessage] = useState("");
  const [unread, setUnread] = useState(0);
  const [confirmEnd, setConfirmEnd] = useState(false);
  const [toast, setToast] = useState("");

  /* ------------------------------------------------------------------ */
  /* WebRTC plumbing                                                     */
  /* ------------------------------------------------------------------ */

  const updateRemoteStream = useCallback((socketId, stream) => {
    // new object every time so the UI re-renders when a track is added
    setRemoteStreams((current) => ({ ...current, [socketId]: stream }));
  }, []);

  const removePeer = useCallback((socketId) => {
    const peer = connections.current[socketId];
    if (peer) {
      peer.onicecandidate = null;
      peer.ontrack = null;
      peer.onconnectionstatechange = null;
      peer.close();
      delete connections.current[socketId];
    }
    delete iceCandidatesRef.current[socketId];
    delete makingOfferRef.current[socketId];
    delete remoteStreamsRef.current[socketId];
    setRemoteStreams((current) => {
      if (!(socketId in current)) return current;
      const rest = { ...current };
      delete rest[socketId];
      return rest;
    });
  }, []);

  const sendSignal = useCallback((toId, payload) => {
    if (socketRef.current?.connected) {
      socketRef.current.emit("signal", toId, JSON.stringify(payload));
    }
  }, []);

  const makeOffer = useCallback(
    async (socketId, options) => {
      const peer = connections.current[socketId];
      if (!peer || peer.signalingState !== "stable" || makingOfferRef.current[socketId]) return;
      try {
        makingOfferRef.current[socketId] = true;
        const offer = await peer.createOffer(options);
        if (peer.signalingState !== "stable") return;
        await peer.setLocalDescription(offer);
        sendSignal(socketId, { sdp: peer.localDescription });
      } catch (error) {
        console.error("Could not create WebRTC offer:", error);
      } finally {
        makingOfferRef.current[socketId] = false;
      }
    },
    [sendSignal],
  );

  const createPeerConnection = useCallback(
    (socketId) => {
      if (!socketId || socketId === socketIdRef.current) return null;
      if (connections.current[socketId]) return connections.current[socketId];

      const peer = new RTCPeerConnection(peerConfigConnections);
      connections.current[socketId] = peer;
      iceCandidatesRef.current[socketId] = [];

      // Every peer always has one audio and one video "slot". If we have no
      // camera/mic yet, the slot is empty but still there, so a track added
      // later (replaceTrack) needs no renegotiation and we can still receive.
      const cameraStream = localStreamRef.current;
      for (const kind of ["audio", "video"]) {
        const screenTrack = kind === "video" ? screenStreamRef.current?.getVideoTracks()[0] : null;
        const track =
          screenTrack ||
          cameraStream?.getTracks().find((t) => t.kind === kind && t.readyState === "live");
        if (track) {
          peer.addTrack(track, screenTrack ? screenStreamRef.current : cameraStream);
        } else {
          peer.addTransceiver(kind, { direction: "sendrecv" });
        }
      }

      peer.onicecandidate = (event) => {
        if (event.candidate) sendSignal(socketId, { ice: event.candidate });
      };

      peer.ontrack = (event) => {
        // One stream per remote person; we add tracks ourselves because a
        // track that was swapped in later has no stream attached.
        let stream = remoteStreamsRef.current[socketId];
        if (!stream) {
          stream = new MediaStream();
          remoteStreamsRef.current[socketId] = stream;
        }
        if (!stream.getTracks().includes(event.track)) stream.addTrack(event.track);
        updateRemoteStream(socketId, stream);
      };

      peer.onconnectionstatechange = () => {
        if (peer.connectionState === "failed") {
          // try once to re-establish the media path before giving up
          makeOffer(socketId, { iceRestart: true });
        } else if (peer.connectionState === "closed") {
          removePeer(socketId);
        }
      };

      return peer;
    },
    [makeOffer, removePeer, sendSignal, updateRemoteStream],
  );

  const addQueuedIceCandidates = useCallback(async (socketId, peer) => {
    const queued = iceCandidatesRef.current[socketId] || [];
    iceCandidatesRef.current[socketId] = [];
    for (const candidate of queued) {
      try {
        await peer.addIceCandidate(candidate);
      } catch (error) {
        console.error("Could not add queued ICE candidate:", error);
      }
    }
  }, []);

  const gotMessageFromServer = useCallback(
    async (fromId, rawMessage) => {
      if (!fromId || fromId === socketIdRef.current) return;

      let signal;
      try {
        signal = typeof rawMessage === "string" ? JSON.parse(rawMessage) : rawMessage;
      } catch (error) {
        console.error("Invalid WebRTC signal:", error);
        return;
      }

      const peer = createPeerConnection(fromId);
      if (!peer) return;

      try {
        if (signal.sdp) {
          // "Glare": both sides sent an offer at the same time. The side with
          // the higher id is "polite" and gives way; the other ignores the
          // incoming offer, so exactly one offer wins.
          const polite = (socketIdRef.current || "") > fromId;
          const collision =
            signal.sdp.type === "offer" &&
            (makingOfferRef.current[fromId] || peer.signalingState !== "stable");
          if (collision && !polite) return;

          await peer.setRemoteDescription(signal.sdp); // polite side rolls back implicitly
          await addQueuedIceCandidates(fromId, peer);

          if (signal.sdp.type === "offer") {
            const answer = await peer.createAnswer();
            await peer.setLocalDescription(answer);
            sendSignal(fromId, { sdp: peer.localDescription });
          }
        }

        if (signal.ice) {
          const candidate = new RTCIceCandidate(signal.ice);
          if (peer.remoteDescription?.type) {
            await peer.addIceCandidate(candidate);
          } else {
            iceCandidatesRef.current[fromId] ||= [];
            iceCandidatesRef.current[fromId].push(candidate);
          }
        }
      } catch (error) {
        console.error("Error handling WebRTC signal:", error);
      }
    },
    [addQueuedIceCandidates, createPeerConnection, sendSignal],
  );

  /* ------------------------------------------------------------------ */
  /* Chat + participants                                                 */
  /* ------------------------------------------------------------------ */

  const addMessage = useCallback((data, sender, socketIdSender, ts, id) => {
    // history is replayed after a reconnect; ids stop duplicates
    if (id != null) {
      if (seenMessagesRef.current.has(id)) return;
      seenMessagesRef.current.add(id);
    }
    setMessages((current) => [...current, { sender, data, ts, mine: socketIdSender === socketIdRef.current }]);
    if (socketIdSender !== socketIdRef.current && panelRef.current !== "chat") {
      setUnread((count) => count + 1);
    }
  }, []);

  const openPanel = (name) => {
    const next = panelRef.current === name ? null : name;
    panelRef.current = next;
    setPanel(next);
    if (next === "chat") setUnread(0);
  };

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ block: "end" });
  }, [messages, panel]);

  const sendMessage = () => {
    const trimmed = message.trim();
    if (!trimmed || !socketRef.current?.connected) return;
    // the server decides who the sender is - we only send the text
    socketRef.current.emit("chat-message", trimmed.slice(0, 1000));
    setMessage("");
  };

  const broadcastMediaState = useCallback(() => {
    if (!hasJoinedRef.current) return;
    socketRef.current?.emit("media-state", {
      audio: audioOnRef.current,
      video: videoOnRef.current || screenOnRef.current,
      screen: screenOnRef.current,
    });
  }, []);

  /* ------------------------------------------------------------------ */
  /* Local media                                                         */
  /* ------------------------------------------------------------------ */

  const acquireMedia = useCallback(async () => {
    const requestId = ++acquireIdRef.current;
    const mediaDevices = navigator.mediaDevices;
    const notices = [];
    const tracks = [];

    if (!mediaDevices?.getUserMedia) {
      notices.push("Your browser can't access a camera or microphone here (HTTPS is required). You can still join and watch.");
    } else {
      // Ask for each device separately so one denial doesn't block the other
      for (const kind of ["video", "audio"]) {
        try {
          const stream = await mediaDevices.getUserMedia(kind === "video" ? { video: true } : { audio: true });
          tracks.push(...stream.getTracks());
        } catch (error) {
          const label = kind === "video" ? "camera" : "microphone";
          notices.push(
            error?.name === "NotAllowedError"
              ? `${label[0].toUpperCase() + label.slice(1)} access is blocked. Allow it in your browser's site settings to use your ${label}.`
              : `No ${label} was found.`,
          );
        }
      }
    }

    if (requestId !== acquireIdRef.current) {
      // page was left (or a newer request started) while waiting - release the devices
      tracks.forEach((t) => t.stop());
      return;
    }

    const stream = new MediaStream(tracks);
    localStreamRef.current = stream;
    setLocalStream(stream);
    setMediaNotices(notices);
    const hasVideo = stream.getVideoTracks().length > 0;
    const hasAudio = stream.getAudioTracks().length > 0;
    videoOnRef.current = hasVideo;
    audioOnRef.current = hasAudio;
    setVideo(hasVideo);
    setAudio(hasAudio);
  }, []);

  // Preview the camera as soon as the lobby is shown
  useEffect(() => {
    if (status === "lobby" && !localStreamRef.current) acquireMedia();
  }, [status, acquireMedia]);

  // The sender slot for a kind (audio/video) on a peer connection
  const getSender = (peer, kind) =>
    peer
      .getTransceivers()
      .find((t) => t.sender.track?.kind === kind || t.receiver.track?.kind === kind)?.sender;

  const ensureMediaTrack = async (kind) => {
    const currentStream = localStreamRef.current || new MediaStream();
    const existingTrack = currentStream
      .getTracks()
      .find((track) => track.kind === kind && track.readyState === "live");
    if (existingTrack) return existingTrack;

    try {
      const newStream = await navigator.mediaDevices.getUserMedia(
        kind === "video" ? { video: true } : { audio: true },
      );
      const track = newStream.getTracks().find((item) => item.kind === kind);
      if (!track) return null;

      // drop dead tracks of this kind, then add the new one
      currentStream.getTracks().filter((t) => t.kind === kind).forEach((t) => currentStream.removeTrack(t));
      currentStream.addTrack(track);
      if (!localStreamRef.current) {
        localStreamRef.current = currentStream;
        setLocalStream(currentStream);
      }

      // don't replace the video that's being sent if we're presenting
      if (!(kind === "video" && screenOnRef.current)) {
        for (const peer of Object.values(connections.current)) {
          await getSender(peer, kind)?.replaceTrack(track);
        }
      }
      return track;
    } catch (error) {
      console.error(`Could not enable ${kind}:`, error);
      return null;
    }
  };

  const handleVideo = async () => {
    const nextValue = !video;
    let track = localStreamRef.current?.getVideoTracks().find((item) => item.readyState === "live");
    if (nextValue && !track) track = await ensureMediaTrack("video");
    if (nextValue && !track) {
      setToast("Camera is not available. Check your browser permissions.");
      return;
    }
    if (track) track.enabled = nextValue;
    videoOnRef.current = nextValue;
    setVideo(nextValue);
    broadcastMediaState();
  };

  const handleAudio = async () => {
    const nextValue = !audio;
    let track = localStreamRef.current?.getAudioTracks().find((item) => item.readyState === "live");
    if (nextValue && !track) track = await ensureMediaTrack("audio");
    if (nextValue && !track) {
      setToast("Microphone is not available. Check your browser permissions.");
      return;
    }
    if (track) track.enabled = nextValue;
    audioOnRef.current = nextValue;
    setAudio(nextValue);
    broadcastMediaState();
  };

  const replaceVideoTrack = async (newTrack) => {
    for (const peer of Object.values(connections.current)) {
      await getSender(peer, "video")?.replaceTrack(newTrack || null);
    }
  };

  const stopScreenShare = async () => {
    const screenStream = screenStreamRef.current;
    screenStreamRef.current = null;
    screenOnRef.current = false;
    screenStream?.getTracks().forEach((track) => {
      track.onended = null;
      track.stop();
    });
    setScreenStream(null);

    const cameraTrack = localStreamRef.current?.getVideoTracks().find((t) => t.readyState === "live") || null;
    if (cameraTrack) cameraTrack.enabled = videoOnRef.current;
    await replaceVideoTrack(cameraTrack);
    setScreen(false);
    broadcastMediaState();
  };

  const handleScreen = async () => {
    if (screen) {
      await stopScreenShare();
      return;
    }
    if (!navigator.mediaDevices?.getDisplayMedia) {
      setToast("Screen sharing is not supported by this browser.");
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({ video: true });
      const screenTrack = stream.getVideoTracks()[0];
      if (!screenTrack) return;

      screenStreamRef.current = stream;
      screenOnRef.current = true;
      await replaceVideoTrack(screenTrack);
      setScreenStream(stream);
      setScreen(true);
      broadcastMediaState();
      // the browser's own "Stop sharing" button
      screenTrack.onended = () => {
        stopScreenShare().catch((error) => console.error("Could not stop screen share:", error));
      };
    } catch (error) {
      // user pressed Cancel in the picker - not an error worth showing
      if (error?.name !== "NotAllowedError") {
        console.error("Screen sharing failed:", error);
        setToast("Could not start screen sharing.");
      }
    }
  };

  /* ------------------------------------------------------------------ */
  /* Joining / leaving                                                   */
  /* ------------------------------------------------------------------ */

  const teardown = useCallback(() => {
    acquireIdRef.current += 1; // cancels any media request still in flight
    Object.keys(connections.current).forEach((id) => removePeer(id));
    localStreamRef.current?.getTracks().forEach((track) => track.stop());
    localStreamRef.current = null;
    screenStreamRef.current?.getTracks().forEach((track) => {
      track.onended = null;
      track.stop();
    });
    screenStreamRef.current = null;
    screenOnRef.current = false;
    const socket = socketRef.current;
    if (socket) {
      socket.removeAllListeners();
      socket.disconnect();
      socketRef.current = null;
    }
    hasJoinedRef.current = false;
  }, [removePeer]);

  // Check the code (and who we are) before showing the lobby
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setStatus("checking");
      if (localStorage.getItem("token")) {
        try {
          await getMe(true);
        } catch {
          /* expired login: continue as a guest */
        }
      }
      try {
        await getMeeting(code);
        if (!cancelled) setStatus("lobby");
      } catch (e) {
        if (cancelled) return;
        setStatusMessage(errorMessage(e, "Could not load this meeting"));
        setStatus(e.response?.status === 410 ? "ended" : "invalid");
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code]);

  // Release camera, mic, sockets and peers when leaving the page
  useEffect(() => teardown, [teardown]);

  // closes only the socket (media is kept so the lobby preview still works)
  const teardownSocket = useCallback(() => {
    Object.keys(connections.current).forEach((id) => removePeer(id));
    const socket = socketRef.current;
    if (socket) {
      socket.removeAllListeners();
      socket.disconnect();
      socketRef.current = null;
    }
    hasJoinedRef.current = false;
  }, [removePeer]);

  const emitJoin = useCallback(
    (socket, isRejoin) => {
      socket.emit(
        "join-call",
        code,
        { name: guestNameRef.current, audio: audioOnRef.current, video: videoOnRef.current },
        (res) => {
          if (!res?.ok) {
            const stale = socketRef.current !== socket;
            if (stale) return;
            teardownSocket();
            if (res?.ended) {
              setStatusMessage(res.error);
              setStatus("ended");
            } else if (res?.error === "Meeting not found") {
              setStatusMessage(res.error);
              setStatus("invalid");
            } else {
              setJoinError(res?.error || "Could not join the meeting");
              setStatus("lobby");
            }
            return;
          }
          if (res.alreadyJoined) return;
          hasJoinedRef.current = true;
          setMyId(socket.id);
          setIsHost(res.isHost);
          setConnection("ok");
          setStatus("joined");
          if (!isRejoin && localStorage.getItem("token") && me) {
            addToUserHistory(code).catch(() => {});
          }
        },
      );
    },
    [code, me, teardownSocket, addToUserHistory],
  );

  const joinMeeting = () => {
    const name = guestName.trim();
    if (!me && (name.length < 2 || name.length > 30)) {
      setJoinError("Please enter a name (2-30 characters)");
      return;
    }
    if (socketRef.current) return; // already connecting
    guestNameRef.current = name;
    if (!me) {
      try {
        localStorage.setItem("guestName", name);
      } catch {
        /* private mode - fine */
      }
    }
    setJoinError("");
    setStatus("joining");

    // Logged-in users send their token so the server knows who they are
    const socket = io(server_url, { auth: { token: me ? localStorage.getItem("token") : undefined } });
    socketRef.current = socket;

    // Listeners are registered once per socket, so events can't be handled twice.
    socket.on("connect", () => {
      socketIdRef.current = socket.id;
      if (hasJoinedRef.current) {
        // we were disconnected and the server forgot us: start clean and rejoin
        Object.keys(connections.current).forEach((id) => removePeer(id));
        emitJoin(socket, true);
      } else {
        emitJoin(socket, false);
      }
    });
    socket.on("disconnect", (reason) => {
      if (hasJoinedRef.current && reason !== "io client disconnect") setConnection("reconnecting");
    });
    socket.on("connect_error", (error) => {
      console.error("Socket connection failed:", error);
      if (!hasJoinedRef.current) {
        teardownSocket();
        setJoinError("Can't reach the server. Check your connection and try again.");
        setStatus("lobby");
      }
    });

    socket.on("chat-message", addMessage);
    socket.on("user-left", (id) => removePeer(id));
    socket.on("participants", (list) => {
      setParticipants(list);
      const present = new Set(list.map((p) => p.id));
      Object.keys(connections.current).forEach((id) => {
        if (!present.has(id)) removePeer(id);
      });
    });
    socket.on("user-joined", async (id, clients = []) => {
      const clientIds = [...new Set([...(clients || []), id])];
      clientIds.forEach((clientId) => createPeerConnection(clientId));

      // The joining client creates offers to the participants already in the room.
      if (id === socket.id) {
        for (const clientId of clientIds) {
          if (clientId !== socket.id) await makeOffer(clientId);
        }
      }
    });
    socket.on("signal", gotMessageFromServer);
    socket.on("meeting-ended", () => {
      teardown();
      setStatusMessage("The host ended this meeting.");
      setStatus("ended");
    });
  };

  const leaveToHome = () => {
    teardown();
    navigate(localStorage.getItem("token") ? "/home" : "/");
  };

  const endForEveryone = () => {
    setConfirmEnd(false);
    socketRef.current?.emit("end-meeting", (res) => {
      if (!res?.ok) setToast(res?.error || "Could not end the meeting");
    });
  };

  const copyInvite = async () => {
    const link = `${window.location.origin}/${code}`;
    const text = `Join my meeting: ${link}\nMeeting code: ${code}`;
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const area = document.createElement("textarea");
      area.value = text;
      document.body.appendChild(area);
      area.select();
      document.execCommand("copy");
      area.remove();
    }
    setToast("Invite copied to clipboard");
  };

  /* ------------------------------------------------------------------ */
  /* Rendering                                                           */
  /* ------------------------------------------------------------------ */

  const speakerStreams = { ...remoteStreams };
  if (localStream && myId) speakerStreams[myId] = localStream;
  const activeSpeaker = useActiveSpeaker(status === "joined" ? speakerStreams : {});

  const displayName = me?.name || guestName.trim() || "You";

  if (status === "checking") {
    return (
      <div className={styles.centerScreen}>
        <CircularProgress />
      </div>
    );
  }

  if (status === "invalid" || status === "ended") {
    return (
      <div className={styles.centerScreen}>
        <div className={styles.messageCard}>
          <h2>{status === "ended" ? "Meeting ended" : "Can't join this meeting"}</h2>
          <p>{statusMessage}</p>
          <Button variant="contained" onClick={leaveToHome}>
            {localStorage.getItem("token") ? "Back to dashboard" : "Back to home"}
          </Button>
        </div>
      </div>
    );
  }

  if (status === "lobby" || status === "joining") {
    const joining = status === "joining";
    const previewVideoOn = video && localStream?.getVideoTracks().length > 0;
    return (
      <div className={styles.lobby}>
        <div className={styles.lobbyPreview}>
          <div className={styles.previewBox}>
            <VideoSurface stream={localStream} muted mirror hidden={!previewVideoOn} />
            {!previewVideoOn && (
              <div className={styles.avatarWrap}>
                <div className={styles.avatar} style={{ background: colorFor(displayName) }}>
                  {initials(displayName)}
                </div>
              </div>
            )}
            <div className={styles.previewControls}>
              <ControlButton
                label={audio ? "Turn microphone off" : "Turn microphone on"}
                onClick={handleAudio}
                off={!audio}
                icon={audio ? <MicIcon /> : <MicOffIcon />}
              />
              <ControlButton
                label={video ? "Turn camera off" : "Turn camera on"}
                onClick={handleVideo}
                off={!video}
                icon={video ? <VideocamIcon /> : <VideocamOffIcon />}
              />
            </div>
          </div>
        </div>

        <div className={styles.lobbyForm}>
          <h1>Ready to join?</h1>
          <p className={styles.codeLine}>
            Meeting code <strong>{code}</strong>
          </p>

          {mediaNotices.map((n) => (
            <Alert severity="warning" key={n} sx={{ mb: 1.5 }}>
              {n}
            </Alert>
          ))}
          {joinError && (
            <Alert severity="error" sx={{ mb: 1.5 }}>
              {joinError}
            </Alert>
          )}

          {me ? (
            <p className={styles.joinAs}>
              Joining as <strong>{me.name}</strong> (@{me.username})
            </p>
          ) : (
            <TextField
              label="Your name"
              value={guestName}
              onChange={(e) => setGuestName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && joinMeeting()}
              slotProps={{ htmlInput: { maxLength: 30 } }}
              helperText="You're joining as a guest. Log in to use your account name."
              sx={{ mb: 2 }}
              autoFocus
            />
          )}

          <Button
            variant="contained"
            size="large"
            fullWidth
            onClick={joinMeeting}
            disabled={joining}
            sx={{ py: 1.4 }}
          >
            {joining ? <CircularProgress size={22} color="inherit" /> : "Join now"}
          </Button>
          <Button fullWidth onClick={leaveToHome} sx={{ mt: 1 }}>
            Cancel
          </Button>
        </div>
      </div>
    );
  }

  /* ---------- in the meeting ---------- */
  const remoteParticipants = participants.filter((p) => p.id !== myId);
  const meInList = participants.find((p) => p.id === myId);
  const total = remoteParticipants.length + 1;
  const cols = colsFor(total);
  const colsM = colsForMobile(total);
  const localShowsVideo = Boolean(screenStream) || (video && localStream?.getVideoTracks().length > 0);

  return (
    <div className={styles.room}>
      <header className={styles.topbar}>
        <div className={styles.topLeft}>
          <strong>{code}</strong>
          <Tooltip title="Copy invite link">
            <IconButton size="small" onClick={copyInvite} aria-label="Copy invite" sx={{ color: "inherit" }}>
              <ContentCopyIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </div>
        <div className={styles.topRight}>
          {connection === "reconnecting" && <span className={styles.reconnecting}>Reconnecting…</span>}
          <span>{total} in meeting</span>
        </div>
      </header>

      <div className={styles.stage}>
        <div className={styles.gridWrap}>
          <div
            className={styles.grid}
            data-count={total}
            style={{
              "--cols": cols,
              "--rows": Math.ceil(total / cols),
              "--cols-m": colsM,
              "--rows-m": Math.ceil(total / colsM),
            }}
          >
            <Tile
              name={displayName}
              stream={screenStream || localStream}
              showVideo={localShowsVideo}
              isLocal
              mirror={!screenStream}
              audioOn={audio}
              presenting={Boolean(screenStream)}
              host={isHost}
              speaking={activeSpeaker === myId}
            />
            {remoteParticipants.map((p) => (
              <Tile
                key={p.id}
                name={p.name}
                stream={remoteStreams[p.id]}
                showVideo={Boolean(remoteStreams[p.id]) && p.video}
                audioOn={p.audio}
                presenting={p.screen}
                host={p.isHost}
                speaking={activeSpeaker === p.id}
              />
            ))}
          </div>
        </div>

        {panel && (
          <aside className={styles.sidePanel} aria-label={panel === "chat" ? "Chat" : "Participants"}>
            <div className={styles.panelHeader}>
              <h2>{panel === "chat" ? "Chat" : `People (${total})`}</h2>
              <IconButton onClick={() => openPanel(panel)} aria-label="Close panel" size="small">
                <CloseIcon />
              </IconButton>
            </div>

            {panel === "chat" ? (
              <>
                <div className={styles.chatList}>
                  {messages.length === 0 ? (
                    <p className={styles.panelEmpty}>No messages yet. Say hello 👋</p>
                  ) : (
                    messages.map((item, index) => (
                      <div key={index} className={`${styles.msg} ${item.mine ? styles.msgMine : ""}`}>
                        <div className={styles.msgMeta}>
                          <strong>{item.mine ? "You" : item.sender}</strong>
                          <span>{formatTime(item.ts)}</span>
                        </div>
                        <div className={styles.msgBody}>{item.data}</div>
                      </div>
                    ))
                  )}
                  <div ref={chatEndRef} />
                </div>
                <div className={styles.chatInput}>
                  <TextField
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="Send a message"
                    size="small"
                    slotProps={{ htmlInput: { maxLength: 1000 } }}
                    onKeyDown={(e) => e.key === "Enter" && sendMessage()}
                  />
                  <IconButton color="primary" onClick={sendMessage} disabled={!message.trim()} aria-label="Send message">
                    <SendIcon />
                  </IconButton>
                </div>
              </>
            ) : (
              <div className={styles.peopleList}>
                {[meInList || { id: myId, name: displayName, isHost, audio, video }, ...remoteParticipants].map((p) => (
                  <div className={styles.person} key={p.id}>
                    <div className={styles.personAvatar} style={{ background: colorFor(p.name) }}>
                      {initials(p.name)}
                    </div>
                    <div className={styles.personInfo}>
                      <div>
                        {p.name}
                        {p.id === myId ? " (You)" : ""}
                      </div>
                      <small>
                        {p.isHost ? "Host" : p.isGuest ? "Guest" : p.username ? `@${p.username}` : ""}
                      </small>
                    </div>
                    {p.id === myId ? (
                      <>
                        {audio ? <MicIcon fontSize="small" /> : <MicOffIcon fontSize="small" color="error" />}
                        {video || screen ? <VideocamIcon fontSize="small" /> : <VideocamOffIcon fontSize="small" color="error" />}
                      </>
                    ) : (
                      <>
                        {p.audio ? <MicIcon fontSize="small" /> : <MicOffIcon fontSize="small" color="error" />}
                        {p.video ? <VideocamIcon fontSize="small" /> : <VideocamOffIcon fontSize="small" color="error" />}
                      </>
                    )}
                  </div>
                ))}
              </div>
            )}
          </aside>
        )}
      </div>

      <footer className={styles.controls}>
        <ControlButton
          label={audio ? "Mute microphone" : "Unmute microphone"}
          onClick={handleAudio}
          off={!audio}
          icon={audio ? <MicIcon /> : <MicOffIcon />}
        />
        <ControlButton
          label={video ? "Turn camera off" : "Turn camera on"}
          onClick={handleVideo}
          off={!video}
          icon={video ? <VideocamIcon /> : <VideocamOffIcon />}
        />
        {screenAvailable && (
          <ControlButton
            label={screen ? "Stop sharing" : "Share screen"}
            onClick={handleScreen}
            active={screen}
            icon={screen ? <StopScreenShareIcon /> : <ScreenShareIcon />}
          />
        )}
        <ControlButton
          label="Participants"
          onClick={() => openPanel("people")}
          active={panel === "people"}
          icon={<PeopleAltIcon />}
        />
        <ControlButton
          label="Chat"
          onClick={() => openPanel("chat")}
          active={panel === "chat"}
          badge={unread}
          icon={<ChatIcon />}
        />
        <ControlButton label="Copy invite" onClick={copyInvite} icon={<ContentCopyIcon />} />
        <ControlButton label="Leave meeting" onClick={leaveToHome} danger icon={<CallEndIcon />} />
        {isHost && (
          <Button color="error" variant="outlined" size="small" onClick={() => setConfirmEnd(true)} className={styles.endBtn}>
            End for all
          </Button>
        )}
      </footer>

      <Dialog open={confirmEnd} onClose={() => setConfirmEnd(false)}>
        <DialogTitle>End meeting for everyone?</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Everyone will be removed and nobody can join with this code again.
          </DialogContentText>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setConfirmEnd(false)}>Cancel</Button>
          <Button color="error" variant="contained" onClick={endForEveryone}>
            End meeting
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={Boolean(toast)}
        autoHideDuration={3000}
        onClose={() => setToast("")}
        message={toast}
        anchorOrigin={{ vertical: "top", horizontal: "center" }}
      />
    </div>
  );
}
