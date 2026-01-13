import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import AttendanceScanner from "./App";

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <AttendanceScanner />
  </StrictMode>
);
