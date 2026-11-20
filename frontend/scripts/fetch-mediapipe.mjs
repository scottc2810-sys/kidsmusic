// Put the hand-tracking files next to the app (public/mediapipe) so the camera works with no
// internet connection: the WebAssembly runtime comes from node_modules, the model is downloaded
// once (about 8 MB). Never fails the build: without these files the app falls back to the CDN.
import { cpSync, existsSync, mkdirSync, statSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const out = join(root, "public", "mediapipe");
const MODEL_URL = "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task";

try {
  mkdirSync(out, { recursive: true });
  const wasm = join(root, "node_modules", "@mediapipe", "tasks-vision", "wasm");
  if (existsSync(wasm)) cpSync(wasm, join(out, "wasm"), { recursive: true });
  else console.warn("[mediapipe] wasm runtime not found in node_modules (run npm ci)");
  const model = join(out, "hand_landmarker.task");
  if (existsSync(model) && statSync(model).size > 1_000_000) {
    console.log("[mediapipe] model already present");
  } else {
    const res = await fetch(MODEL_URL);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    writeFileSync(model, Buffer.from(await res.arrayBuffer()));
    console.log(`[mediapipe] model downloaded (${Math.round(statSync(model).size / 1e6)} MB)`);
  }
} catch (e) {
  console.warn(`[mediapipe] could not bundle hand tracking for offline use (${e.message}); the app will load it from the internet instead`);
}
