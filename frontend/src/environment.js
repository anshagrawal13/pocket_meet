// Backend URL. Override with VITE_API_URL in frontend/.env (e.g. for a different deployment).
// `npm run dev` talks to your local backend, a production build talks to Render.
const server =
  import.meta.env.VITE_API_URL ||
  (import.meta.env.DEV
    ? "http://localhost:8000"
    : "https://apnacollegebackend.onrender.com");

export default server;
