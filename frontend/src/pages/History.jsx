import { useContext, useEffect, useState } from "react";
import { AuthContext } from "../contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import Alert from "@mui/material/Alert";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import HistoryRoundedIcon from "@mui/icons-material/HistoryRounded";
import AppShell from "../components/AppShell";
import withAuth from "../utils/withAuth";
import { errorMessage } from "../utils/validation";

function History() {
  const { getHistoryOfUser } = useContext(AuthContext);

  const [meetings, setMeetings] = useState(null);
  const [error, setError] = useState("");

  const routeTo = useNavigate();

  useEffect(() => {
    const fetchHistory = async () => {
      try {
        const history = await getHistoryOfUser();
        setMeetings(history);
      } catch (e) {
        setError(errorMessage(e, "Could not load your history"));
        setMeetings([]);
      }
    };

    fetchHistory();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  let formatDate = (dateString) =>
    new Date(dateString).toLocaleString(undefined, {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });

  return (
    <AppShell>
      <h1 className="pageTitle">Meeting history</h1>
      <p className="pageSub">Meetings you've joined, newest first.</p>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      <section className="card">
        {meetings === null ? (
          <CircularProgress size={24} />
        ) : meetings.length === 0 ? (
          <div className="emptyState">
            <HistoryRoundedIcon />
            <strong>No meetings yet</strong>
            Once you join a meeting, it will appear here.
          </div>
        ) : (
          meetings.map((e, i) => (
            <div className="listRow" key={`${e.meeting_code}-${i}`}>
              <div className="grow">
                <div className="title">Code: {e.meeting_code}</div>
                <div className="sub">{formatDate(e.date)}</div>
              </div>
              <Button size="small" variant="outlined" onClick={() => routeTo(`/${e.meeting_code}`)}>
                Rejoin
              </Button>
            </div>
          ))
        )}
      </section>
    </AppShell>
  );
}

export default withAuth(History);
