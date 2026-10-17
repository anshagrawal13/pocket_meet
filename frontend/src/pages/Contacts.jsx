import { useContext, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogContentText from "@mui/material/DialogContentText";
import DialogTitle from "@mui/material/DialogTitle";
import IconButton from "@mui/material/IconButton";
import TextField from "@mui/material/TextField";
import Tooltip from "@mui/material/Tooltip";
import PersonAddRoundedIcon from "@mui/icons-material/PersonAddRounded";
import PersonRemoveRoundedIcon from "@mui/icons-material/PersonRemoveRounded";
import PeopleAltRoundedIcon from "@mui/icons-material/PeopleAltRounded";
import SearchRoundedIcon from "@mui/icons-material/SearchRounded";
import AppShell from "../components/AppShell";
import withAuth from "../utils/withAuth";
import { AuthContext } from "../contexts/AuthContext";
import { useToast } from "../components/Toast";
import { errorMessage, initials, normalizeUsername } from "../utils/validation";
import { getInviteSocket } from "../utils/inviteSocket";

function Contacts() {
  const { getContacts, searchUsers, addContact, removeContact, createMeeting } = useContext(AuthContext);
  const navigate = useNavigate();
  const [toast, notify] = useToast();

  const [contacts, setContacts] = useState(null);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [toRemove, setToRemove] = useState(null);

  const load = () => getContacts().then(setContacts).catch((e) => { setContacts([]); notify(errorMessage(e), "error"); });

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // debounced search while typing
  useEffect(() => {
    const q = normalizeUsername(query);
    if (q.length < 2) return undefined;
    let cancelled = false;
    const t = setTimeout(async () => {
      setSearching(true);
      try {
        const found = await searchUsers(q);
        if (!cancelled) setResults(found);
      } catch {
        if (!cancelled) setResults([]);
      } finally {
        if (!cancelled) setSearching(false);
      }
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  const handleAdd = async (user) => {
    try {
      await addContact(user.username);
      setResults((r) => r.map((u) => (u.username === user.username ? { ...u, isContact: true } : u)));
      notify(`${user.name} added to contacts`);
      load();
    } catch (e) {
      notify(errorMessage(e), "error");
    }
  };

  const confirmRemove = async () => {
    const user = toRemove;
    setToRemove(null);
    try {
      await removeContact(user.username);
      setContacts((c) => c.filter((x) => x.username !== user.username));
      setResults((r) => r.map((u) => (u.username === user.username ? { ...u, isContact: false } : u)));
      notify("Contact removed");
    } catch (e) {
      notify(errorMessage(e), "error");
    }
  };

  const meet = async (contact) => {
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
      <h1 className="pageTitle">Contacts</h1>
      <p className="pageSub">Save people so you can start a meeting with them in one click.</p>

      <div className="homeGrid">
        <section className="card">
          <h2>Find people</h2>
          <p className="cardSub">Search by username.</p>
          <TextField
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Start typing a username…"
            slotProps={{ input: { startAdornment: <SearchRoundedIcon sx={{ mr: 1, color: "text.secondary" }} /> } }}
          />
          <div style={{ marginTop: 12 }}>
            {searching ? (
              <CircularProgress size={22} />
            ) : normalizeUsername(query).length < 2 ? (
              <div className="emptyState">Type at least 2 characters to search.</div>
            ) : results.length === 0 ? (
              <div className="emptyState"><strong>No users found</strong>Check the spelling and try again.</div>
            ) : (
              results.map((u) => (
                <div className="listRow" key={u.username}>
                  <div className="avatar">{initials(u.name)}</div>
                  <div className="grow">
                    <div className="title">{u.name}</div>
                    <div className="sub">@{u.username}</div>
                  </div>
                  {u.isContact ? (
                    <span className="sub">In contacts</span>
                  ) : (
                    <Button size="small" variant="contained" startIcon={<PersonAddRoundedIcon />} onClick={() => handleAdd(u)}>
                      Add
                    </Button>
                  )}
                </div>
              ))
            )}
          </div>
        </section>

        <section className="card">
          <h2>Your contacts {contacts ? `(${contacts.length})` : ""}</h2>
          <p className="cardSub">Meet starts a new meeting and notifies them if they're online.</p>
          {contacts === null ? (
            <CircularProgress size={22} />
          ) : contacts.length === 0 ? (
            <div className="emptyState">
              <PeopleAltRoundedIcon />
              <strong>No contacts yet</strong>
              Search for a username to add your first contact.
            </div>
          ) : (
            contacts.map((c) => (
              <div className="listRow" key={c.username}>
                <div className="avatar">{initials(c.name)}</div>
                <div className="grow">
                  <div className="title">{c.name}</div>
                  <div className="sub">@{c.username}</div>
                </div>
                <Button size="small" variant="outlined" onClick={() => meet(c)}>Meet</Button>
                <Tooltip title="Remove contact">
                  <IconButton size="small" aria-label={`Remove ${c.name}`} onClick={() => setToRemove(c)}>
                    <PersonRemoveRoundedIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              </div>
            ))
          )}
        </section>
      </div>

      <Dialog open={Boolean(toRemove)} onClose={() => setToRemove(null)}>
        <DialogTitle>Remove contact?</DialogTitle>
        <DialogContent>
          <DialogContentText>
            {toRemove?.name} (@{toRemove?.username}) will be removed from your contacts.
          </DialogContentText>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setToRemove(null)}>Cancel</Button>
          <Button color="error" variant="contained" onClick={confirmRemove}>Remove</Button>
        </DialogActions>
      </Dialog>
      {toast}
    </AppShell>
  );
}

export default withAuth(Contacts);
