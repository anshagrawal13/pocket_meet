import { useContext, useEffect, useState } from "react";
import withAuth from "../utils/withAuth";
import { useNavigate } from "react-router-dom";
import "../App.css";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import TextField from "@mui/material/TextField";
import VideoCallRoundedIcon from "@mui/icons-material/VideoCallRounded";
import KeyboardRoundedIcon from "@mui/icons-material/KeyboardRounded";
import PeopleAltRoundedIcon from "@mui/icons-material/PeopleAltRounded";
import HistoryRoundedIcon from "@mui/icons-material/HistoryRounded";
import AppShell from "../components/AppShell";
import { AuthContext } from "../contexts/AuthContext";
import { useToast } from "../components/Toast";
import { errorMessage, extractMeetingCode, initials } from "../utils/validation";
import { getInviteSocket } from "../utils/inviteSocket";

function HomeComponent() {
  let navigate = useNavigate();
  const [meetingCode, setMeetingCode] = useState("");
  const [codeError, setCodeError] = useState("");
  const [creating, setCreating] = useState(false);
  const [contacts, setContacts] = useState(null);
  const [recent, setRecent] = useState(null);
  const [toast, notify] = useToast();

  const { userData, createMeeting, getMeeting, getContacts, getHistoryOfUser } = useContext(AuthContext);

  useEffect(() => {
    getContacts().then(setContacts).catch(() => setContacts([]));
    getHistoryOfUser()
      .then((rows) => {
        // newest first, one entry per meeting code
        const seen = new Set();
        setRecent(rows.filter((r) => !seen.has(r.meeting_code) && seen.add(r.meeting_code)).slice(0, 4));
      })
      .catch(() => setRecent([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleNewMeeting = async () => {
    setCreating(true);
    try {
      const code = await createMeeting();
      navigate(`/${code}`);
    } catch (e) {
      notify(errorMessage(e), "error");
      setCreating(false);
    }
  };

  let handleJoinVideoCall = async () => {
    const code = extractMeetingCode(meetingCode);
    if (!code) {
      setCodeError("Enter a valid meeting code, like abc-defg-hij");
      return;
    }
    try {
      await getMeeting(code);
      navigate(`/${code}`);
    } catch (e) {
      setCodeError(errorMessage(e));
    }
  };

  const meetContact = async (contact) => {
    try {
      const code = await createMeeting();
      getInviteSocket()?.emit("invite-contact", contact.username, code, (res) => {
        if (res && !res.ok) notify(res.error, "error");
      });
      navigate(`/${code}`);
    } catch (e) {
      notify(errorMessage(e), "error");
    }
  };

  return (
    <AppShell>
      <h1 className="pageTitle">Hello, {userData?.name?.split(" ")[0] || "there"} 👋</h1>
      <p className="pageSub">Start a meeting or join one with a code.</p>

      <div className="homeGrid">
        <div className="stack">
          <section className="card heroCard">
            <h2>New meeting</h2>
            <p className="cardSub">Create a meeting and share the code or link with others.</p>
            <div className="heroActions">
              <Button
                variant="contained"
                size="large"
                onClick={handleNewMeeting}
                disabled={creating}
                startIcon={creating ? <CircularProgress size={18} color="inherit" /> : <VideoCallRoundedIcon />}
                sx={{ bgcolor: "#fff", color: "primary.dark", "&:hover": { bgcolor: "#eff6ff" } }}
              >
                Start a meeting
              </Button>
            </div>
          </section>

          <section className="card">
            <h2>Join with a code</h2>
            <p className="cardSub">Paste the code or invite link you received.</p>
            <div className="joinRow">
              <TextField
                value={meetingCode}
                onChange={(e) => { setMeetingCode(e.target.value); setCodeError(""); }}
                onKeyDown={(e) => e.key === "Enter" && handleJoinVideoCall()}
                label="Meeting code"
                placeholder="abc-defg-hij"
                error={Boolean(codeError)}
                helperText={codeError}
                slotProps={{ input: { startAdornment: <KeyboardRoundedIcon sx={{ mr: 1, color: "text.secondary" }} /> } }}
              />
              <Button onClick={handleJoinVideoCall} variant="contained" sx={{ minWidth: 100, height: 56 }}>
                Join
              </Button>
            </div>
          </section>
        </div>

        <div className="stack">
          <section className="card">
            <h2>Contacts</h2>
            <p className="cardSub">Start a meeting and invite someone in one click.</p>
            {contacts === null ? (
              <CircularProgress size={22} />
            ) : contacts.length === 0 ? (
              <div className="emptyState">
                <PeopleAltRoundedIcon />
                <strong>No contacts yet</strong>
                <Button size="small" onClick={() => navigate("/contacts")}>Find people</Button>
              </div>
            ) : (
              <>
                {contacts.slice(0, 4).map((c) => (
                  <div className="listRow" key={c.username}>
                    <div className="avatar">{initials(c.name)}</div>
                    <div className="grow">
                      <div className="title">{c.name}</div>
                      <div className="sub">@{c.username}</div>
                    </div>
                    <Button size="small" variant="outlined" onClick={() => meetContact(c)}>Meet</Button>
                  </div>
                ))}
                {contacts.length > 4 && (
                  <Button size="small" onClick={() => navigate("/contacts")} sx={{ mt: 1 }}>
                    View all {contacts.length}
                  </Button>
                )}
              </>
            )}
          </section>

          <section className="card">
            <h2>Recent meetings</h2>
            <p className="cardSub">Jump back into a meeting you joined.</p>
            {recent === null ? (
              <CircularProgress size={22} />
            ) : recent.length === 0 ? (
              <div className="emptyState">
                <HistoryRoundedIcon />
                <strong>Nothing here yet</strong>
                Meetings you join will show up here.
              </div>
            ) : (
              recent.map((m) => (
                <div className="listRow" key={m.meeting_code}>
                  <div className="grow">
                    <div className="title">{m.meeting_code}</div>
                    <div className="sub">{new Date(m.date).toLocaleString()}</div>
                  </div>
                  <Button size="small" onClick={() => navigate(`/${m.meeting_code}`)}>Rejoin</Button>
                </div>
              ))
            )}
          </section>
        </div>
      </div>
      {toast}
    </AppShell>
  );
}

export default withAuth(HomeComponent);
