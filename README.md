# Melo: AI Music Teacher for Kids (ages 3–8)

Melo is a patient, playful music teacher. It teaches through a virtual piano or a real keyboard (microphone + optional camera), listens to how the child plays and coaches it, adapts to what the child can actually do, speaks English, Hindi and Hinglish (Spanish, French, Chinese and Arabic in beta), and gives parents a dashboard, practice-recording reviews and a **learning-graph memory** that **Claude Code can connect to from the terminal**.

One Python process serves the API and the web app. It runs the same way on Windows and Linux, with no ffmpeg, GPU or cloud account required. With no API key, Melo uses its built-in offline teacher.

## Install (one click)

| System | File | How |
|---|---|---|
| Windows 10/11 | `Melo-Setup-1.3.0.exe` | Double-click. Installs for the current user (no administrator password), adds Start-menu and desktop shortcuts, starts Melo. |
| macOS 11+ | `Melo-1.3.0.dmg` | Open, drag Melo to Applications. The app is not signed with an Apple Developer ID, so the first time right-click it and choose **Open**. |
| Linux | `Melo-1.3.0-x86_64.AppImage` | Make it executable and double-click. Or unpack `Melo-linux.tar.gz` and run `./install.sh` (adds Melo to the applications menu, no root). |

Signed installers (no "unknown publisher" / "cannot check it" warnings): see [docs/SIGNING.md](docs/SIGNING.md).

Melo opens in your web browser (Chrome or Edge recommended) with a small "Melo is running" window to reopen or close it. Lessons, recordings and keys are kept in your user profile (`%LOCALAPPDATA%\Melo`, `~/Library/Application Support/Melo`, `~/.local/share/Melo`) and survive updates and uninstalling. No Python, Node or internet connection is needed to run it; hand tracking for the camera is bundled.

**Build the installers yourself** (on the system you are building for):

```powershell
powershell -ExecutionPolicy Bypass -File packaging\windows\build.ps1   # dist\Melo-Setup-1.3.0.exe  (needs Inno Setup: winget install JRSoftware.InnoSetup)
```
```bash
./packaging/build.sh        # macOS: dist/Melo-1.3.0.dmg   Linux: dist/Melo-1.3.0-x86_64.AppImage + dist/Melo-linux.tar.gz
```

`.github/workflows/release.yml` runs the tests and builds all three on GitHub when you push a tag such as `v1.3.0`.
In the installed app, Claude Code is used as the brain automatically when the `claude` CLI is on the computer and the parent turned **Cloud AI** on for the child; otherwise the built-in teacher is used. Optional settings go in a `.env` file in the data folder.

## Quick start (from source)

**Windows (PowerShell)**
```powershell
.\scripts\setup.ps1      # venv + backend deps + frontend build + .env
.\scripts\run.ps1        # http://127.0.0.1:8000
```

**Linux / macOS**
```bash
./scripts/setup.sh
./scripts/run.sh         # http://127.0.0.1:8000
```

**Docker**
```bash
docker compose up -d --build   # http://127.0.0.1:8000, data in the melo-data volume
```

Requirements: Python 3.11+ and Node.js 18+ (Docker needs neither). Open the app, create a parent account, add a child, and press **Start music time**.

### Use Claude Code as the brain (no API key)
If Claude Code is installed and logged in on this computer (run `claude` once), set `KM_AI_PROVIDER=claude_code` in `.env` and restart. Melo then calls `claude -p` for lesson plans, chat replies and recording feedback, using your Claude Code login. The CLI runs sealed: no tools, no MCP servers, no hooks, no saved session, and any API key is removed from its environment. Replies take about 4 s. `KM_CLAUDE_CODE_MODEL` defaults to `sonnet` (use `haiku` for speed). Turn on **Cloud AI** for each child in Settings. Any CLI error or timeout falls back to the offline teacher. This is meant for personal use on your own computer. If you offer Melo to other families, use an API key.

### Enable the Claude API teacher (optional)
Put `ANTHROPIC_API_KEY=sk-ant-...` in `.env` and restart. A Claude Code subscription does **not** include API access, so create a key in the Anthropic Console. Then turn on **Cloud AI** for each child in Settings; it is off by default. The default is `claude-opus-5-5` at `low` effort for fast replies, configurable with `KM_AI_MODEL` / `KM_AI_EFFORT`. Every AI call has a timeout and falls back to the offline teacher.

## Connect Claude Code to Melo's brain

In the app: **Connect Claude Code → Create token**. Copy one of the generated commands:

```bash
# A) Melo running (HTTP MCP)
claude mcp add --transport http melo http://127.0.0.1:8000/mcp/ --header "Authorization: Bearer melo_…"
# B) Direct (stdio, same computer, server not required)
claude mcp add melo --env KM_MCP_TOKEN=melo_… --env KM_DATA_DIR=<repo>/data -- <repo>/backend/.venv/<python> <repo>/backend/melo_mcp.py

claude mcp list
claude "Use the melo tools: how is Asha doing with rhythm, and what should we practise next?"
```

| Tool | What it returns |
|---|---|
| `list_children` | children on the account |
| `child_overview` | skills, strengths, struggles, songs, recent events, recommendation |
| `learning_graph` | neighbourhood of any node (depth 1–3, relation filter) |
| `search_memory` | nodes by label (songs, mistakes, notes …) |
| `progress_timeline` | level-ups, difficulty changes, sessions, recordings, notes |
| `recording_feedback` | latest practice analyses + feedback |
| `recommend_next_lesson` | focus skill and what's needed to unlock the next level |
| `curriculum`, `rebuild_memory` | reference data; rebuild graph from raw data |
| `add_note`, `set_focus_skill` | **write tokens only**: annotate memory, steer the next lessons |
| prompt `weekly_report` | warm weekly report for parents |

Tokens are per parent, stored hashed, revocable, and read-only unless you tick *allow changes*. Audio and video are never exposed.

### The learning graph
Nodes: `child, skill, activity, song, session, mistake, recording, note`. Edges: `HAS_SKILL, PRACTICED, TRAINS, ATTENDED, INCLUDED, LEARNING, LEARNED, RECORDED, OF_SONG, REVEALED, STRUGGLES_WITH, STRONG_AT, ABOUT`, plus a timeline of events. It updates on every answer, lesson end and recording analysis, and can be rebuilt from raw tables at any time. Parents can browse it under **Progress & memory**.

## What's inside

| Area | Implementation |
|---|---|
| Curriculum | 4 levels, 9 activity types (high/low, loud/soft, instrument guess, rhythm tap, find the note, same/different, echo melody, play a song, free composing), 7 public-domain songs incl. *Sa Re Ga Ma* |
| Adaptive engine | per-skill mastery + difficulty 1–5. A new skill starts in *placement*: every success steps up, so a child who already knows it is not kept on beginner items. After that, 2 successes in a row → harder, 2 misses → easier. A missed item comes back once with more help before moving on. 3 successes in a row earn one item from the next level, and 2 passes there open that level early. 3 misses → break or easy game, 2 skips → game. Parents can also set the level |
| Learning path | 15 chapters on the child's home screen with one clear "next for you"; chapters the child already masters are ticked off automatically |
| A teacher that listens | With microphone permission Melo hears a real keyboard in every mode. It reacts to each note (which way to move after a wrong key), then coaches how the part was played: hesitation before a note, a long note cut short, rushing, uneven notes, a steady beat (specific praise), an instrument too quiet to hear. Trouble spots get **spot practice**: just those 2–3 notes, slowly, twice, then the part again. In real-keyboard mode the camera adds hand-shape tips (curved fingers, more than one finger, hands in view) |
| How Melo plays | Struck-string piano or harmonium, flute, plucked-string guitar and sitar (physically modelled), violin, santoor, xylophone, kalimba, tabla, bells; phrasing with accents and legato; keyboard tuning or Indian pure tuning; swar names pronounced properly by the speech voice; optional sung note names (experimental synthetic voice, off by default) |
| Languages | English, Hindi, Hinglish built in; Spanish, French, Chinese, Arabic (right-to-left) as beta packs. Note names follow the language: C D E, Sa Re Ga or Do Re Mi. Adding a language = two JSON files, see below |
| Uncertainty | `uncertain` outcomes (noisy mic, low pitch confidence, camera disagreement) never count against the child |
| Real instrument | in-browser YIN pitch tracker, ignores Melo's own voice and demo audio, octave-tolerant scoring; MediaPipe hand tracking after a one-time keyboard calibration (frames stay on the device) |
| Recordings | up to 10 min, converted to 16 kHz WAV in the browser, encrypted at rest (Fernet), analysed on the server: note segmentation, song identification (transposition-invariant), accuracy, beat steadiness, tempo, hesitations, recurring mistakes, progress vs the previous take, plus a 3-step mini-lesson |
| Parent dashboard | profiles, language, mode, lesson length, reminders, consent toggles with audit history, progress, memory graph, recordings, delete recordings / progress / child / account |
| Safety | parental consent enforced server-side; child-safety filter on all AI text; child's name never sent to the AI; parent gate to leave child mode |

## Learning languages (listen, speak, read, write)

**Languages** on the child's home screen teaches 20 languages: English, Hindi, Marathi, Sanskrit, Gujarati, Bengali, Punjabi, Tamil, Telugu, Kannada, French, Spanish, German, Arabic, Chinese (Mandarin), Cantonese, Japanese, Korean, Russian and Turkish, through pictures: 38 words and short sentences per language in 5 tiers, plus each language's first letters or characters. Melo explains in the child's own language and says every word in the language being learned.

| Skill | Activities, easiest first |
|---|---|
| 👂 Listen | hear a word → tap its picture (2, then 3, then 4 choices; similar words at the top levels) |
| 🗣️ Speak | Melo says it, the child repeats → later the child says it from the picture alone (needs microphone permission and Chrome or Edge) |
| 📖 Read | hear a letter → find it → **barakhadi** for Indian scripts (क का कि की …: the same letter with each vowel sign) → read a word and pick its picture → pick the written word for a picture → read Melo's question and pick the right reply |
| ✍️ Write | trace letters with a finger (guide shown, then fainter) → trace syllables → build words from letter tiles → tiles with extra letters → build whole sentences from word tiles |
| 💬 Talk (top level) | Melo asks a real question in the language ("What is your name?", "How are you?") and the child picks or says the answer |

Each skill has its own stage 0–5 (the scale shown as stars); the language's stage is the lowest of them, so a child "passes" a stage only when listening, speaking, reading and writing are all there. The engine is the same as for music: a child who already knows the language climbs a stage per right answer at first, two in a row step up afterwards, two misses step down. Every word has its own memory, so weak and new words come up more often and a new tier opens when three quarters of the current one is known. A missed word comes straight back as an easy listen-and-pick; two misses in a row bring an easy known word and a comforting line. Speech recognition is judged generously and "I couldn't hear you" is never a mistake. There is no timer; the child can replay any word slowly or ask for another one.

**Conversations.** Six everyday topics, five phrases each: greetings, meeting someone, polite words, directions, food and drink, asking for help ("Where is the toilet?", "Turn left.", "I don't understand.", "Slowly, please." …). Pick a topic with the chips in a language lesson; the same adaptive engine then teaches only those phrases. Writing a phrase means putting its words in order (characters for Chinese and Cantonese); at the easy levels the phrase is shown to copy, later it is only heard, and at the hard levels extra words that do not belong are mixed in.

**Side by side** (🔀 *Compare languages*, also linked from the parent dashboard): choose up to 4 languages and a topic (or the picture words) and see the same phrases next to each other, each with its pronunciation. Every cell can be heard (normal or slow), said into the microphone, or written; ▶ *All* plays a phrase in each chosen language one after another, and *Hide the words* turns the table into a memory test. Practice here counts toward the child's progress like any lesson.

Word lists live in `backend/app/lang/content.py` and phrases in `backend/app/lang/phrases.py` (one list per language). They were written by the AI and need a native-speaking teacher's review before you rely on them.

## Adding a language

1. Register it in `frontend/src/languages.ts` and `backend/app/languages.py` (name, note-name system, speech locales, right-to-left).
2. `python scripts/i18n_template.py <code>` writes `frontend/src/locales/<code>.json` (English on-screen text → translation) and `backend/app/teacher/locales/<code>.json` (phrase key → lines Melo speaks). Fill in the empty values.
3. `python scripts/i18n_template.py` reports what each language still lacks. Anything missing shows in English, so a partial pack is safe.

The beta packs (es, fr, zh, ar) were machine-translated: all 86 spoken phrases and the child screens are done, the long Music Basics explanations are still English. Have a native-speaking teacher review them before promoting a language out of beta (`beta: true` in `languages.ts`).

## Development

```bash
# backend (from backend/)
.venv/Scripts/python -m pytest          # Windows   (.venv/bin/python on Linux)
.venv/Scripts/python -m uvicorn app.main:app --reload
# frontend (from frontend/)
npm run dev      # Vite on :5173, proxies /api to :8000
npm test         # vitest
npm run build    # typecheck + production build
```

API docs: `http://127.0.0.1:8000/api/docs` (disabled when `KM_ENV=production`).

## Operations

* **Data:** from source everything lives in `data/`; the installed app uses the per-user folder above. In both cases the folder holds (`melo.db`, `recordings/`, `.secret_key`, `.recording_key`). Back up the whole folder. Without `.recording_key`, stored recordings cannot be decrypted.
* **Network access:** set `KM_HOST=0.0.0.0`. For anything beyond a trusted home network, put Melo behind HTTPS (Caddy/nginx) and set `KM_COOKIE_SECURE=true`. Cookies are marked Secure automatically on HTTPS requests.
* **Linux service:** see `scripts/melo.service`.
* **Workers:** run one worker. SQLite, background analysis and the rate limiter are single-process by design.

See `docs/ARCHITECTURE.md` for the design and `docs/REVIEW.md` for the review and optimisation report.

### A teacher who feels, not a quiz machine

The server decides how Melo *feels* about each answer (`backend/app/teacher/emotion.py`), and the app shows it in the face, the voice and a small sound (`frontend/src/emotion.ts`):

| Moment | Melo |
|---|---|
| Right answer | excited voice (a bit quicker and higher), a sparkle, praise for what the child did well ("Your ears are so sharp!", "You read that all by yourself!") |
| 3 / 5 in a row | claps, "Three in a row!", then a dance with confetti at five |
| Right after a miss | proud: "You kept trying and you got it!", the most important thing a teacher praises |
| First miss | playful "Oopsie, that one was sneaky!" with a soft "uh-oh" sound: mistakes feel normal |
| Second miss in a row | sad, caring face, slower, softer, lower voice: "This is a hard one. We'll do it together." No sound. Then an easier one |
| Child goes quiet | after ~14 s a warm "take your time", after ~28 s Melo says the word again, slowly |
| New stage | celebration, confetti, fanfare |

The same reactions are used in the music lessons. Every language shows its **journey** (🌱 Sound Seeker → 🔤 Letter Explorer → 🧱 Word Builder → 📖 Sentence Reader → 🏆 Little Pro), what each stage means for listening, reading, writing and speaking, and a tip for parents and teachers to practise at home.

### Progress tracker, parent chat and AI brains

* **Progress tracker** (Parent → child → Progress): spider charts for music, every language and learning habits, updated after every activity. Each score is 80 % measured from the child's activities and 20 % assessed by a teacher, a parent or the AI teacher. Filter by area or by one skill everywhere (Reading, Writing, Speaking …), search the 230 assessment parameters, and get a summary with the next lesson plan. Children see their own **star map**.
* **Talk to Melo** (Parent → child → 💬): tell Melo what you want ("add the Mahamrityunjaya mantra", "she gets frustrated, go gently", "market phrases in Hindi"); Melo proposes changes and you tap Apply. Conversations are remembered with a running summary.
* **AI brain** (Parent → 🧠 AI brain): Claude Code, Ollama (`ollama pull llama3.2`), LM Studio / llama.cpp / Jan, or an online service with your own key. Includes a 🩺 system check. Melo also works fully offline.
