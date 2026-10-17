import { createTheme } from "@mui/material/styles";

// One place for colors / shape / typography so every page matches.
const theme = createTheme({
  palette: {
    primary: { main: "#2563eb", dark: "#1d4ed8", light: "#dbeafe" },
    secondary: { main: "#475569" },
    error: { main: "#dc2626" },
    success: { main: "#16a34a" },
    background: { default: "#f8fafc", paper: "#ffffff" },
    text: { primary: "#0f172a", secondary: "#64748b" },
  },
  shape: { borderRadius: 10 },
  typography: {
    fontFamily:
      '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
    h1: { fontWeight: 700, letterSpacing: "-0.03em" },
    h2: { fontWeight: 700, letterSpacing: "-0.02em" },
    h3: { fontWeight: 700, letterSpacing: "-0.02em" },
    h4: { fontWeight: 700, letterSpacing: "-0.02em" },
    h5: { fontWeight: 600 },
    h6: { fontWeight: 600 },
    button: { textTransform: "none", fontWeight: 600 },
  },
  components: {
    MuiButton: {
      defaultProps: { disableElevation: true },
      styleOverrides: { root: { borderRadius: 10, paddingInline: 18 } },
    },
    MuiTextField: { defaultProps: { size: "medium", fullWidth: true } },
    MuiPaper: { styleOverrides: { root: { backgroundImage: "none" } } },
    MuiTooltip: { defaultProps: { arrow: true } },
  },
});

export default theme;
