import { useContext, useEffect, useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import Avatar from "@mui/material/Avatar";
import Button from "@mui/material/Button";
import IconButton from "@mui/material/IconButton";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import Snackbar from "@mui/material/Snackbar";
import Alert from "@mui/material/Alert";
import HomeRoundedIcon from "@mui/icons-material/HomeRounded";
import HistoryRoundedIcon from "@mui/icons-material/HistoryRounded";
import PeopleAltRoundedIcon from "@mui/icons-material/PeopleAltRounded";
import PersonRoundedIcon from "@mui/icons-material/PersonRounded";
import Brand from "./Brand";
import { AuthContext } from "../contexts/AuthContext";
import { initials } from "../utils/validation";
import {
  connectInviteSocket,
  disconnectInviteSocket,
} from "../utils/inviteSocket";

const NAV = [
  { to: "/home", label: "Home", icon: <HomeRoundedIcon fontSize="small" /> },
  { to: "/contacts", label: "Contacts", icon: <PeopleAltRoundedIcon fontSize="small" /> },
  { to: "/history", label: "History", icon: <HistoryRoundedIcon fontSize="small" /> },
  { to: "/profile", label: "Profile", icon: <PersonRoundedIcon fontSize="small" /> },
];

export default function AppShell({ children }) {
  const { userData, getMe, handleLogout } = useContext(AuthContext);
  const navigate = useNavigate();
  const [menuAnchor, setMenuAnchor] = useState(null);
  const [invite, setInvite] = useState(null);

  useEffect(() => {
    if (!userData) getMe().catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Listen for meeting invitations from contacts on every logged-in page.
  useEffect(() => {
    const socket = connectInviteSocket();
    if (!socket) return;
    const onInvite = (payload) => setInvite(payload);
    socket.on("meeting-invite", onInvite);
    return () => {
      socket.off("meeting-invite", onInvite);
      disconnectInviteSocket();
    };
  }, []);

  return (
    <div className="shell">
      <header className="shellHeader">
        <div className="shellHeaderInner">
          <Brand to="/home" />
          <nav className="shellNav" aria-label="Main">
            {NAV.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) => `navLink${isActive ? " active" : ""}`}
              >
                {item.icon}
                <span className="label">{item.label}</span>
              </NavLink>
            ))}
          </nav>
          <IconButton
            onClick={(e) => setMenuAnchor(e.currentTarget)}
            aria-label="Account menu"
            size="small"
          >
            <Avatar sx={{ width: 36, height: 36, bgcolor: "primary.light", color: "primary.dark", fontSize: 14, fontWeight: 700 }}>
              {initials(userData?.name)}
            </Avatar>
          </IconButton>
          <Menu anchorEl={menuAnchor} open={Boolean(menuAnchor)} onClose={() => setMenuAnchor(null)}>
            <MenuItem disabled sx={{ opacity: "1 !important", flexDirection: "column", alignItems: "flex-start" }}>
              <strong>{userData?.name || "…"}</strong>
              <span style={{ fontSize: 13, color: "#64748b" }}>@{userData?.username}</span>
            </MenuItem>
            <MenuItem onClick={() => { setMenuAnchor(null); navigate("/profile"); }}>Profile</MenuItem>
            <MenuItem onClick={() => { setMenuAnchor(null); handleLogout(); }}>Log out</MenuItem>
          </Menu>
        </div>
      </header>

      <main className="shellMain">{children}</main>

      <Snackbar open={Boolean(invite)} anchorOrigin={{ vertical: "top", horizontal: "center" }} onClose={() => setInvite(null)}>
        <Alert
          severity="info"
          variant="filled"
          onClose={() => setInvite(null)}
          action={
            <Button color="inherit" size="small" onClick={() => { const c = invite.code; setInvite(null); navigate(`/${c}`); }}>
              Join
            </Button>
          }
        >
          {invite?.from} invited you to a meeting
        </Alert>
      </Snackbar>
    </div>
  );
}
