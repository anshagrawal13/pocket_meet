import VideocamRoundedIcon from "@mui/icons-material/VideocamRounded";
import { useNavigate } from "react-router-dom";

export default function Brand({ to = "/" }) {
  const navigate = useNavigate();
  return (
    <span
      className="brand"
      role="link"
      tabIndex={0}
      onClick={() => navigate(to)}
      onKeyDown={(e) => e.key === "Enter" && navigate(to)}
    >
      <span className="brandMark">
        <VideocamRoundedIcon fontSize="small" />
      </span>
      Pocket Meet
    </span>
  );
}
