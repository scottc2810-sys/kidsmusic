# Melo — AI Music Teacher for Kids · Architecture

## 1. Goals and constraints (from MVP.txt)

| Requirement | Design response |
|---|---|
| Ages 3–8, short lessons, one concept at a time | Lesson engine caps session length (parent setting, default 5 min), introduces at most one never-seen activity type per session |
| Progress by demonstrated ability, not minutes | Per-skill mastery (EMA of scored attempts) + per-skill difficulty 1–5; level unlock requires mastery ≥ 0.7 **and** a minimum number of scored attempts |
| Adapt: struggle → simplify, success → harder, bored → game, frustrated → break | Deterministic adaptive engine (`backend/app/engine.py`) with explicit rules, unit-tested |
| Distinguish a playing error from an uncertain observation | Every attempt outcome is one of `success / partial / miss / uncertain / skipped`. `uncertain` never lowers mastery and triggers a "let's try again" line, not a correction |
| Screen, real-instrument, listening, practice modes | Activity catalogue tags each activity with the modes it supports; real mode routes the same note-input interface to the microphone pitch tracker (+ optional camera hints) |
| Hindi / English / Hinglish | All teacher lines exist in a curated offline phrase bank for all 3 languages; Claude is prompted in the chosen language; browser TTS picks `hi-IN` / `en-IN` voices |
| Claude manages teaching decisions; specialised components do musical analysis | Claude plans each session (focus skill from an engine-approved list, theme, greeting), answers the child's questions, and writes recording feedback. DSP (YIN pitch, onset detection, alignment) is pure numpy; vision is MediaPipe in the browser |
| AI provider configurable; app works without API access | `KM_AI_PROVIDER=auto|anthropic|offline`. Offline provider is a complete, curated teacher. Every Claude call has a timeout and falls back to offline output |
| Parental consent before camera / mic / recordings | Consent stored per child with an audit log; enforced **server-side** (uploads rejected without consent) and client-side (no `getUserMedia` call without consent) |
| Process recordings locally, never train on them, delete on request | Recordings are analysed on the server host, encrypted at rest (Fernet / AES-128-CBC + HMAC), never sent to the AI provider (only derived numeric metrics are). Parents can delete a recording, all of a child's data, or the whole account |
| Easy local deployment on Windows or Linux | One Python process serves the API and the built SPA. `scripts/setup.(ps1|sh)` + `scripts/run.(ps1|sh)`; optional Docker image |

## 2. System overview

```
┌──────────────────────────── Browser (React + TS + Vite) ─────────────────────────────┐
│  Parent area                         Child area                                      │
│  ─ auth, child profiles, consent     ─ Melo character + speech bubble + TTS          │
│  ─ progress & skills, sessions       ─ Activity players (piano, rhythm pad, choices) │
│  ─ recorder / upload, AI feedback    ─ NoteInput: VirtualPiano | MicPitchTracker     │
│  ─ delete data                         (+ CameraObserver hints, MediaPipe Hands)     │
│  Parent gate (math question) guards the way from child area to parent area          │
└───────────────▲──────────────────────────────────────────────────────────────────────┘
                │ JSON over HTTPS/HTTP, httpOnly SameSite=Strict session cookie + CSRF header
┌───────────────┴──────────────────── FastAPI (single process) ─────────────────────────┐
│ routers/  auth · children · lessons · teacher · recordings · health                  │
│ engine.py         adaptive lesson engine (pure, deterministic, seeded)               │
│ curriculum.py     4 levels, 9 activity types, song library, spec generators          │
│ scoring.py        server-authoritative scoring of every attempt                      │
│ teacher/          TeacherService → AnthropicProvider | OfflineProvider + safety filter│
│ audio/            WAV decode · YIN pitch · onsets · note segmentation · song alignment│
│ storage.py        encrypted recording store                                          │
│ SQLAlchemy 2 + SQLite (WAL, FK on)                                                    │
└───────────────────────────────────────────────────────────────────────────────────────┘
```

### Why these choices
* **Server-authoritative scoring.** The server generates each activity instance (targets stay server-side), the client submits raw responses (choices, tap timestamps, note events with confidence), and `scoring.py` decides the outcome. This keeps the adaptive engine honest, makes it testable, and means a future native client reuses the same brain.
* **Deterministic engine, AI on top.** A 3-year-old cannot wait 4 s between every note, and a child-facing product must not let an LLM free-run on difficulty. The engine handles the per-attempt loop instantly; Claude makes the higher-level choices (session focus/theme within engine-approved candidates, conversational answers, practice-review lessons). All AI output is schema-constrained, validated and passed through a child-safety filter.
* **Privacy by construction.** The child's name is never sent to the AI provider (prompts use a `{name}` placeholder that is filled in locally). Audio never leaves the host; only numeric analysis results go to the AI for wording feedback. Cloud AI is a per-child, parent-controlled toggle.
* **Browser-side real-time DSP.** Live note detection must be low latency, so the mic pitch tracker (YIN on an `AnalyserNode`) runs in the browser. Long recordings (≤10 min) are converted to 16 kHz mono PCM WAV in the browser and analysed on the server, so no ffmpeg dependency is needed on Windows.

## 3. Domain model

| Table | Purpose |
|---|---|
| `parents` | account: email, scrypt password hash |
| `children` | profile + preferences (language, instrument, mode, session minutes, reminder) + consents + `cloud_ai_allowed` + `current_level` |
| `consent_events` | append-only audit trail of consent changes |
| `skill_states` | per child × skill: mastery, difficulty, attempts, streaks |
| `lesson_sessions` | one lesson: level, mode, AI plan, counts, stars, end reason |
| `attempts` | one activity instance: server spec (incl. answer), client response, outcome, score |
| `recordings` | encrypted file reference, duration, status, analysis JSON, feedback JSON |
| `memory_nodes` / `memory_edges` / `memory_events` | learning-graph memory (see §7) |
| `api_tokens` | hashed Claude Code / MCP access tokens |

Skills: `pitch`, `dynamics`, `timbre`, `rhythm`, `melody`, `creativity`.

## 4. Lesson engine rules (engine.py)

* Mastery update: `m ← m + 0.3·(score − m)` for `success|partial|miss`; unchanged for `uncertain|skipped`.
* Difficulty: **placement** while a skill is new (first 4 tries, all successes): each success → +1 up to 4. Afterwards 2 successes in a row → +1 (max 5; a partial keeps the streak). 2 misses in a row → −1 (min 1) and the teacher says "let's make it easier".
* **Re-teach:** after a miss the answer is explained (`feedback.specifics`) and the same item returns once with more help (`curriculum.scaffold`: keys shown, slower, an extra try) before the lesson moves on.
* **Stretch:** 3 successes in a row earn one item from the next level; 2 successes on next-level material (stretch items or a whole song in the song school) open that level even if a core skill is still missing. Parents can set the level directly.
* A skill also counts as shown when the child succeeds at difficulty ≥ 3 (no need to repeat easy items); otherwise mastery ≥ 0.7 or ≥ 60% right over ≥ 3 tries.
* Youngest children (≤ 5) get wider rhythm timing (`curriculum.age_adjust`).
* Session signals: 3 misses in a row across skills **or** the child presses "I'm frustrated" → offer a break or an easy game. 2 skips in a row (no response) or "I want a game" → switch to a game (instrument guess / free play). "I'm tired" or "Stop" → end the session immediately, with praise. Session time limit → warm wrap-up.
* Selection: candidates are activities allowed at `≤ current_level` and in the current mode; score = weakness of the skill + plan focus bonus − repetition penalty; at most one new activity type per session; seeded RNG per session for reproducibility.
* Level unlock: all core skills of the current level are shown (see above), or two next-level successes.

### 4a. Listening and coaching
* **Ears in every mode:** when the parent allowed the microphone, the browser pitch tracker runs in all lessons and the song school; screen keys keep working. An answer that contains a heard note is scored as `mic` (octave-tolerant, low-confidence notes are `uncertain`, never wrong). `plan.ears` records it.
* **`coach.py`** aligns the heard notes to the target (edit distance, free start, pitch classes) and looks at the timing between matched notes relative to the written lengths: one long stop → `hesitation` (+ spot-practice drill on those two notes), a long note released early → `hold_long`, pace when playing with the beat → `rushing` / `dragging`, variation → `uneven`, very even → `steady` (specific praise), weak mic confidence → `louder`. One tip at most; corrections outrank praise.
* **Camera** (real-keyboard mode, optional): MediaPipe landmarks → finger joint angles → fractions of frames with hands in view, flat fingers, one-finger poking (`vision/camera.ts`, `HandStats`). Only these three numbers are sent with the answer; `coach.py` turns them into `cam_hands` / `cam_curve` / `cam_fingers`. Hand-tracking files are bundled (`frontend/public/mediapipe`).
* **Personal lines:** at lesson start a background thread asks the AI brain (when allowed) for praise/encouragement lines for this child and lesson (`prepare_phrase_pack`); they are safety-filtered, stored in `session.plan.pack` and mixed with the phrase bank. The lesson never waits. Greetings recall the last lesson (`feedback.recall`).
* **Learning path** (`path.py`): ordered chapters, each finished by evidence (3 successes at its activity, or the skill already at difficulty ≥ 3, or the whole song played); the first unfinished one is "next for you".

### 4b. Sound
`audio/synth.ts`: additive struck-string piano (stretched partials, hammer noise, brightness that decays), harmonium, phrasing (accent, legato), optional pure tuning from Sa. `audio/formant.ts`: a pure-DSP formant voice (glottal saw → formant cascade, consonant noise) that sings note names at exact pitch; unit-tested with the YIN tracker (every swar within 15 cents). `audio/speech.ts → pronounce()` respells swar names for the speech voice ("Ga" → "Gaa" / "गा") so it stops spelling them out.

## 5. Security

* Passwords: `hashlib.scrypt` (n=2¹⁴, r=8, p=1, 16-byte salt), constant-time compare.
* Sessions: HS256 JWT in an `httpOnly`, `SameSite=Strict` cookie (`Secure` in production); state-changing requests also require `X-Requested-With: melo` (CSRF defence in depth).
* Authorisation: every child/recording query is scoped by the authenticated parent id (no IDOR).
* Rate limiting on login/register; upload size and duration limits; strict pydantic validation with bounded lengths.
* Secrets: `KM_SECRET_KEY` and `KM_RECORDING_KEY` from env, or generated once into `data/` with restricted permissions.
* Security headers (CSP, X-Content-Type-Options, Referrer-Policy, Permissions-Policy limiting camera/mic to self).

## 5a. Languages
`languages.py` / `languages.ts` are the registry (name, note system letters | sargam | solfege, speech locales, RTL). Built-in languages live inline; every other language is a dictionary: `frontend/src/locales/<code>.json` (English text is the key, gettext-style, via `L()` / `t()` / `tr()`) and `backend/app/teacher/locales/<code>.json` (phrase key → lines, `phrases.pack`). Missing entries fall back to English. `scripts/i18n_template.py` extracts every string and reports coverage; tests check pack keys and placeholders.

## 5b. Language learning
`lang/content.py` (targets, letters, picture concepts × 11 languages) → `lang/engine.py` (pure: `choose`, `score`, `apply`, `summary`) → `routers/learn.py`. Stateless per activity: the server stores the pending `LangAttempt` with its answer, the client returns the choice, the recognised speech alternatives, the trace coverage / spill, or the built word. A "sitting" is the last 30 minutes of answers (used for re-teach and comfort). Speech synthesis and recognition for the target language run in the browser (`sayIn`, `listenIn` in `audio/speech.ts`); a Mandarin voice is never used for Cantonese.

## 6. Deployment

* **Desktop app:** `backend/melo_app.py` (free port, single instance, browser + small control window, log file) frozen with PyInstaller (`packaging/melo.spec`), wrapped by Inno Setup on Windows (`packaging/windows`), a `.dmg` on macOS and an AppImage / tarball on Linux (`packaging/build.sh`). When frozen, data defaults to the user profile and the web app is read from the bundle (`config.py`). CI: `.github/workflows/release.yml`.

* `scripts/setup.ps1` / `scripts/setup.sh`: create venv, install backend deps, `npm ci && npm run build`.
* `scripts/run.ps1` / `scripts/run.sh`: `uvicorn app.main:app` on `KM_HOST:KM_PORT` (default `127.0.0.1:8000`), serving the SPA at `/` and the API at `/api`.
* `Dockerfile` (multi-stage: node build → python slim runtime, non-root user, healthcheck) and `docker-compose.yml` with a data volume.
* Configuration via `.env` (see `.env.example`).

## 7. Learning-graph memory and the Claude Code connection

```
lesson answer / session end / recording analysed
        │ incremental upserts (memory.py)
        ▼
memory_nodes ─ memory_edges ─ memory_events      (per child, cascades on delete)
        │                         ▲
        │ overview / subgraph / timeline / search / recommend
        ▼                         │ add_note / set_focus_skill (write tokens)
Parent dashboard (Progress & memory)      MCP server (app/mcp_server.py)
                                           ├─ HTTP:  /mcp/  (Bearer token, DNS-rebinding protection)
                                           └─ stdio: backend/melo_mcp.py (KM_MCP_TOKEN)
                                                     ▲
                                           Claude Code: `claude mcp add melo …`
```

* The graph is a derived index (code-review-graph style): nodes `child, skill, activity, song, session, mistake, recording, note`, typed weighted edges, and an event timeline. `rebuild` regenerates it from raw tables and keeps parent notes.
* A focus set by a parent or Claude Code is honoured by the next session plan, but only if it is a skill the engine allows at the child's level.
* Personal access tokens (`api_tokens`) are per parent, hashed and revocable; tools only ever see that parent's children.

## 8. Roadmap hooks (Phase 4)
Instrument is a first-class field; the activity catalogue, scoring and analysis are instrument-agnostic on note events, so guitar/violin add a new input adapter + instrument-specific lessons rather than a rewrite. Alembic migrations should be introduced before the first schema change in production.
