// Browser microphone permission: check it, ask for it, and explain failures in plain words.
// This is separate from the parent's consent toggle (stored on the server): both are needed.

export type MicState = "granted" | "denied" | "prompt" | "unsupported" | "insecure";

export interface MicResult { ok: boolean; state: MicState; message: string }

const BLOCKED_HELP =
  "The browser is blocking the microphone. Click the 🔒 (or 🎤) icon at the left of the address bar, set Microphone to Allow, then reload the page.";

export async function micPermission(): Promise<MicState> {
  if (typeof window === "undefined") return "unsupported";
  if (!window.isSecureContext) return "insecure";
  if (!navigator.mediaDevices?.getUserMedia) return "unsupported";
  try {
    const st = await navigator.permissions.query({ name: "microphone" as PermissionName });
    return st.state as MicState;
  } catch {
    return "prompt"; // Permissions API without "microphone" (older Firefox/Safari): we only know by asking
  }
}

/** Call permission changes (e.g. the parent allows it from the address bar) back into the UI. */
export async function watchMicPermission(cb: (s: MicState) => void): Promise<() => void> {
  try {
    const st = await navigator.permissions.query({ name: "microphone" as PermissionName });
    const h = () => cb(st.state as MicState);
    st.addEventListener("change", h);
    return () => st.removeEventListener("change", h);
  } catch {
    return () => {};
  }
}

export function micErrorMessage(e: unknown): MicResult {
  const name = (e as { name?: string })?.name ?? "";
  if (name === "NotAllowedError" || name === "SecurityError" || name === "PermissionDeniedError")
    return { ok: false, state: "denied", message: BLOCKED_HELP };
  if (name === "NotFoundError" || name === "DevicesNotFoundError" || name === "OverconstrainedError")
    return { ok: false, state: "prompt", message: "No microphone was found. Plug one in (or turn it on in Windows sound settings) and try again." };
  if (name === "NotReadableError" || name === "TrackStartError" || name === "AbortError")
    return { ok: false, state: "prompt", message: "The microphone is busy in another app (Zoom, Teams, another tab…). Close it there and try again." };
  return { ok: false, state: "prompt", message: "Could not open the microphone. Check that it is connected and allowed, then try again." };
}

/**
 * Ask the browser for the microphone (shows its permission prompt if not decided yet).
 * Call from a click. The test stream is closed straight away.
 */
export async function requestMic(): Promise<MicResult> {
  const before = await micPermission();
  if (before === "insecure")
    return { ok: false, state: before, message: "Microphones only work on a secure page. Open Melo at http://127.0.0.1:8000 or http://localhost:8000, or put it behind HTTPS." };
  if (before === "unsupported")
    return { ok: false, state: before, message: "This browser cannot use a microphone. Try Chrome or Edge." };
  if (before === "denied") return { ok: false, state: "denied", message: BLOCKED_HELP };
  try {
    const s = await navigator.mediaDevices.getUserMedia({ audio: true });
    s.getTracks().forEach((t) => t.stop());
    return { ok: true, state: "granted", message: "Microphone allowed ✓" };
  } catch (e) {
    return micErrorMessage(e);
  }
}
