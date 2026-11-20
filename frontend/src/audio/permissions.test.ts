import { afterEach, describe, expect, it, vi } from "vitest";
import { micErrorMessage, micPermission, requestMic } from "./permissions";

function setup({ secure = true, state = "prompt", gum }: { secure?: boolean; state?: string | null; gum?: () => Promise<unknown> }) {
  const stop = vi.fn();
  const getUserMedia = vi.fn(gum ?? (async () => ({ getTracks: () => [{ stop }] })));
  vi.stubGlobal("window", { isSecureContext: secure });
  vi.stubGlobal("navigator", {
    mediaDevices: { getUserMedia },
    permissions: { query: state === null ? vi.fn(async () => { throw new TypeError("unsupported name"); }) : vi.fn(async () => ({ state })) },
  });
  return { getUserMedia, stop };
}

afterEach(() => vi.unstubAllGlobals());

describe("microphone permission", () => {
  it("asks the browser when not decided yet, and closes the test stream", async () => {
    const { getUserMedia, stop } = setup({ state: "prompt" });
    const r = await requestMic();
    expect(r).toMatchObject({ ok: true, state: "granted" });
    expect(getUserMedia).toHaveBeenCalledWith({ audio: true });
    expect(stop).toHaveBeenCalled();
  });

  it("does not re-prompt when blocked and explains how to unblock", async () => {
    const { getUserMedia } = setup({ state: "denied" });
    const r = await requestMic();
    expect(r.ok).toBe(false);
    expect(r.state).toBe("denied");
    expect(r.message).toMatch(/address bar/);
    expect(getUserMedia).not.toHaveBeenCalled();
  });

  it("maps a refused prompt to denied", async () => {
    setup({ state: "prompt", gum: async () => { throw Object.assign(new Error("x"), { name: "NotAllowedError" }); } });
    expect(await requestMic()).toMatchObject({ ok: false, state: "denied" });
  });

  it("explains a missing or busy microphone", () => {
    expect(micErrorMessage({ name: "NotFoundError" }).message).toMatch(/No microphone/);
    expect(micErrorMessage({ name: "NotReadableError" }).message).toMatch(/busy/);
  });

  it("refuses on insecure pages and falls back to asking when the Permissions API lacks 'microphone'", async () => {
    setup({ secure: false });
    expect(await micPermission()).toBe("insecure");
    expect((await requestMic()).ok).toBe(false);
    setup({ state: null });
    expect(await micPermission()).toBe("prompt");
  });
});
