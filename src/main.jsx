import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import ReleaseUpdate from "./components/ReleaseUpdate";
import "leaflet/dist/leaflet.css";
import "./styles.css";
import "./styles/gamma-motion.css";
import "./styles/gamma-splash.css";

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
    <ReleaseUpdate />
  </React.StrictMode>
);
