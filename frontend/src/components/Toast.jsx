import { useCallback, useState } from "react";
import Alert from "@mui/material/Alert";
import Snackbar from "@mui/material/Snackbar";

// const [toast, notify] = useToast();  notify("Saved") / notify("Oops", "error")
// render {toast} anywhere in the page.
export function useToast() {
  const [state, setState] = useState({ open: false, message: "", severity: "success" });

  const notify = useCallback(
    (message, severity = "success") => setState({ open: true, message, severity }),
    [],
  );

  const toast = (
    <Snackbar
      open={state.open}
      autoHideDuration={4000}
      onClose={(_, reason) => reason !== "clickaway" && setState((s) => ({ ...s, open: false }))}
      anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
    >
      <Alert
        severity={state.severity}
        variant="filled"
        onClose={() => setState((s) => ({ ...s, open: false }))}
        sx={{ width: "100%" }}
      >
        {state.message}
      </Alert>
    </Snackbar>
  );

  return [toast, notify];
}
