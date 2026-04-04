import "@/shared/config/i18n/instance";
import "@/features/locale/model/store";
import "@/features/theme/model/store";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./app/styles/global.css";
import { App } from "./app";

const rootEl = document.getElementById("root")!;
createRoot(rootEl).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
