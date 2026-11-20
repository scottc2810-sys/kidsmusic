import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { App } from "./App";
import "./styles.css";
import { installAudioUnlock } from "./audio/synth";
import { primeSpeech } from "./audio/speech";

// Browsers keep sound muted until the first tap/key: unlock Web Audio and speech on that first gesture.
installAudioUnlock(primeSpeech);

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>,
);
