import { useContext, useEffect, useState } from "react";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import TextField from "@mui/material/TextField";
import AppShell from "../components/AppShell";
import withAuth from "../utils/withAuth";
import { AuthContext } from "../contexts/AuthContext";
import { useToast } from "../components/Toast";
import { errorMessage, initials, nameError, passwordError } from "../utils/validation";

function Profile() {
  const { userData, getMe, updateProfile, changePassword, handleLogout } = useContext(AuthContext);
  const [toast, notify] = useToast();

  const [name, setName] = useState("");
  const [savingName, setSavingName] = useState(false);
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [savingPw, setSavingPw] = useState(false);
  const [pwTouched, setPwTouched] = useState(false);

  useEffect(() => {
    (userData ? Promise.resolve(userData) : getMe()).then((u) => setName(u.name)).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const nameErr = nameError(name);
  const saveName = async (e) => {
    e.preventDefault();
    if (nameErr) return;
    setSavingName(true);
    try {
      await updateProfile(name.trim());
      notify("Profile updated");
    } catch (err) {
      notify(errorMessage(err), "error");
    } finally {
      setSavingName(false);
    }
  };

  const pwErr = passwordError(next);
  const savePassword = async (e) => {
    e.preventDefault();
    setPwTouched(true);
    if (!current || pwErr) return;
    setSavingPw(true);
    try {
      const msg = await changePassword(current, next);
      notify(msg);
      setCurrent("");
      setNext("");
      setPwTouched(false);
    } catch (err) {
      notify(errorMessage(err), "error");
    } finally {
      setSavingPw(false);
    }
  };

  return (
    <AppShell>
      <h1 className="pageTitle">Profile &amp; settings</h1>
      <p className="pageSub">Manage how you appear to others and keep your account secure.</p>

      <div className="homeGrid">
        <section className="card">
          <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 20 }}>
            <div className="avatar" style={{ width: 56, height: 56, fontSize: "1.2rem" }}>{initials(userData?.name)}</div>
            <div>
              <h2 style={{ marginBottom: 0 }}>{userData?.name || "…"}</h2>
              <div className="cardSub" style={{ marginBottom: 0 }}>@{userData?.username}</div>
            </div>
          </div>
          <form onSubmit={saveName} style={{ display: "flex", flexDirection: "column", gap: 16 }} noValidate>
            <TextField label="Full name" value={name} onChange={(e) => setName(e.target.value)}
              error={Boolean(name && nameErr)} helperText={name && nameErr} slotProps={{ htmlInput: { maxLength: 50 } }} />
            <TextField label="Username" value={userData?.username || ""} disabled helperText="Usernames can't be changed." />
            <Button type="submit" variant="contained" disabled={savingName || Boolean(nameErr) || name.trim() === userData?.name}>
              {savingName ? <CircularProgress size={22} color="inherit" /> : "Save changes"}
            </Button>
          </form>
        </section>

        <div className="stack">
          <section className="card">
            <h2>Change password</h2>
            <p className="cardSub">Use at least 8 characters.</p>
            <form onSubmit={savePassword} style={{ display: "flex", flexDirection: "column", gap: 16 }} noValidate>
              <TextField label="Current password" type="password" autoComplete="current-password"
                value={current} onChange={(e) => setCurrent(e.target.value)}
                error={pwTouched && !current} helperText={pwTouched && !current ? "Enter your current password" : ""} />
              <TextField label="New password" type="password" autoComplete="new-password"
                value={next} onChange={(e) => setNext(e.target.value)}
                error={pwTouched && Boolean(pwErr)} helperText={pwTouched && pwErr} />
              <Button type="submit" variant="contained" disabled={savingPw}>
                {savingPw ? <CircularProgress size={22} color="inherit" /> : "Update password"}
              </Button>
            </form>
          </section>

          <section className="card">
            <h2>Session</h2>
            <p className="cardSub">Log out of this browser.</p>
            <Button variant="outlined" color="error" onClick={handleLogout}>Log out</Button>
          </section>
        </div>
      </div>
      {toast}
    </AppShell>
  );
}

export default withAuth(Profile);
