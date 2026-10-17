import { useContext, useState } from "react";
import { Navigate, useSearchParams } from "react-router-dom";
import Alert from "@mui/material/Alert";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import IconButton from "@mui/material/IconButton";
import InputAdornment from "@mui/material/InputAdornment";
import TextField from "@mui/material/TextField";
import VisibilityRoundedIcon from "@mui/icons-material/VisibilityRounded";
import VisibilityOffRoundedIcon from "@mui/icons-material/VisibilityOffRounded";
import { AuthContext } from "../contexts/AuthContext";
import Brand from "../components/Brand";
import {
  errorMessage,
  nameError,
  normalizeUsername,
  passwordError,
  usernameError,
} from "../utils/validation";

function Authentication() {
  const [params] = useSearchParams();
  const [formState, setFormState] = useState(params.get("mode") === "register" ? 1 : 0); // 0 = login, 1 = register
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [touched, setTouched] = useState({});
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const { handleRegister, handleLogin } = useContext(AuthContext);

  if (localStorage.getItem("token")) return <Navigate to="/home" replace />;

  const isRegister = formState === 1;
  // Only the register form enforces the format rules; login just needs values.
  const errors = {
    name: isRegister ? nameError(name) : "",
    username: isRegister ? usernameError(username) : username.trim() ? "" : "Enter your username",
    password: isRegister ? passwordError(password) : password ? "" : "Enter your password",
  };
  const hasErrors = Object.values(errors).some(Boolean);
  const show = (field) => touched[field] && errors[field];

  const switchMode = (mode) => {
    setFormState(mode);
    setError("");
    setMessage("");
    setTouched({});
    setPassword("");
  };

  const handleAuth = async (e) => {
    e?.preventDefault();
    setTouched({ name: true, username: true, password: true });
    if (hasErrors) return;

    setLoading(true);
    setError("");
    try {
      if (formState === 0) {
        await handleLogin(username.trim(), password);
      } else {
        const result = await handleRegister(name.trim(), normalizeUsername(username), password);
        setMessage(`${result}. You can log in now.`);
        setUsername(normalizeUsername(username));
        switchModeKeepingMessage();
      }
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  // after a successful sign-up: go to the login form but keep the success note
  const switchModeKeepingMessage = () => {
    setFormState(0);
    setTouched({});
    setPassword("");
  };

  return (
    <div className="authPage">
      <aside className="authSide">
        <Brand />
        <div>
          <h2>Meet anyone, anywhere.</h2>
          <p>Create an account to start meetings, keep your history and save your contacts.</p>
        </div>
        <small style={{ color: "#bfdbfe" }}>© Apna Video Call</small>
      </aside>

      <div className="authFormWrap">
        <form className="authForm" onSubmit={handleAuth} noValidate>
          <h1>{isRegister ? "Create your account" : "Welcome back"}</h1>
          <p className="cardSub" style={{ marginBottom: 0 }}>
            {isRegister ? "It takes less than a minute." : "Log in to continue to your meetings."}
          </p>

          {message && <Alert severity="success">{message}</Alert>}
          {error && <Alert severity="error">{error}</Alert>}

          {isRegister && (
            <TextField
              label="Full name"
              value={name}
              autoComplete="name"
              autoFocus
              onChange={(e) => setName(e.target.value)}
              onBlur={() => setTouched((t) => ({ ...t, name: true }))}
              error={Boolean(show("name"))}
              helperText={show("name")}
              slotProps={{ htmlInput: { maxLength: 50 } }}
            />
          )}

          <TextField
            label="Username"
            value={username}
            autoComplete="username"
            autoFocus={!isRegister}
            onChange={(e) => setUsername(e.target.value)}
            onBlur={() => setTouched((t) => ({ ...t, username: true }))}
            error={Boolean(show("username"))}
            helperText={show("username") || (isRegister ? "Letters, numbers and underscores. Not case sensitive." : "")}
            slotProps={{ htmlInput: { maxLength: 20 } }}
          />

          <TextField
            label="Password"
            type={showPassword ? "text" : "password"}
            value={password}
            autoComplete={isRegister ? "new-password" : "current-password"}
            onChange={(e) => setPassword(e.target.value)}
            onBlur={() => setTouched((t) => ({ ...t, password: true }))}
            error={Boolean(show("password"))}
            helperText={show("password") || (isRegister ? "At least 8 characters." : "")}
            slotProps={{
              input: {
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton
                      aria-label={showPassword ? "Hide password" : "Show password"}
                      onClick={() => setShowPassword((v) => !v)}
                      edge="end"
                    >
                      {showPassword ? <VisibilityOffRoundedIcon /> : <VisibilityRoundedIcon />}
                    </IconButton>
                  </InputAdornment>
                ),
              },
            }}
          />

          <Button type="submit" variant="contained" size="large" disabled={loading} sx={{ py: 1.4 }}>
            {loading ? <CircularProgress size={22} color="inherit" /> : isRegister ? "Create account" : "Log in"}
          </Button>

          <div className="authSwitch">
            {isRegister ? (
              <>Already have an account? <button type="button" onClick={() => switchMode(0)}>Log in</button></>
            ) : (
              <>New here? <button type="button" onClick={() => switchMode(1)}>Create an account</button></>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
export default Authentication;
