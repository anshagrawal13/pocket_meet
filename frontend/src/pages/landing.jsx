import { useState } from "react";
import "../App.css";
import { useNavigate } from "react-router-dom";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import TextField from "@mui/material/TextField";
import CheckCircleRoundedIcon from "@mui/icons-material/CheckCircleRounded";
import Brand from "../components/Brand";
import { extractMeetingCode } from "../utils/validation";

export default function LandingPage() {
  const router = useNavigate();
  const loggedIn = Boolean(localStorage.getItem("token"));
  const [joinOpen, setJoinOpen] = useState(false);
  const [code, setCode] = useState("");
  const [error, setError] = useState("");

  const join = () => {
    const parsed = extractMeetingCode(code);
    if (!parsed) {
      setError("Enter a valid meeting code, like abc-defg-hij");
      return;
    }
    router(`/${parsed}`);
  };

  return (
    <div className="landing">
      <nav className="landingNav">
        <Brand />
        <div className="landingNavActions">
          <Button onClick={() => setJoinOpen(true)}>Join as guest</Button>
          {loggedIn ? (
            <Button variant="contained" onClick={() => router("/home")}>
              Open dashboard
            </Button>
          ) : (
            <>
              <Button onClick={() => router("/auth")}>Log in</Button>
              <Button variant="contained" onClick={() => router("/auth?mode=register")}>
                Sign up
              </Button>
            </>
          )}
        </div>
      </nav>

      <section className="landingHero">
        <div>
          <h1>
            <span>Connect</span> with the people who matter
          </h1>
          <p className="lead">
            Simple, reliable video meetings with screen sharing and chat. Start
            a meeting in one click, or join with a code.
          </p>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            <Button
              variant="contained"
              size="large"
              onClick={() => router(loggedIn ? "/home" : "/auth?mode=register")}
            >
              Get started
            </Button>
            <Button variant="outlined" size="large" onClick={() => setJoinOpen(true)}>
              Join with a code
            </Button>
          </div>
          <div className="featureList">
            <span><CheckCircleRoundedIcon /> HD video &amp; audio</span>
            <span><CheckCircleRoundedIcon /> Screen sharing</span>
            <span><CheckCircleRoundedIcon /> In-meeting chat</span>
          </div>
        </div>
        <div className="landingArt">
          <img src="/mobile.png" alt="Video call on a phone" />
        </div>
      </section>

      <Dialog open={joinOpen} onClose={() => setJoinOpen(false)} fullWidth maxWidth="xs">
        <DialogTitle>Join a meeting</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            label="Meeting code or link"
            placeholder="abc-defg-hij"
            value={code}
            error={Boolean(error)}
            helperText={error || "You'll be asked for your name before joining."}
            onChange={(e) => { setCode(e.target.value); setError(""); }}
            onKeyDown={(e) => e.key === "Enter" && join()}
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setJoinOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={join}>Continue</Button>
        </DialogActions>
      </Dialog>
    </div>
  );
}
