import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { setAuthTokenGetter, setBaseUrl } from "./api-client";

// In Vercel deployment, set VITE_API_URL to your backend API server URL
// e.g. https://your-api.railway.app
const apiUrl = import.meta.env.VITE_API_URL ?? "";
if (apiUrl) setBaseUrl(apiUrl);

setAuthTokenGetter(() => localStorage.getItem("prestarapi_token"));

createRoot(document.getElementById("root")!).render(<App />);
