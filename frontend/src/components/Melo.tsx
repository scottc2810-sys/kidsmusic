// Melo: the app's original owl teacher (inline SVG, no external assets).
// Alive, not static: breathes, blinks, looks around, moves its beak with each spoken word,
// tilts its head to listen, cheers on a success and leans in kindly after a miss.
// Emotions like a real teacher: proud (puffed chest), dance (a party for a streak), surprised (wide eyes),
// curious (head tilt, one brow up), sad (droopy brows and tufts, slow blink: "aww, that was hard").
import { useEffect, useId, useRef, useState } from "react";
import { onMouth } from "../audio/speech";

export type MeloMood = "idle" | "talking" | "happy" | "thinking" | "listening" | "sleepy" | "cheer" | "encourage"
  | "proud" | "dance" | "surprised" | "curious" | "sad";

const reducedMotion = () => typeof window !== "undefined" && !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

export function Melo({ mood = "idle", size = 140, say }: { mood?: MeloMood; size?: number; say?: string }) {
  const uid = useId().replace(/:/g, "");
  const [blink, setBlink] = useState(false);
  const [gaze, setGaze] = useState<[number, number]>([0, 0]);
  const [mouth, setMouth] = useState(0);
  const target = useRef(0);

  // Natural blinking every 2.5–5.5 s (sometimes a double blink).
  useEffect(() => {
    if (reducedMotion()) return;
    let t: number;
    const loop = () => {
      t = window.setTimeout(() => {
        setBlink(true);
        window.setTimeout(() => setBlink(false), 130);
        if (Math.random() < 0.2) window.setTimeout(() => { setBlink(true); window.setTimeout(() => setBlink(false), 120); }, 280);
        loop();
      }, 2500 + Math.random() * 3000);
    };
    loop();
    return () => clearTimeout(t);
  }, []);

  // Eyes: wander when idle, look down at the keys while listening, up while thinking, at the child while talking.
  useEffect(() => {
    if (mood === "listening") { setGaze([0, 3.5]); return; }
    if (mood === "thinking") { setGaze([-3, -4]); return; }
    if (mood === "talking" || mood === "encourage" || mood === "proud" || mood === "surprised") { setGaze([0, 0.5]); return; }
    if (mood === "sad") { setGaze([0, 2.5]); return; } // eyes down a little
    if (mood === "curious") { setGaze([3, -1]); return; }
    if (reducedMotion()) { setGaze([0, 0]); return; }
    const id = window.setInterval(() => setGaze([Math.round((Math.random() - 0.5) * 8), Math.round((Math.random() - 0.5) * 4)]), 1800);
    return () => clearInterval(id);
  }, [mood]);

  // Beak follows the voice: word pulses from speech, eased so it doesn't flicker.
  useEffect(() => {
    const off = onMouth((v) => { target.current = v; });
    let raf = 0;
    let cur = 0;
    const tick = () => {
      cur += (target.current - cur) * 0.45;
      target.current *= 0.86; // each word opens, then closes
      setMouth((m) => (Math.abs(m - cur) > 0.02 ? cur : m));
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => { off(); cancelAnimationFrame(raf); };
  }, []);

  const sleepy = mood === "sleepy";
  const smiling = mood === "happy" || mood === "cheer" || mood === "proud" || mood === "dance";
  const eyesClosed = (blink && mood !== "surprised") || sleepy || mood === "cheer" || mood === "dance";
  const open = mood === "talking" ? mouth : mood === "surprised" ? 0.8 : smiling ? 0.35 : 0;
  const [gx, gy] = gaze;
  const pupil = mood === "surprised" ? 0.75 : mood === "curious" || mood === "proud" ? 1.12 : 1; // engaged eyes widen
  const brow = mood === "encourage" ? "M33 34 q10 -6 20 2 M67 36 q10 -8 20 -2" : mood === "thinking" ? "M33 33 q10 -7 20 -1 M67 31 q10 -4 20 3"
    : mood === "sad" ? "M33 37 q10 -3 20 -7 M67 30 q10 -1 20 7" // inner ends up: worried, caring
    : mood === "surprised" ? "M33 27 q10 -10 20 0 M67 27 q10 -10 20 0"
    : mood === "curious" ? "M33 29 q10 -9 20 -1 M67 35 q10 -3 20 1"
    : smiling ? "M33 33 q10 -8 20 0 M67 33 q10 -8 20 0" : "M34 34 q9 -5 18 0 M68 34 q9 -5 18 0";

  return (
    <div className={`melo melo-${mood}`}>
      <svg width={size} height={size} viewBox="0 0 120 124" role="img" aria-label="Melo the music owl">
        <defs>
          <radialGradient id={`b${uid}`} cx="45%" cy="35%" r="70%">
            <stop offset="0%" stopColor="#8c72ff" /><stop offset="60%" stopColor="#6c4cf1" /><stop offset="100%" stopColor="#4a2fc2" />
          </radialGradient>
          <radialGradient id={`t${uid}`} cx="50%" cy="30%" r="75%">
            <stop offset="0%" stopColor="#ffffff" /><stop offset="100%" stopColor="#ddd2ff" />
          </radialGradient>
          <radialGradient id={`e${uid}`} cx="40%" cy="35%" r="65%">
            <stop offset="0%" stopColor="#ffffff" /><stop offset="100%" stopColor="#e9e4fb" />
          </radialGradient>
          <linearGradient id={`k${uid}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#ffc845" /><stop offset="100%" stopColor="#f08c00" />
          </linearGradient>
          <radialGradient id={`i${uid}`} cx="35%" cy="35%" r="70%">
            <stop offset="0%" stopColor="#7a4a1d" /><stop offset="55%" stopColor="#3b2410" /><stop offset="100%" stopColor="#140b05" />
          </radialGradient>
        </defs>
        <ellipse className="melo-shadow" cx="60" cy="118" rx="32" ry="4" fill="var(--shadow)" />
        <g className="melo-body">
          <g className="melo-breathe">
            {/* ear tufts */}
            <path className="melo-tuft-l" d="M28 42 C22 30 20 20 24 12 C30 20 38 26 44 32 Z" fill="#5236d1" />
            <path className="melo-tuft-r" d="M92 42 C98 30 100 20 96 12 C90 20 82 26 76 32 Z" fill="#5236d1" />
            <ellipse cx="60" cy="68" rx="40" ry="45" fill={`url(#b${uid})`} />
            {/* tummy with feather scallops */}
            <ellipse cx="60" cy="82" rx="25" ry="27" fill={`url(#t${uid})`} />
            {[0, 1, 2].map((r) => (
              <path key={r} d={`M${44 + r * 2} ${76 + r * 8} q4 4 8 0 q4 4 8 0 q4 4 8 0 q4 4 ${8 - r * 2} 0`} stroke="#c9bcf7" strokeWidth="1.6" fill="none" strokeLinecap="round" />
            ))}
            {/* face disc */}
            <ellipse cx="60" cy="52" rx="33" ry="22" fill="#7d61f5" opacity="0.55" />
            <g className="melo-eyes">
              <circle cx="43" cy="51" r="15" fill={`url(#e${uid})`} />
              <circle cx="77" cy="51" r="15" fill={`url(#e${uid})`} />
              {eyesClosed ? (
                <>
                  <path d={smiling ? "M35 53 q8 -8 16 0" : "M35 52 q8 5 16 0"} stroke="#2a2340" strokeWidth="3.5" fill="none" strokeLinecap="round" />
                  <path d={smiling ? "M69 53 q8 -8 16 0" : "M69 52 q8 5 16 0"} stroke="#2a2340" strokeWidth="3.5" fill="none" strokeLinecap="round" />
                </>
              ) : (
                <g style={{ transform: `translate(${gx}px, ${gy}px)`, transition: "transform 0.25s ease-out" }}>
                  <circle cx="44" cy="52" r={8 * pupil} fill={`url(#i${uid})`} />
                  <circle cx="78" cy="52" r={8 * pupil} fill={`url(#i${uid})`} />
                  <circle cx="44" cy="52" r={4 * pupil} fill="#0d0805" />
                  <circle cx="78" cy="52" r={4 * pupil} fill="#0d0805" />
                  <circle cx="46.5" cy="49" r="2.4" fill="#fff" />
                  <circle cx="80.5" cy="49" r="2.4" fill="#fff" />
                  <circle cx="42" cy="55" r="1" fill="#fff" opacity="0.8" />
                  <circle cx="76" cy="55" r="1" fill="#fff" opacity="0.8" />
                </g>
              )}
            </g>
            {mood === "sad" && !eyesClosed && ( /* heavy upper lids: a soft, sorry-for-you look */
              <>
                <path d="M28 47 q15 -10 30 0 L58 35 L28 35 Z" fill="#7559f3" />
                <path d="M62 47 q15 -10 30 0 L92 35 L62 35 Z" fill="#7559f3" />
              </>
            )}
            <path className="melo-brows" d={brow} stroke="#3d27a8" strokeWidth="3" fill="none" strokeLinecap="round" />
            {/* cheeks */}
            <ellipse cx="32" cy="64" rx="5" ry="3" fill="#ff8fb1" opacity={mood === "proud" ? 0.75 : smiling || mood === "talking" ? 0.55 : 0.3} />
            <ellipse cx="88" cy="64" rx="5" ry="3" fill="#ff8fb1" opacity={mood === "proud" ? 0.75 : smiling || mood === "talking" ? 0.55 : 0.3} />
            {/* beak: the lower half opens with speech */}
            <path d="M53 62 Q60 59 67 62 L60 70 Z" fill={`url(#k${uid})`} />
            <path d="M54.5 66 L65.5 66 L60 71 Z" fill="#e07b00"
              style={{ transform: `translateY(${open * 5}px) scaleY(${1 + open * 0.5})`, transformOrigin: "60px 66px" }} />
            <ellipse cx="22" cy="74" rx="9" ry="19" fill="#5236d1" className="melo-wing-l" />
            <ellipse cx="98" cy="74" rx="9" ry="19" fill="#5236d1" className="melo-wing-r" />
            {/* feet */}
            <path d="M48 110 l-3 5 M52 111 l0 5 M56 110 l3 5" stroke="#f08c00" strokeWidth="2.5" strokeLinecap="round" />
            <path d="M64 110 l-3 5 M68 111 l0 5 M72 110 l3 5" stroke="#f08c00" strokeWidth="2.5" strokeLinecap="round" />
          </g>
        </g>
        {mood === "listening" && <text className="melo-fx" x="96" y="30" fontSize="16">👂</text>}
        {(mood === "happy" || mood === "cheer") && (
          <g className="melo-notes"><text x="92" y="26" fontSize="16">🎵</text><text x="8" y="34" fontSize="13">🎶</text>{mood === "cheer" && <text x="54" y="12" fontSize="14">⭐</text>}</g>
        )}
        {mood === "thinking" && <g className="melo-dots"><circle cx="98" cy="24" r="2.5" /><circle cx="105" cy="17" r="3" /><circle cx="113" cy="9" r="3.5" /></g>}
        {sleepy && <text className="melo-fx" x="92" y="24" fontSize="16">💤</text>}
        {(mood === "encourage" || mood === "sad") && <text className="melo-fx" x="94" y="28" fontSize="15">💜</text>}
        {mood === "proud" && <g className="melo-notes"><text x="92" y="24" fontSize="15">✨</text><text x="10" y="30" fontSize="14">🏅</text></g>}
        {mood === "dance" && <g className="melo-notes"><text x="94" y="24" fontSize="16">🎵</text><text x="6" y="30" fontSize="15">🎉</text><text x="54" y="8" fontSize="14">⭐</text></g>}
        {mood === "surprised" && <text className="melo-fx" x="96" y="26" fontSize="16">❗</text>}
        {mood === "curious" && <text className="melo-fx" x="96" y="26" fontSize="16">❓</text>}
      </svg>
      {say && <div className="bubble" role="status" aria-live="polite">{say}</div>}
    </div>
  );
}

const CONFETTI_COLORS = ["#ff5d8f", "#ffc845", "#4cc9f0", "#7ae582", "#8c72ff", "#ff9f1c"];
/** A burst of confetti for a real milestone (a streak, a new stage). Decorative only; skipped for reduced motion. */
export function Confetti({ burst }: { burst: number }) {
  const [pieces, setPieces] = useState<{ id: number; x: number; d: number; c: string; r: number }[]>([]);
  useEffect(() => {
    if (!burst || reducedMotion()) return;
    setPieces(Array.from({ length: 28 }, (_, i) => ({ id: burst * 100 + i, x: Math.random() * 100, d: Math.random() * 0.4,
      c: CONFETTI_COLORS[i % CONFETTI_COLORS.length], r: Math.random() * 360 })));
    const t = window.setTimeout(() => setPieces([]), 2200);
    return () => clearTimeout(t);
  }, [burst]);
  if (!pieces.length) return null;
  return (
    <div className="confetti" aria-hidden>
      {pieces.map((p) => <i key={p.id} style={{ left: `${p.x}%`, background: p.c, animationDelay: `${p.d}s`, transform: `rotate(${p.r}deg)` }} />)}
    </div>
  );
}
