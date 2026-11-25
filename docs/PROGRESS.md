# Melo: App Progress

_Last updated: 2026-11-22_

Melo is an AI music teacher for children aged 3–8, built with FastAPI, SQLite and a React/Vite SPA. It works offline by default, can use Claude optionally, and exposes a learning-graph memory to Claude Code over MCP. See `README.md`, `docs/ARCHITECTURE.md` and `docs/REVIEW.md`.

## Status at a glance

| Area | Status |
|---|---|
| MVP scope (MVP.txt phases 1–3) | ✅ Built |
| Backend tests (`pytest`) | ✅ 208 passed |
| Frontend typecheck (`tsc -b`) | ✅ Clean |
| Frontend tests (`vitest`) | ✅ 191 passed |
| Sound and microphone | ✅ Audio unlocks on the first tap. Settings has a 🔊 Sound check and a 🎤 Mic check, and browser mic permission is requested when the parent turns it on. ⏳ Needs a by-ear check in a real browser |
| Production build | ✅ 391 kB JS (131 kB gzip) + lazily loaded 136 kB MediaPipe chunk |
| Local deployment | ✅ Running at http://127.0.0.1:8000 (`KM_ENV=production`) |
| AI teacher | ✅ Any brain: Claude Code CLI, Claude API, Ollama, OpenAI-compatible (local or online); chosen in the app; offline fallback always |
| Code-review graph | ✅ Rebuilt 2026-11-22: 174 files, 1,901 nodes, 22,551 edges, 19 communities (`.code-review-graph/graph.db`, visualization at `.code-review-graph/graph.html`) |
| Phase 4 (guitar / violin) | 🟡 Melo plays 12 instruments (violin, sitar, santoor, tabla … added 2026-11-17); a real-instrument input adapter for chords is still to do |

## Feature checklist

- [x] Parent accounts (scrypt, httpOnly session cookie, CSRF header, rate limits)
- [x] Child profiles: age, avatar, language (EN / HI / Hinglish), mode, lesson length, reminders
- [x] Consent toggles enforced server-side with an audit history
- [x] Curriculum: 4 levels, 9 activity types, 7 public-domain songs
- [x] Adaptive engine: per-skill mastery, difficulty 1–5, break/game rules, level unlocks
- [x] Virtual piano and real-keyboard mode (in-browser YIN pitch tracker plus optional MediaPipe hand tracking)
- [x] Practice recordings: encrypted at rest, analysed on the server (song ID, accuracy, tempo, hesitations), 3-step mini-lesson
- [x] Parent dashboard: progress, memory graph browser, recordings, delete controls
- [x] Learning-graph memory with incremental updates and full rebuild
- [x] MCP server (HTTP `/mcp/` and stdio `backend/melo_mcp.py`) with per-parent hashed tokens
- [x] Optional Claude teacher: schema-constrained output, 12 s timeout, child-safety filter, offline fallback
- [x] Claude Code CLI brain (no API key): sealed `claude -p` (no tools, MCP or hooks, API key scrubbed), JSON-schema output, 30 s timeout. Verified live on 2026-11-04: lesson plan and chat, in Hinglish and English
- [ ] Alembic migrations (needed before the first schema change on a live install)
- [ ] Hard parent gate (the browser back button can still leave child mode)
- [ ] Phase 4 instruments

## Local deployment (verified 2026-11-04)

```powershell
.\scripts\run.ps1          # serves the API and the built SPA on http://127.0.0.1:8000
```

The frontend was rebuilt (`npm run build`) before starting. The live smoke test ran against the running server, and its test account was deleted afterwards.

| Step | Result |
|---|---|
| `GET /api/health` | `{"status":"ok","ai":"offline"}` |
| `GET /` (SPA) | 200 |
| Register parent → add child | 201 / 201 |
| Start lesson → 6 activities (high/low, loud/soft, instrument guess) | Scored correctly: 3 successes, 3 misses with gentle feedback |
| End lesson | 3 stars, summary returned |
| Memory graph after the lesson | 11 nodes / 11 edges (it had 8 / 7 before any answers) |
| Create MCP token → JSON-RPC `initialize` on `/mcp/` | OK, capabilities returned |
| CSRF guard (missing `X-Requested-With: melo`) | 403 as expected |
| Invalid answer payload | 400 with a validation message |
| Delete account | 204 |

**To try it by hand:** open http://127.0.0.1:8000, create a parent account, add a child, then press **Start music time**. To stop the server, press Ctrl+C in its terminal.

## Code-review graph

Built with `code-review-graph` 2.3.9 (Tree-sitter knowledge graph, stored in `.code-review-graph/`, which is git-ignored).
`.code-review-graphignore` excludes `frontend/dist`, `node_modules`, `.venv`, `data/` and caches. Before this was added, the minified bundles contributed about 1,000 noise nodes.

| Metric | Value |
|---|---|
| Files | 174 (Python, TS/TSX, PowerShell, Bash) — rebuilt 2026-11-22 |
| Nodes / edges | 1,901 / 22,551 |
| Communities | 19; 20 coupling warnings |
| Execution flows | 78 (highest criticality: `register`) |
| Source size | ~4.6k lines Python, ~3.0k lines TS/TSX |

### Communities (largest first)

| Community | Size | Language | Cohesion |
|---|---|---|---|
| app-child (models, engine, memory, security) | 184 | Python | 0.21 |
| tests-ai | 66 | Python | 0.24 |
| pages-load (React pages) | 56 | TSX | 0.14 |
| audio-note (synth, pitch, speech) | 55 | TS | 0.24 |
| routers-memory | 51 | Python | 0.04 |
| src-session (api.ts, session state) | 32 | TS | 0.11 |
| teacher-ai | 23 | Python | 0.19 |
| audio-wav (server DSP) | 19 | Python | 0.07 |
| vision-calibration | 15 | TS | 0.29 |
| activities-activity | 13 | TSX | 0.09 |
| components-melo | 11 | TSX | 0.11 |
| hooks-use | 2 | TS | 0.05 |

### Review findings from the graph

**Coupling hotspots.** The strongest is `app-child` ↔ `routers-memory` with 159 edges. Routers reach straight into models, the engine and memory. This is acceptable at the current size. If the routers grow, a thin service layer between routers and the engine/memory would make changes less risky.

**Largest functions (refactor candidates):**

| Lines | Symbol | Location |
|---|---|---|
| 209 | `LessonRunner` | `frontend/src/pages/Lesson.tsx:28` |
| 138 | `NotesActivity` | `frontend/src/activities/NotesActivity.tsx:13` |
| 113 | `Settings` | `frontend/src/pages/Settings.tsx:12` |
| 111 | `ProgressPage` | `frontend/src/pages/ProgressPage.tsx:11` |
| 110 | `playNote` | `frontend/src/audio/synth.ts:45` |
| 78 | `build_server` | `backend/app/mcp_server.py:119` (mostly tool registrations) |
| 68 | `choose_next` | `backend/app/engine.py:175` |

`LessonRunner` is the clearest candidate. Its state machine (speaking, locked, answering, feedback) could move into a `useLesson` hook.

**Dead code (verified with grep, so only real hits are listed):**

| Symbol | Location |
|---|---|
| `list_activity_types` | `backend/app/engine.py:245` |
| `midi_name` | `backend/app/audio/analysis.py:33` |
| `_intervals` | `backend/app/audio/analysis.py:181` |
| `reset_store` | `backend/app/storage.py:59` |
| `reset_teacher` | `backend/app/teacher/service.py:313` |
| `setVoiceEnabled`, `isVoiceEnabled` | `frontend/src/audio/speech.ts:11-12` |

The other 12 candidates the tool reported are false positives: FastAPI and MCP decorator registrations (`api_not_found`, `weekly_report`), JSX event handlers (`onKey`, `copy`, `create`, `begin`, `click`, `voice`), and `ApiError`, which is thrown internally. None of the dead code was removed in this pass.

### Using the graph

```bash
code-review-graph update               # incremental refresh after edits
code-review-graph impact               # blast radius of the current changes
code-review-graph architecture         # communities + coupling warnings
code-review-graph dead-code
code-review-graph visualize --mode community   # writes .code-review-graph/graph.html
code-review-graph install              # optional: register the graph as an MCP server for Claude Code
```

## Update 2026-11-04 (evening)

| Change | Detail |
|---|---|
| 🧠 **Test Claude Code** button | On the Dashboard and the Connect Claude Code page (`POST /api/teacher/test`). It makes one real call to the brain and shows the model, response time and Melo's reply, or the exact problem (for example "Not logged in"). |
| 📈 **Level progression fix** | A real child (age 3) had **0 rhythm attempts** after 3 lessons, so Level 2, where songs start, could never unlock. Three fixes: (1) skills still needed for the next level get selection priority; (2) a skipped new activity counts as tried, so it no longer blocks other new activities; (3) a skill counts as shown at 70% mastery **or** 60% right overall, so one unlucky miss doesn't re-lock the level. Simulated results: an 80%-correct child reaches Level 2 in 3 lessons instead of 7, and a 70%-correct child in 4 (before, 4 of 20 simulated children were stuck after 15 lessons). Struggling children still have to show the skills. |
| 🎂 **Song school** ("Learn a song" on the child's home screen) | Happy Birthday (with the child's name), Gayatri Mantra (simple Sa–Pa chant, Devanagari words for Hindi), Sa Re Ga Ma, Twinkle, Row Your Boat, London Bridge, Hot Cross Buns, Mary Had a Little Lamb, Jingle Bells, Ode to Joy, Old MacDonald. Each part: Melo plays it (keys and words light up), the child plays the glowing keys, and Melo gives specific feedback ("You played Sa, try Pa, to the right"). After 2 misses Melo plays it slower. Once every part is learned, the child plays the whole song. Progress is kept per song, and attempts feed melody mastery, stars and the memory graph. |
| 🦉 **Livelier Melo** | Shading and depth, breathing, natural blinking, eyes that look around (down at the keys while listening), the beak moving with each spoken word, plus nodding, gestures, a cheer for a success, a kind lean-in after a miss, and thinking dots. Respects reduced-motion settings. |
| 🗣️ **Indian voices** | Ranks the installed voices and prefers natural neural ones (Edge: Swara for Hindi; Neerja for Indian English and Hinglish), then Google Hindi, then the Windows voices. Speaks sentence by sentence with natural pauses and rising/falling pitch. Settings has a voice picker with a preview, per device. |
| 💬 **Less robotic wording** | Feedback lines grew from 1–2 to 5–6 versions per language, and Melo never says the same sentence twice in a row. The Claude prompt now asks for a one-on-one teacher style (react, ask a small question, use sargam, vary the wording). |

| 🎼 **Note path: what to press and when** | A strip above the piano with one block per note, in its key's colour, showing the note name (sargam or letters) and the song word. Block width = note length, with one dot per beat and "hold" on long notes. A light moves through the blocks in time while Melo plays. Used in the song school, lesson songs/echo (only where the keys are already shown) and the compose screen. |
| 🥁 **Two ways to play** | **🐢 Wait for me** (default under 6): the next key glows and waits for the child. **🥁 With the beat** (default 6+): a "3, 2, 1, Go!" count-in with ticks, then the light moves at the song's tempo with a soft tick per note. Melo explains each mode the first time. |
| 🎨 **Make a tune** (was "Free piano") | Spoken and visual 3 steps (press keys one by one, a quick tap is a short note and a wait is a long one, press ▶ to hear it), 4 ideas to copy (climb up, slide down, frog jumps, long and short) with glowing keys, and the child's own tune shown as a note path **with their real timing**, played back with that rhythm. |

| 🌱 **Fading help (scaffolding)** | Each part of each song has a help level that the server works out from the child's history: **🧭 Full help** (new: Melo explains, demonstrates, every key glows, note names shown) → **👣 Some help** (after 1 pass: no explanation, demo and glow stay) → **🌱 Little help** (after 2 passes: no automatic demo, only the first key glows, note names show "?") → **🌟 From memory** (whole song played well twice: no glow, no note path). A miss steps back up one level straight away; 🙋 **Help me** and **Hear it** bring full help back for that part; 2 misses replay it slower with keys shown. A child who knows a song starts straight on the whole song. Tests: `test_support_level_rules`, `test_song_school_help_fades_and_returns`. |

| 🎧 **Hear the whole song, then learn** | A new song (or one opened with **🎧 Hear the whole song** on its card) starts with Melo playing the full tune while the whole note path and every word light up. Then Melo says "Now let's learn it, one part at a time!" and teaching begins. The same button is on the song screen at any time, with ⏹ Stop. Fixed along the way: `playSequence().cancel()` only stopped the visuals and the scheduled notes kept sounding; each sequence now has its own volume bus that fades out on cancel. |

| 📚 **Music Basics** (child home → "Music basics") | 9 topics, each with **📖 Learn** (Melo explains, plus a hands-on explorer) and **🎯 Practice** (a scored drill of that topic only, adaptive, counts toward mastery and levels, back to Basics afterwards). ★ stars per topic come from skill mastery. **Swars:** tap Sa…Sa' (with C D E for English), aaroh/avroh with note path and piano. **Rhythm:** Ta / Ti-ti / Ta-a cards with beat dots, and a clap-along drum with live "on the beat / a bit early / a bit late" feedback. **Taal:** Dadra (6) and Keherwa (8) with bols, sam ✋, khali 👋 and divisions (vibhag). **High & low, Loud & soft, Fast & slow:** paired examples (🐦/🐘, 🦁/🐱, 🐇/🐢). **Instruments:** hear each voice. **Music ears:** same or different. **Alankars:** Aaroh & Avroh, Alankar 1 (Sa Re Ga, Re Ga Ma…) and Alankar 2 (Sa Sa, Re Re…) open in the song school with fading help. Backend: `TOPICS` + `topic` on session start (instant plan, no AI wait), new Basics-only `fast_slow` activity (tempo), alankars kept out of regular lesson songs. 3 API tests. |

| 🗂️ **Basics on one screen** | Compact topic grid (fits one screen, ★ stars + tier icon). Topic page: topic tabs across the top; Melo, tier progress and Learn/Practice in a side panel; the explorer split into small tabs (e.g. Swars: Saptak · High & low · Komal & tivra · ✨ Made for you) instead of a long scroll. Stacks neatly on phones. |
| 🌱🌿🌳 **Content that grows with the child** | Each topic has a tier from its skill mastery (`app/basics.py`: tier 2 = 55% over 8 tries, tier 3 = 75% over 16). Locked tabs show 🔒 until earned. **Swars:** T2 mandra/taar saptak (.Pa … Pa'), T3 komal/tivra swars taught through thaats (Bilawal, Yaman, Kafi, Bhairav). **Rhythm:** T2 Ti-ri-ki-ta and rests, T3 faster clap-along. **Taal:** T2 Rupak (7, starts on khali), T3 Teentaal (16). |
| ✨ **Exercises made for the child** | `POST /api/children/{id}/basics/{swars,alankars}/exercise`: the AI brain (Claude Code) designs the next sargam exercise, a small step harder, using only the swars allowed at the child's tier (schema enum). The server validates the range, length and beats, and computes the words itself. Off-range or failed output falls back to the offline generator. An unfinished exercise is reused, and a new one is made automatically when all are finished. Taught in the song school with fading help. **Claude Code in the terminal (MCP):** `basics_status` (tiers, allowed swars, exercises) and `add_exercise` (write token). Live: Claude Code wrote "Chhota Seedhi Chadho" (Sa Re Ga Ma / Re Ga Ma Pa / Ga Ma Pa Dha) with a Hinglish intro in 4 s. 6 tests (`tests/test_basics.py`). |

## Making Melo feel like a real one-on-one teacher (analysis and roadmap)

**Why it still feels partly robotic:**
1. **Per-answer feedback is pre-written.** Claude is used only for the lesson plan, chat and recording feedback, because a ~4 s CLI call after every tap would be too slow for a small child.
2. **Melo never sings.** Real teachers sing with the child (sargam, song words). Browser speech can't sing.
3. **Quiz-style activities.** "Which sound is higher? Tap it" is a test. Teachers use stories, movement, call-and-response and play-along.
4. **No memory in the moment.** A teacher says "Yesterday you found Ga, let's find it again!"
5. **No live listening during play.** On screen it scores only at the end; a teacher reacts mid-phrase ("yes… yes… now the high one!").

**Roadmap (highest impact for the effort first):**
1. **Claude phrase pack per lesson:** one background Claude call at lesson start writes ~30 personalised lines (praise, hints, story beats, callbacks to past progress), so feedback during the lesson is personal with no wait. ~1 day.
2. **Memory callbacks:** greetings and transitions from the learning graph ("Last time you learned part 2 of Happy Birthday!"). The song school already does this; extend it to lessons. ~½ day.
3. **Melo sings:** a soft "ooh" voice in the synth plays the melody while the words light up, and the child sings along. ~1 day.
4. **Real-time encouragement:** react on every correct note during a phrase (small chirp, Melo nods, "yes!"). ~½ day.
5. **Story lessons:** themed 5-minute stories (jungle, rain, Diwali) that link the activities ("help the elephant find the low note"). ~2 days.
6. **Rhythm with the body:** clap-along through the mic, plus "stomp / clap / pat" games. ~1 day.
7. **Neural voice option:** an optional higher-quality TTS (for example Azure or ElevenLabs Hindi voices) for a truly human voice. It needs an account and key, so it's off by default.
8. **More instruments:** a tabla/drum pad and a harmonium sound (MVP phase 4: guitar and violin).

## Next steps (suggested order)

1. Turn on **Cloud AI** for each child in Settings so the Claude Code brain is used. It is off by default for privacy.
2. Remove the 7 dead symbols listed above, or wire up the voice toggle if it was meant to be used.
3. Extract a `useLesson` hook from `LessonRunner`.
4. Add Alembic before any schema change.
5. Harden the parent gate (history-API trap for the back button).
6. Phase 4: guitar and violin input adapter.

## Update 2026-11-16: a teacher that plays, listens and moves on (v1.1.0)

Reported: the teacher feels robotic; new material does not come when the child already knows something and difficulty does not change; the teacher cannot see or hear and suggest changes; swar names such as "Ga" are spoken badly; more languages are coming; one-click installers are needed.

**What the data showed** (the real 3-year-old profile): stuck on level 1 after 12 sessions because rhythm had 0 scored tries (one skipped item), although pitch was at 76% and melody at 86% with songs played in the song school; mode was "screen", so the microphone and camera (both allowed) were never switched on; difficulty needed 3 successes in a row per skill and 3-minute lessons rarely gave that.

| Area | Change |
|---|---|
| Progression | Placement fast lane, 2-in-a-row step up, re-teach after a miss, stretch items and early level unlock, skill "proven" at difficulty ≥ 3, wider rhythm timing for ages ≤ 5, parent-set level, quicker Basics tiers. New learning path (15 chapters) on the child's home screen |
| Listening | Microphone listens to a real keyboard in every mode; live "a little to the right / left" after a wrong key; coaching on hesitation, held notes, rushing, evenness, quiet instrument; spot practice on the trouble notes; camera hand-shape tips; specific feedback lines; greeting recalls the last lesson; background personal lines from the AI brain |
| Sound | Realistic piano, harmonium, phrasing, tuning choice, swar pronunciation fix, optional sung note names |
| Languages | Registry + dictionary packs; es / fr / zh / ar beta packs; RTL; `scripts/i18n_template.py` |
| Install | Desktop launcher, PyInstaller spec, Windows installer (built and smoke-tested here: `dist/Melo-Setup-1.1.0.exe`), macOS / Linux build script and CI workflow (written, **not yet run on those systems**) |

**Still to check by a person:** listen to the new piano / harmonium and the sung voice; try a real keyboard with the microphone (coaching thresholds are tuned on synthetic timings); camera hand tips with a real child; run the Windows installer on a clean PC; run `packaging/build.sh` on a Mac and a Linux PC; native review of the four beta languages and translation of the Music Basics explanations.

**Claude Code auto-detection (2026-11-16, later):** `find_claude_cli` looks on PATH and in the usual install folders (`~/.local/bin`, npm global, Homebrew ...), because an app started from an installer or the desktop can have a shorter PATH than a terminal. `/api/teacher/status` reports `claude_code_found`. The parent dashboard then asks once: "Claude Code found on this computer. Let Melo use it for <children>?" Allow first makes one real call (is it logged in?), then turns Cloud AI on for those children; "Not now" hides the question on that device. 98 backend tests.

## Update 2026-11-16: language learning (v1.2.0)

New **Languages** area: listen, speak, read and write for 11 languages (en, hi, mr, fr, es, ar, zh, yue, ko, ru, tr).

| Piece | Where |
|---|---|
| Content: 38 picture concepts in 5 tiers per language (native text + romanisation), first letters / characters | `backend/app/lang/content.py` |
| Adaptive engine: per-skill stage 0–5, placement, step up / down, per-word memory, tier unlock, re-teach, comfort after two misses, generous speech judging | `backend/app/lang/engine.py` |
| API: `/api/learn/languages`, `/api/children/{id}/learn[/{lang}]`, `.../next`, `.../attempts/{id}/answer`; tables `lang_skill_states`, `lang_item_states`, `lang_attempts` (created automatically, deleted with the child, cleared by Reset progress) | `backend/app/routers/learn.py`, `models.py` |
| Screens: language picker with stages, lesson runner, picture choice, speak (browser speech recognition), trace pad (canvas, coverage and spill), letter tiles | `frontend/src/pages/Learn.tsx` |
| Teacher: language lines in en / hi / hinglish; AI prompt asks for patience with shy, late-talking or slower children | `teacher/phrases.py`, `teacher/service.py` |

Tests: 11 backend (`tests/test_learn.py`) and 1 frontend (trace scoring). Installer rebuilt: `dist/Melo-Setup-1.2.0.exe`.

**Not yet verified / known limits**
- The screens were type-checked and built, but not clicked through in a browser by a person.
- Word lists and romanisations were written by the AI: needs native review, especially Cantonese (Jyutping), Marathi and Arabic.
- Speaking needs Chrome or Edge with internet (browser speech recognition) and a voice for the language installed for Melo to say words (Edge has all 11; Cantonese and Marathi voices are missing on many systems, and the app says so).
- Tracing checks that the letter is covered, not stroke order.
- Language-lesson teacher lines are English for Spanish / French / Chinese / Arabic interface languages until those packs are extended.
- Language progress is not yet in the parent dashboard or the learning-graph memory / MCP tools.

## Update 2026-11-17: conversations and side-by-side languages (v1.3.0)

| Piece | Where |
|---|---|
| 30 everyday phrases in 6 topics (greetings, meeting, polite, directions, food, help) × 11 languages, with romanisation for non-Latin scripts | `backend/app/lang/phrases.py` |
| Topic mode in the engine (`choose(topic=…)`, shared `build()`), writing a phrase from word tiles (`pieces()`: words, or characters for zh / yue; punctuation ignored when judging) | `backend/app/lang/engine.py` |
| `GET /api/learn/compare?langs=a,b,c,d&topic=…&ui=…` (1–4 languages; meaning in the child's language, Latin Hindi for Hinglish) and `POST /api/children/{id}/learn/{lang}/practice` (one chosen item and skill, scored like any activity) | `backend/app/routers/learn.py` |
| Topic chips with per-topic progress in the lesson; **Side by side** page: pick 4 languages, hear / slow / say / write each cell, play all, hide-the-words test, phone layout | `frontend/src/pages/Learn.tsx`, `frontend/src/pages/Compare.tsx` |

Tests: 6 new backend tests (`tests/test_conversations.py`), 115 in total. **Checked in a real browser** (throwaway copy, Hinglish child): the compare page with English / Hindi / Spanish / Chinese, writing 你好 from the tiles (cell turns green, progress recorded), and a Spanish *Directions* lesson; no console errors. Not checked: the phone layout (the window could not be resized), speaking (needs a microphone), voices by ear.

Phrases are AI-written like the word lists: native review needed, especially Cantonese, Marathi and Arabic. Some phrases have one natural form that is gendered (e.g. Arabic "ana aasif", Spanish/French "content"); a teacher may want both forms.

## Update 2026-11-17: a teacher who feels, 20 languages, beginner-to-pro journey, more instruments

**What a real one-on-one teacher does that Melo did not:** reacted with the same "Wow!" every time; sounded the same whether the child was on a roll or struggling; never noticed a child who went quiet; praised "correct" instead of what the child did well or their effort; and gave no picture of where the child was going.

| Area | Change | Where |
|---|---|---|
| 🎭 Emotions | Every answer gets an emotion (celebrate, excited, proud, warm, playful, empathetic, curious, calm, surprised), an energy level and a small sound. Streaks (3, 5), comebacks after a miss, a playful first slip, a gentle second miss, specific praise per skill | `backend/app/teacher/emotion.py`, `routers/learn.py`, `frontend/src/emotion.ts` |
| 🗣️ Emotional voice | Speed, pitch and loudness change with the emotion (strongest on the first sentence, then settling), longer pauses when gentle, tiny natural variation so a line never sounds the same twice | `frontend/src/audio/speech.ts` |
| 🦉 Avatar | New moods: proud (puffed chest, medal), dance (party), surprised (wide eyes, open beak), curious (head tilt, one brow), sad (heavy lids, droopy tufts, kind pat). Pupils widen when engaged. Confetti for milestones. Reduced-motion respected | `components/Melo.tsx`, `styles.css` |
| 👀 Notices a quiet child | After ~14 s without a tap: "Take your time, I'm right here". After ~28 s: says the word again, slowly | `pages/Learn.tsx` |
| 🎵 Music lessons too | Same reaction rules in the music lesson (clap for a streak, proud after a comeback, soft "uh-oh", caring face) | `pages/Lesson.tsx`, `emotion.ts` |
| 🌏 9 new languages | Sanskrit, Gujarati, Bengali, Punjabi, Tamil, Telugu, Kannada, German, Japanese: 38 words, 30 phrases, letters each (20 languages in all) | `lang/content.py`, `lang/phrases.py` |
| 🔤 Devanagari & Indian scripts | Barakhadi (क का कि की कु कू के कै को कौ कं) generated for all 9 Indian-script languages from the shared Unicode layout; read (hear a syllable, pick it from the same letter with other vowel signs) and write (trace syllables) at stage 2. Conjuncts kept together in every Indian script; Tamil dead consonants written apart | `lang/content.py` (`BARAKHADI`), `lang/engine.py` |
| 🏆 Beginner → pro | Journey of 5 stages with what each means for listen / read / write / speak and a home tip for parents and teachers. Top level: little conversations (Melo asks "How are you?", the child picks or says the answer) and building whole sentences from word tiles | `lang/engine.py` (`JOURNEY`, `reply_activity`), `pages/Learn.tsx` |
| 🎻 Instruments | Physically modelled plucked strings (Karplus-Strong) for guitar and a new sitar with jawari buzz and meend; violin (bowed, delayed vibrato), santoor, xylophone, kalimba, tabla (bayan glide, tuned dayan). Teacher sound effects: clap, sparkle, tada, pop, gentle "uh-oh". All in the Instruments explorer and the parent's teacher-instrument picker; the instrument game adds them from difficulty 4 | `audio/synth.ts`, `curriculum.py`, `Basics.tsx`, `Settings.tsx` |

**Checked:** 123 backend tests (8 new in `tests/test_realism.py`), 38 frontend tests (5 new in `emotion.test.ts`), `tsc -b` clean, production build. Live HTTP run on a throwaway database: 20 languages listed; Sanskrit, Tamil and Japanese lessons; a barakhadi item (खु) came up; first miss → playful + "uh-oh", second miss → empathetic with no sound, comeback → proud + clap; journey returned; test account deleted.

**Not checked (needs a person):** the new faces and confetti in a browser (the Chrome extension was not connected), the new instruments and the emotional voice by ear, and a native-speaker review of the 9 new languages (especially Sanskrit, Tamil, Telugu, Kannada, Punjabi). Malayalam, Odia and Assamese can be added the same way (the barakhadi generator already handles their Unicode blocks with one entry each).

### Code-review graph (rebuilt 2026-11-17)

`.code-review-graphignore` now also excludes the vendored MediaPipe runtime (`frontend/public/mediapipe/**`) and installer output (`build/**`, `dist/**`); without that, two minified files added about 1,200 noise nodes. The repo has no git, so `code-review-graph update` cannot see changes: use `code-review-graph build`.

| Metric | 2026-11-04 | 2026-11-17 |
|---|---|---|
| Files | 69 | 111 |
| Nodes / edges | 597 / 5,290 | 1,127 / 11,803 |
| Functions | – | 689 |
| Communities | 12 | 15 |

Largest communities: `app-gen` (225, Python: engine, curriculum, models), `pages-explorer` (160, TSX), `audio-voice` (152, TS: synth, speech, emotion), `tests-child` (152), `src-song` (89), `routers-memory` (89), `teacher-ai` (37), `lang-word` (25). Strongest coupling: `src-song` ↔ `pages-explorer` (286 edges) and `app-gen` ↔ `routers-memory` (217).

Largest functions (refactor candidates): `SongRunner` 438 lines (`SongSchool.tsx:74`), `playNote` 275 (`synth.ts:123`, grew with the new instruments; a per-instrument table would shrink it), `LessonRunner` 232 (`Lesson.tsx:32`), `TeacherService` 230 (`teacher/service.py:234`), `CompareView` 188, the language `Runner` 187 (`Learn.tsx:81`).

## Update 2026-11-17 (night): any AI brain, adaptive teaching across sessions, progress tracker, parent chat (v1.4.0)

### Any AI brain, not only Claude Code
| Brain | How | Where |
|---|---|---|
| Ollama (local, free, private) | Native `/api/chat` with the JSON schema as `format`; `think: false` (qwen3 answered in 4.7 s instead of 113 s); model auto-picked from what is installed (embedding models skipped) | `app/teacher/llm.py` |
| OpenAI-compatible | `response_format` json_schema, stepping down to json_object / plain JSON per server. Local: LM Studio, llama.cpp, Jan, vLLM. Online presets: OpenAI, OpenRouter, Groq, Gemini, Mistral, DeepSeek | `app/teacher/llm.py` |
| Auto order | Claude API key, Claude Code CLI, configured OpenAI-compatible, running Ollama, offline | `TeacherService._make` |
| Parent UI | Parent → 🧠 AI brain lists what is on the computer; Save and test; stored in `brain.json` in the data folder (the API key is never sent back) | `/api/teacher/brains`, `/api/teacher/brain`, `BrainPicker.tsx` |
| Never makes a child wait | Child-facing calls get 8 s; a slower local brain's lesson plan is slotted in for the next activities when it arrives (live: +48 s, next activity followed it); background work 3 min | `_plan_now_or_later` |

### Per-child memory used by every AI call
Language progress is now in the child's learning graph (`language` and `word` nodes, `STUDIES` / `KNOWS` / `STRUGGLES_WITH`, timeline events). `memory.brief()` (skills, strengths, what is hard, languages, recent events, parent notes and goals, teaching tactics, summaries of earlier chats, the progress tracker) goes with every AI request, with the child's name replaced by `{name}`. MCP tools: `teacher_brief`, `language_progress`, `progress_tracker`, `teacher_plan`.

### Teaching that adapts, checked with simulated children over separate sessions
`tests/sim_progression.py`, `tests/test_progression.py`. Found and fixed: stars going down after a hard patch (stage = highest level succeeded at twice; opened word tiers stay open); a struggling child stuck in a comfort loop with 0 words learned (errorless turns with the answer glowing, comfort on the word closest to known, smaller new-word set); new letters added per attempt instead of per success; cold starts (welcome back + warm-up); greetings now recall what was hard last time.

### Progress tracker: the assessment parameters, 80 % measured + 20 % assessed
| Piece | Where |
|---|---|
| 230 parameters of the assessment guide (common, reading, writing, speaking, listening, vocabulary, music knowledge / performance / expression, keyboard, cognitive, creativity); 122 measured by the app, the rest marked "needs a teacher / AI observation" | `app/assessment.py` (`CATALOGUE_TEXT`) |
| Spider charts per area (music, each language, learning habits), recomputed after every activity, daily snapshots for "2 weeks ago" | `assessment.tracker`, `ProgressSnapshot` |
| final = 80 % measured + 20 % assessed (teacher/parent preferred, else AI weighted by confidence); bands Introduction / Exploring / Developing / Proficient / Demonstrated mastery; "not assessed yet" instead of 0 | `assessment.combine` |
| AI teacher's 20 %: every 12 answers and at every session end, compact input, quality fields (method, modality, model, confidence, evidence, review status, validity, limitations), can be rejected by the parent; may raise / lower difficulty one step only with confidence ≥ 0.6 and agreeing evidence | `run_ai_assessment`, `apply_pace` |
| Outliers: answers under 0.6 s (accidental taps) and runs of 4+ skips excluded; AI scores more than 25 points from measured are limited; failed reviews never touch the measured part | `load_events`, `run_ai_assessment` |
| Filters: by area, or one skill across all areas (Listening, Speaking, Reading, Writing, Vocabulary, Conversation, Instrument, Habits); parameter search, evidence and band filters | `lens_view`, `ProgressTracker.tsx` |
| Summary & next lesson plan for parents and teachers (AI, or from the tracker offline) | `/tracker/summary`, `teacher_plan` |
| Child's "My star map" and "How did that feel?" (confidence rating, kept apart from scores; "hard" twice starts the next lesson easier) | `StarMap.tsx`, `/feeling` |
| Engine uses it: weakest axis = lesson focus; language skill choice weighted by need | `plan_session(needs=)`, `engine.choose(need=)` |

One child end to end (`tests/test_one_kid.py`, `python -m tests.test_one_kid` prints the report): 94 activities, every one updated the learning graph and the spider chart; graph 7 → 43 nodes, 6 → 90 edges, 39 events; music difficulty rose in every practised skill; Hindi listening 5, speaking 5, reading 4 (stage), writing stage 3; filters show only their skill and their parameters.

### Parent chat (feedback loop)
Parent → child → 💬 Talk to Melo. The parent says what they or the child want; Melo (AI, or an offline intent reader) proposes concrete changes, applied only with **Apply**: goal, music focus, teaching tactic (gentle, challenge, more games, more repetition, more singing), lesson length, open a song (e.g. the new **Mahamrityunjaya Mantra** lesson), a new AI-made tune, practise a topic (e.g. the new **At the market** topic, 5 phrases × 20 languages, also in Side by side), a new AI-translated conversation topic for the child, or a note. Tactics change lessons (gentle → easier start, more games → starts with a game). Chats (parent and child) are stored with a running summary refreshed every 8 turns (AI or offline extract) and sent with every AI request: context survives new sessions and token limits. `app/parent_chat.py`, `ParentChat.tsx`.

### Installers
Windows installer (`dist/Melo-Setup-1.4.0.exe`): system check page (64-bit Windows 10/11 and 700 MB required; Edge, Claude Code, Ollama optional) and an "Optional extras" page where Ollama is installed with winget **only if ticked**. Linux `install.sh`: checks processor, disk, missing libraries (from `ldd`), xdg-open, browser, Claude Code, Ollama, and asks (y/N) before installing anything with sudo or downloading Ollama. In the app: Parent → 🧠 AI brain → 🩺 System check (data folder, disk, AI brains, voices, speech recognition, microphone). Verified here: silent install, the installed app passed HTTP smoke tests (tracker, filters, parent chat, mantra lesson, market topic, system check), clean uninstall. **Not run:** the macOS and Linux builds (no Mac or Linux on this computer; `packaging/build.sh` and the CI workflow are ready), and the interactive installer pages by hand.

### Fixed: invisible text in dark mode
Filter chips, cards, comparison cells and conversation bubbles had a white background with the theme's text colour, so their text disappeared in dark mode. They now take both from the theme. Spider charts got larger labels, more room around the chart and a "How to read" line; with fewer than 3 axes they become bars.

### Code-review graph
Rebuilt: 132 files, 1,399 nodes, 16,055 edges. A Claude Code `Stop` hook in `.claude/settings.json` rebuilds it in the background after every turn (the repo has no git, so `update` cannot see changes). Open `/hooks` once or restart Claude Code for it to load.

Tests: 150 backend, 42 frontend.

## Update 2026-11-18: native-speaker voices and pronunciation compared with them

| Piece | Where |
|---|---|
| Native recordings from **Lingua Libre** (single words by declared native speakers, speaker gender recorded, CC BY-SA, on Wikimedia Commons): up to 3 per word, female and male mixed, distinct speakers; converted to 16 kHz WAV, trimmed, normalised, with attribution in a manifest | `app/lang/native_audio.py` (`python -m app.lang.native_audio`) |
| Lessons play them instead of the device voice (female / male take turns, slow = 75 % speed with the same pitch) and credit the speaker under the word; the device voice is used only where no recording exists | `audio/native.ts`, `Learn.tsx` |
| The child's spoken word is recorded during speech recognition and compared with the native recordings: MFCC + DTW, scored relative to other words (so a child's higher voice is not penalised). Only the score is kept, never the audio. Needs microphone consent | `app/audio/pronounce.py`, `POST .../attempts/{id}/voice` |
| Second opinion: recogniser heard nothing but the voice matches (≥ 75) → success; recogniser missed but voice close (≥ 70) → partial | `routers/learn.py` |
| New tracked parameter "Pronunciation compared with native speakers" (and Phoneme accuracy) | `assessment.py` (`s_native`) |
| Parent page 🎙️ Native voices: coverage per language (female / male / family), download from Lingua Libre (in the background, polite: one request at a time, honours "retry after"), and **record it yourself**: a family member or teacher records missing words (kept on this computer, never put in the installer) | `NativeVoices.tsx`, `routers/native.py` |
| Builds bundle downloaded public recordings (not family ones) | `packaging/melo.spec` |
| "Talk to Melo" is now a big button on each child card | `Dashboard.tsx` |

**Coverage measured on Lingua Libre (words and phrases of the 73 per language that have native recordings):** French 41, English 37, Spanish 36, Turkish 35, Bengali 33, German 33, Telugu 32, Cantonese 32, Hindi 29, Marathi 29, Mandarin 28, Russian 28, Tamil 26, Arabic 23, Korean 19, Punjabi 8, Japanese 3, Gujarati 2, Sanskrit 1 (Kannada: server error, to retry). Mostly single words; phrases are rarely recorded. Female and male voices both exist for 0-35 words depending on the language.

**Blocked for now:** Wikimedia's audio-file server answered HTTP 429 ("retry after 600 s") to this computer and asks automated downloaders to give a contact in the User-Agent. Set `KM_WIKIMEDIA_CONTACT` (a web page or email) in `.env` and run the download again (🎙️ Native voices → Download, or `python -m app.lang.native_audio`). Nothing was downloaded yet, so lessons use the device voice and the comparison waits for references (family recordings work now).

**Why not videos:** cutting audio out of online videos would break those sites' terms and the speakers' copyright; Lingua Libre exists for exactly this and allows reuse with credit.

**Music:** songs are compared with their exact notes (pitch tracking of the child's playing), which is more precise than comparing with a recording of someone else playing, so no music recordings are downloaded.

Tests: 156 backend (6 new in `tests/test_native_audio.py`, with generated voices: the same word in a higher child voice scores ≥ 75, another word < 50), 42 frontend.

### Update 2026-11-18 (later): whole sentences, raising the bar
| Piece | Where |
|---|---|
| Wikimedia downloads now identify Melo with the owner's contact page (`KM_WIKIMEDIA_CONTACT`, a username or URL), as Wikimedia's bot policy asks; polite pace (1 request / 1.5 s, honours "retry after"); saves merge with other writers | `native_audio.user_agent`, `_fetch`, `_save_manifest` |
| **Sentences** from Tatoeba: exact matches of every phrase / sentence, up to 3 recordings by different native contributors; only openly licensed recordings (the "Tatoeba only" ones are skipped); stored byte-for-byte (many are CC BY-NC-ND), played and credited, kept out of installers when non-commercial; Tatoeba has no speaker gender | `native_audio.download_sentences` |
| **Challenge packs:** when every skill is at stage 4+ and ¾ of the content (or of the last pack) is known, Melo makes "⭐ Challenge n": 6 sentences, longer each pack (3-5 words, then 4-6 ...). Real Tatoeba sentences with recordings built around known words, vetted by the AI as suitable for a 3-8 year old (offline: only sentences made entirely of known words); the AI writes the rest one step harder from the child's vocabulary, then native recordings are searched for them. Once the built-in content is mastered, half of the normal lesson turns come from the newest pack. Parent: ⭐ Harder on 🎙️ Native voices | `app/lang/growth.py`, `routers/learn.py` |

Pronunciation check on real recordings (English, held-out speakers): same word by another native speaker median 97 (21/31 ≥ 70); a different word median 0 (28/31 < 50). It only upgrades answers the speech recogniser missed, never lowers one.

Tests: 159 backend (`test_growth.py`, Tatoeba sentence test), 42 frontend.

### Update 2026-11-18 (night): recordings downloaded and bundled
Word download (Lingua Libre) finished: 892 recordings in 19 languages. Kannada failed again (Lingua Libre answered HTTP 502); retry later with `python -m app.lang.native_audio kn`.

Tatoeba sentences: 95 recordings (21 openly licensed, 74 CC BY-NC-ND). New ones per language: English 29, Spanish 26, Russian 13, German 10, French 9, Marathi 4, Cantonese 2, Japanese 2; none for the others. Spot check (Mandarin): Tatoeba has no exact recorded match for Melo's phrases, so the zeros are genuine, not a matching bug.

Words and phrases with a native voice now (of 72): English 57, Spanish 56, French 48, German 39, Russian 35, Turkish 34, Cantonese 33, Marathi 32, Bengali 32, Telugu 31, Hindi 28, Mandarin 27, Tamil 25, Arabic 22, Korean 18, Punjabi 7, Japanese 5, Gujarati 2, Sanskrit 1, Kannada 0.

Installer rebuilt (`dist/Melo-Setup-1.4.0.exe`, 60.7 MB): bundles 912 recordings, 0 non-commercial, 0 family (checked in the bundled manifest). Verified: silent install, installed app healthy, serves bundled word (`en/hello`) and CC BY sentence (`en/thanks-t1.mp3`) recordings, leaves out the NC one; the local app (`scripts/run.ps1`) serves both. Tests: 159 backend, 42 frontend, all passing.

### Update 2026-11-18 (night, later): more sentence sources
Searched for openly licensed recordings of native speakers reading sentences:

| Source | Licence | Languages for Melo | Used? |
|---|---|---|---|
| Google crowdsourced sets on **OpenSLR** (SLR 37, 61, 64-66, 70-75, 78, 79, 83) | CC BY-SA 4.0 | kn, gu, mr, ta, te, bn, en (UK, Ireland, Nigeria), es (Latin America) | **Yes**, `app/lang/openslr.py` |
| Mozilla **Common Voice** (Mozilla Data Collective) | CC0 | all 20 | Needs an MDC account and API key (owner's decision) |
| Google **FLEURS** | CC BY 4.0 | 19 of 20 | No: long news sentences (median 23 words), one 1.2 GB archive per language |
| AI4Bharat IndicVoices / Kathbath | CC BY 4.0 (to confirm) | Indic | Gated (contact details asked), mostly spontaneous speech |
| Vāksañcayaḥ (Sanskrit) | CC0 on AIKosh | sa | Readings of śāstras: adult text; possible later for Sanskrit |
| AISHELL-3 (Mandarin, Apache 2.0), Zeroth Korean (CC BY 4.0) | open | zh, ko | Single 10-19 GB tar archives (no partial download) |
| MAGICDATA, Deeply Korean | CC BY-NC-ND | zh, ko | No: non-commercial and no derivatives |

OpenSLR: HTTP range requests read only the zip's file list, its transcript and the chosen clips (about 3 requests per clip, a few MB per language instead of 1-2 GB). Each language gets a pool of 40 short sentences (3-8 words, preferring Melo's words, female and male voices taking turns, up to 3 speakers each) used by the ⭐ Challenge packs (AI-vetted; offline only all-known-word sentences), plus exact matches of Melo's own words. The clips are WAV, so the child's voice is compared with them (Tatoeba MP3s are only played). Bundled in the installer (CC BY-SA, credited "Google / OpenSLR" under the sentence). Downloaded with Parent → 🎙️ Native voices → Download, or `python -m app.lang.openslr`.

Pools now: kn 39 (first Kannada native recordings: also water, left, right), gu 40, mr 40, ta 40, te 40, bn 40, es 40, en 40; 4-20 candidates per challenge level.

**Fixed:** word splitting and exact matching cut Indic words at vowel signs, so the offline "known words only" check compared letters and different words matched (Kannada ಹೌದು "yes" = ಹಿಂದೂ "Hindu", ಶಾಲೆ "school" = ಶಿಲೆ "rock", Bengali "yes"). Fixed in `growth._words` / `native_audio._norm`, false recordings removed, Marathi Tatoeba matches re-verified. Coverage report no longer counts pool sentences as lesson words.

Tests: 166 backend (`tests/test_openslr.py`: index formats, gender, pool and credit, offline and AI-vetted packs, range reads against a local server, Indic regression), 42 frontend.

### Update 2026-11-18 (night, Common Voice)
`app/lang/commonvoice.py` (`python -m app.lang.commonvoice [langs]`, also run by Parent → 🎙️ Native voices → Download when `KM_MDC_API_KEY` is set). Finds each language's free CC0 Common Voice Scripted Speech dataset on Mozilla Data Collective (curated female + male segments when they exist, else the newest official release), streams the .tar.gz once and keeps only validated clips (2+ up votes, no down votes): exact recordings of Melo's words and phrases (up to 3 speakers) and a pool of 40 short sentences (`v_` keys) for the ⭐ Challenge packs. Archives over `KM_CV_MAX_MB` (default 4000) are skipped.
* Terms of use: "forbidden to re-host or re-share this dataset" and to identify speakers. Clips are marked `noshare` and **never bundled** (`melo.spec`); only a 10-character anonymous id is stored.
* Each dataset's terms must be accepted once on its page by the account owner; until then the download reports the page (`terms_needed`). Status: key saved in `.env`, terms not yet accepted.
* MP3 → WAV (for comparing the child's voice) needs the optional `miniaudio` package (MIT); without it the MP3s are kept unchanged and only played. Not installed yet (needs the owner's OK).
* Catalogue sizes (Scripted Speech 27.0): te 69 MB, pa 110 MB, ko 219 MB, hi 573 MB, mr 589 MB, ar 194 + 247 MB (curated female / male), tr 3.0 GB, zh-HK (Cantonese) 3.7 GB; large: ru 7 GB, yue 6.4 GB, ta 9 GB, ja 15 GB, zh-CN 23 GB, bn 27 GB, fr 31 GB, de 37 GB, es 52 GB, en 95 GB. None for gu, kn, sa.

Tests: 171 backend (`tests/test_commonvoice.py`: validated-only, clips before or after the lists, anonymity, noshare, terms / size / key reporting, segment choice), 42 frontend.

### Update 2026-11-18 (night): school conversations, any number of languages side by side, MP3 comparison
| Piece | Where |
|---|---|
| **3 new conversation topics in all 20 languages** (22 phrases, romanised where the script is not Latin): 🏫 At school (good morning teacher, may I come in, I have a question, may I go to the toilet, can I borrow a pencil, I have finished, I don't know, I am here), 🛝 Playing with friends (can I play with you / yes come and play, let's be friends, my turn, your turn, let's share, well done, stop please), 💛 Feelings and caring (are you okay, I am hurt, sad, sleepy, I like it, I am scared). Gender-neutral first person where the language allows ("I am sleepy" instead of a gendered "I am tired"; Hindi "kya main andar aaoon?") | `phrases.py` (`_SCHOOL`) |
| New little conversations: "Can I play with you?" → "Yes, come and play!", "Are you okay?" → "I am fine, thank you." | `REPLIES` |
| Parent chat (offline too) proposes these topics when a parent mentions school, teachers, friends, playing with other children or feelings | `parent_chat.offline_reply` |
| **Side by side: the family chooses how many languages** (1, 2, 3 … 15 or all 20, remembered per child; "🌍 All" button). More than four columns scroll sideways with the meaning column kept in view; phones show cards of two | `Compare.tsx`, `styles.css`, `/learn/compare` (1 to 20) |
| **MP3 decoding** with `miniaudio` (MIT, approved by the owner, in requirements and lock): Tatoeba MP3s are decoded in memory for the pronunciation comparison (files unchanged, as no-derivatives licences ask); Common Voice clips are stored as 16 kHz WAV | `native_audio.decode_mp3`, `commonvoice._to_reference` |

Content note: the 440 new phrase translations were written by the model; like the rest of `phrases.py` they need a native-speaking teacher's review before classroom use (French, German and Arabic teacher greetings are gendered: "maîtresse", "Frau Lehrerin", "ustaadh").

Tests: 174 backend (`test_school_friends_and_feelings_for_real_conversations`, `test_parent_chat_offers_school_and_playground_phrases`, compare with 5 and 20 languages), 45 frontend (`compare.test.ts`).

## Update 2026-11-22: never-silent voices, the child's own instrument, the "why" everywhere (v1.5.0)

| Change | Detail |
|---|---|
| 🔊 **Every word has a voice** | Conversation questions were silent when the device had no voice for that language (Chrome on Windows: Marathi, Gujarati, Tamil, Telugu, Kannada, Bengali, Cantonese, Arabic, Turkish, Sanskrit...). Now: native speaker → pretrained neural voice (female + male, `app/lang/tts.py`: Edge neural voices for 18 languages, gTTS for Punjabi, optional offline AI4Bharat Indic-Parler-TTS for Sanskrit / Punjabi) → device voice → Melo's own voice. Questions get their own recordings. ~2,500 clips pre-recorded (`python -m app.lang.tts`) and shipped in the installers. Synthetic clips are never pronunciation references. |
| 🪔 **Sanskrit** | Hindi neural voice with Sanskrit spelling fixes (visarga ः → h + echo vowel); Parler "Aryan" for proper Sanskrit when installed. |
| 🐞 **"cat" was never downloaded** | Custom-phrase ids are `c` + 12 hex; code skipped every id starting with `c`. Fixed everywhere. |
| 🎹 **The child's own instrument** | Parent page (photos, shop/maker links, notes → "Let Melo read them", AI brain sees the photos). Lessons show the same instrument (keys with number/colour/letter stickers, xylophone bars, drum pad), move songs into its range, and say where each note is on it. No profile = the standard lessons. |
| 👣 **One by one + the why** | Song school: Melo explains why each key (direction, place on the instrument, length, the word it sings, why it ends at home), the child presses it, then taps Next (default ≤ 4 years). Part shapes (stairs, slide, hill), "How music is made" cards, a real teacher's do's and don'ts, reasons after wrong keys, 🤔 Why? button. |
| 🎼 **Make a song with Melo** | Guided builder: home note → choose a move (with what it does to the music) → press the key → short or long (with why) → Next → go home. |
| 📚 **Language personalisation** | "Own words": photos / links / notes of the family's material become a personal topic (AI brain). Every answer explains what the word means in the child's language and why a reply fits the question; One-by-one mode with Next. |
| 📦 **Installers** | `packaging/voices.py` bundles native (shareable licences) + synthetic clips; CI fetches the voice pack from the `voices` release. |
| 🔢 **Maths (classes 1–5)** | 28 topics in 5 strands: numbers & arithmetic (counting, compare, place value, + − × ÷, even/odd, skip counting, fractions), patterns & algebra (patterns, missing number, balance), geometry (shapes, symmetry, angles, area & perimeter), measuring & data (time, money, length, charts), **Vedic & quick tricks** (+9, ×5, 9s on fingers, ×11, Nikhilam, all-from-9, squares ending in 5), each with the worked steps and why it works. Concept cards with diagrams (number line, tens rods, arrays, fraction pizzas, clock, coins, balance…), 5-question rounds, a reason after every answer, Next buttons, number pad from class 3, difficulty 1–5 per topic on the server. |
| 🧪 **Shape Lab** | Make (join dots: Melo names the shape and explains sides, corners, right angles, area, perimeter, symmetry), Mix (squares + half-square triangles: two triangles make a square, area adds up), Puzzles (make a rectangle with area 6, 4 lines of symmetry…). |
| 🔬 **Science (classes 1–5)** | 16 topics: living/non-living, plant parts & needs, animal food & homes, life cycles, senses, food groups, water cycle, states of matter, weather, solar system & day/night, push/pull, magnets, light & shadow, circuits. Drawn diagrams (plant, water cycle, planets, butterfly, particles…), label / sort / order / why questions. |
| 🧑‍🏫 **Teacher personas** | Parent page "Teachers": per subject (maths, science, music, languages) a persona (Melo, Professor Pi, Captain Science, Dadi, Coach Zoom, Maestro), device voice, speed, pitch, preview; and the child's school class. Applied in every section. |
| ➕ **More maths, science and Vedic tricks (2026-11-23)** | Maths now 43 topics in 6 strands (new: before/after/between, make 10, doubles & halves, rounding, Roman numerals, equivalent fractions, adding fractions, decimals, factors & multiples, story sums +/− and ×/÷, two-step problems, 3D shapes, weight & capacity, days & months). Vedic & quick tricks now 21 (new: round-and-adjust, shopkeeper's subtraction, ×4/×8 by doubling, ×9, ÷5, halve-and-double, ×25, teens × teens, Urdhva Tiryak, Antyayor Dashake'pi, squares near 50, Vedic ÷9, divisibility, digit-sum check). Science now 31 topics (new: bones & muscles, teeth, digestion, heart & lungs, hygiene, seeds, habitats, float/sink, air, soil, moon phases, sound, simple machines, heat, recycling) with new diagrams. **Every maths answer has a worked solution, step by step with Next** (column carries and borrows, also across zeros, break-apart multiplication, each trick applied to that problem); it opens by itself after a wrong answer. Extra simple concept cards for the first topics. |
| 🧠 **AI results fixed** | The AI review only saw per-axis averages, never completed concepts, was skipped if a review ran < 5 min earlier, never ran during song practice, and never saw maths/science. Now: completed concepts and learned/applied/remembered summaries are sent, the prompt says a completed concept counts as demonstrated, milestones (whole song, language stage, mastered topic) trigger a review at once, song practice is reviewed every 12 answers, subject rounds count as evidence. |
| ♾️ **Never-ending pool** | Languages: new sentence packs at the child's pace (listening/reading stage 3, 60 % known) instead of all skills at 4 + 75 %. Music: finishing a whole song auto-creates the next harder exercise. Maths/science/vedas/finance: mastering level 5 makes the AI brain write level 6, then 7… per child and topic (validated: answer among choices, child-safe text, sums re-computed). |
| 🪙 **Money & finance** | 16 topics in 5 strands (basics, saving & spending, earning & business, smart & safe, growing money), mostly real-life decisions, numbers with worked steps. |
| 🕉️ **Vedas & wisdom** | 17 topics: the four Vedas, 23 shlokas (Devanagari, IAST, source, meaning, life lesson, recite), Gita concepts (2.47, 2.48, 6.5, 2.14, 6.17, 17.15, 3.21, 4.38), life skills from childhood to old age, Vedic links to music, geometry, Sanskrit, astronomy and money. Shloka of the day in every subject. Personas Guruji and Money Mitra. |
| 🏆 **Results per subject + combined** | Every area scored on 🧠 learned 45 %, 🌍 uses it in real life 35 %, 🔁 remembers 20 % (plus ✅ concepts completed), and an overall "All subjects" result; icons and star rows explain themselves on hover / focus. |

## Update 2026-11-24: security test and code signing

| Change | Detail |
|---|---|
| 🔒 **Security sweep** | `tests/test_security.py`: all 91 API operations signed out and as another family, fuzzed with injection / XSS / traversal payloads, forged sessions, CSRF, brute force, MCP tokens, hostile uploads and links. Live path-traversal probes against the installed app. Details in `docs/REVIEW.md` (25). |
| 🐞 **Fixed** | Voice recordings (including family voices) needed no sign-in; instrument photos never reached the Claude Code brain (Read was refused); IPv4-mapped addresses slipped past the link reader's private-address check. |
| ✍️ **Code signing ready** | Windows: Azure Artifact Signing in CI (signs Melo.exe, rebuilds Setup with `build.ps1 -InstallerOnly`, signs Setup, checks both). macOS: Developer ID signing with hardened runtime (`packaging/macos/entitlements.plist`), DMG notarized and stapled. Off until the owner adds the certificates as GitHub secrets: `docs/SIGNING.md`. |

Tests: 206 backend, 180 frontend.

## Update 2026-11-24: teach before asking, the four Vedas one by one, real-life missions

| Change | Detail |
|---|---|
| 🐞 **Questions about things never taught** | Measured: 9,293 of 19,367 sampled recall questions (48 %) asked about a fact the topic's cards never taught (most topics had 1–2 cards, every finance topic 1, questions drew on 5–20 facts; a second visit skipped the cards; new levels brought new question types with no example). |
| 👣 **Teach before asking** (`subjects/teachfirst.ts`) | Every subject, every topic, also the AI-written levels 6+: a FACT is taught on a "Learn this first" card (question, answer, why, picture) the first time it comes up, then asked; a METHOD (numbers to work out) starts each new level with a worked example using other numbers, revealed step by step with Next. What each child was taught is remembered per topic on the device; later rounds ask from memory. A round mostly answered right after teaching never raises the level or counts as mastery (`taught` in the round, server rule tested). |
| 📚 **More concept cards** (`subjects/more_cards.ts`) | 76 new cards for 58 weak topics (shapes, symmetry, 3D shapes, calendar, Roman numerals, Vedic ÷9, divisibility, sound, heat, magnets, light, soil, circuits, habitats, digestion…, all Gita / life-skills topics, all money topics). `coverage.test.ts`: every word answer a topic can ask now appears in its cards (0 % untaught, was 48 %); shlokas are taught one verse at a time. |
| 🕉️ **The four Vedas, one by one** (`subjects/vedas4.ts`) | New first strand "Meet the four Vedas": the Veda family (with hand actions: Rig recites 🙏, Sama sings 🗣️, Yajur does 🫗, Atharva heals 💚) and a topic per Veda: what it is, what's inside, a story or famous line (Agni as the first word, the Nāsadīya question hymn, Sama = the same words sung, the seven swaras, tat tvam asi, Nachiketa and śreyas/preyas, Īśa Upanishad, Bhūmi Sūkta, satyameva jayate from the Muṇḍaka Upanishad, Ayurveda roots), a stick point and "in your day" lessons. Picture hooks: a drawn badge per Veda (colour, symbol, action, four icon hooks) and a family picture (`Diagrams.tsx`). English, Hindi and Hinglish. |
| 🔁 **Never the same question twice** (`teachfirst.ts`: `AskedLog`, `drawFresh`) | Rounds drew at random from banks as small as 3 questions, so money (and other) questions came back two or three times in one round. Now every question a child is shown in a topic (asked, or used as a worked example) is remembered (a short fingerprint per question, per child and topic, on the device) and never asked again; an empty level borrows unseen questions from the nearest level; a used-up topic ends the round early and says so instead of repeating. Test: 30 rounds per topic across all levels, no repeat anywhere. |
| 🔁 **Revise finished lessons** | Every topic the child has played has a 🔁 Revise button (topic list, end of a round, the "every question done" screen). Revision asks questions the child has already met, slips first; a right answer in revision takes a slip off the list. Questions are rebuilt from the seed they were made with (about 20 bytes each, up to 400 per topic, slips always kept), so nothing large is stored. Revision rounds are recorded and earn stars but never change the level, count as mastery or start AI levels (`revision` in the round). New practice still never repeats. Songs (learned ones stay in the list), music basics (only future tiers are locked) and language topics could already be revisited. Topics played before this update have no saved questions yet, so their revision starts once new questions are answered. |
| 🪙 **More money questions** | why money 3 → 9, needs & wants 5 → 12, spending wisely 3 → 9, sharing 3 → 9, staying safe 4 → 10, money through life 4 → 10, earning 3 → 9, compound growth 6 → 15 (more amounts and rates), coins more notes; every new answer is in the Learn cards. Still small (under 10 at a level): about 60 science and Vedas & wisdom topics (3–9), so they are used up after one or two rounds until more questions are written. |
| 🎯 **Real-life missions** (`subjects/missions.ts`) | Every money and Vedas & wisdom topic ends with one small task in the child's name ("Asha, at dinner, thank the farmer, the sun and the rain"); "I did it!" writes it to the learning graph for the AI teacher and the results. |

Tests: 208 backend, 191 frontend.

## Update 2026-11-24: 10+ phrases per situation, five new situations, a shared recording tracker

| Change | Detail |
|---|---|
| 💬 **Every conversation topic at 10 phrases** | Greetings, meeting someone, polite words, directions, food and drink, asking for help and at the market went from 5 to 10; at school and playing with friends from 8 to 10; feelings and caring from 6 to 10. |
| 🏠🚌🩺🎈🌦️ **Five new everyday situations**, 10 phrases each | At home (we're home, brushing teeth, washing hands, bath, dressing, tidying, helping, dinner, TV, bedtime), getting around (bus, sitting, seat belt, crossing, green light, train, arriving, ticket, how long, holding hands), at the doctor (unwell, head, tummy, cough, fever, medicine, mouth, breath, better, rest), celebrations (birthday, party, gift, thanks, cake, song, dance, New Year, congratulations, photo), time and weather (time, Monday, holiday, rain, sun, cold, hot, wind, late, early). |
| 🌍 **All 20 languages** | 93 new phrases × 20 languages (`app/lang/phrases_more*.py`), romanised where the script is not Latin, every picture different. First person is gender-neutral where the language allows (dative forms in Hindi, Marathi, Gujarati, Punjabi, Sanskrit; "ash'uru bi..." in Arabic; present tense and "mne" in Russian; "let's..." for routines). 150 phrases in 15 situations per language. |
| 🔊 **Voices for the new phrases** | Native recordings searched again on Lingua Libre, Tatoeba and OpenSLR (exact matches); neural-voice clips (female and male) pre-recorded so no new phrase is silent offline. |
| 📋 **Shared recording tracker** (`backend/scripts/voice_tracker.py`) | `voice-tracker.csv` (every word and phrase × 20 languages: native female / male counts, sources, status, whether a computer voice is saved, search links for Wikimedia Commons, Tatoeba and Forvo) and `voice-missing.csv` (only what still lacks a female or male native speaker). Both in the project root, git-ignored and never bundled. The owner fills `found_url_or_file`, `found_license`, `found_speaker`, `found_gender`; `python scripts/voice_tracker.py import` brings them in (local .wav / .mp3 or a direct https link; CC0 / CC BY / CC BY-SA / public domain / own recording only, never NC or ND) and marks them imported; `export` refreshes coverage and keeps the owner's columns. |

Content note: the 1,860 new phrase translations were written by the model; like the rest of the phrases they need a native speaker's review before classroom use.

### Update 2026-11-24 (later): go-to-market plan, voices for the new phrases

* `docs/GO_TO_MARKET.md`: honest review, SWOT, 22 changes needed before selling (11 must-do), platforms, USA and India plans, pricing to test, a 12-week roadmap with gates, and when to start ads.
* Computer voices pre-recorded for the 93 new phrases in all 20 languages (female and male; Punjabi has a single voice). Exception: Microsoft's Russian male voice refuses about 87 of the new sentences every time (a service quirk; the female Russian voice reads them), so those phrases have the female voice only until licensed voices replace edge-tts.

## Update 2026-11-24 (master branch): ready-to-sell fixes

| Change | Detail |
|---|---|
| 🛒 **Retail edition** | Installed copies default to `KM_EDITION=retail`: Claude Code is never the brain or offered; offline teacher, Ollama or the family's own key. `KM_EDITION=dev` in Melo/.env for the owner. |
| 📄 **Privacy, terms, agreement** | `/privacy`, `/terms` (drafts for a lawyer); sign-up requires the parent or guardian agreement; versions stored (`agreements` table). |
| ✨ **Update check** | `/api/system/update` asks GitHub releases at most twice a day (no personal data); dashboard banner. |
| 💬 **Help and feedback** | Parent → Help: quick answers, feedback by email or copy, technical details only. |
| ⭐ **Free and family plan** | Offline Ed25519 licence keys (`backend/scripts/licence_keys.py`); free plan limits enforced on the server (402) for children, songs and languages; topic locks in the app; Parent → Plan. |
| 🪟 **Microsoft Store package** | `packaging/windows/build_msix.ps1` + CI step: an unsigned MSIX the Store signs; identity from repository variables. |

Launch checklist for the owner: end of `docs/GO_TO_MARKET.md`.

## Update 2026-11-24 (evening): Note Rain, background music, life-skills stories, licensed voices

Ideas taken from [melodino](https://github.com/BuilderCed/melodino) (MIT, a gamified piano app for children) and rebuilt in Melo's own code and style: falling notes, a wait mode, four speeds, 3 stars, worlds, USB MIDI keyboards, letters or Do Re Mi, a colour-blind palette. No code or assets were copied.

| Change | Detail |
|---|---|
| 🌧️ **Note Rain** (`pages/NoteRain.tsx`, `teaching/noterain.ts`) | Coloured notes fall towards the piano, each one over its own key; press the key when the note touches the line. **Wait mode** (default up to age 6): the music stops at each note until the right key is pressed. After 2 and 5 wrong keys Melo says which way to go and why ("higher sounds live on the right"). **Play-along**: the beat keeps going, and a note counts when the key is pressed within a window that is wider for younger children. Speeds 🐢 🎵 🐇 🚀, "Listen first", a streak counter, Perfect/Good pops, 3 stars (same bands as every round), "try it faster" after 3 stars, next song. **Worlds**: 🌳 Forest, then 🌊 Ocean and 🏰 Castle, each opening with 3 ⭐ from the world before; 🪔 Sargam Temple (Indian songs and alankars) is always open. Free-plan song locks apply. |
| 🏆 Note Rain results | `GET/POST /api/children/{id}/note-rain`. The server keeps the best stars, best accuracy, number of plays and fastest speed per song, so worlds stay open on every device. Every game is written to the learning graph (`song_game` event). Fixed on the way: saving the teacher personas replaced all stored prefs (`subjects.save_prefs` now keeps other keys). |
| 🎹 **Real keyboards** (`audio/midi.ts`) | Any USB or Bluetooth MIDI keyboard in Chrome or Edge, in every piano screen: notes arrive exactly, folded into the keys on screen. Parent → Settings → 🎵 has Connect keyboard, and can switch Melo's own sound off for digital pianos that have speakers. Computer keys now play the black keys too (w e t y u, as in music software). Pressed keys light up. |
| 🔤🎨 Keys | Parent → Settings → 🎵: note names (from the language, C D E, Do Re Mi or Sa Re Ga) and key colours (rainbow, or Okabe-Ito, which is safe for colour blindness), per device. |
| 🎶 **Background music** (`audio/bgm.ts`, `audio/hold.ts`) | Soft original music composed in the browser (no recordings, no licences): a 4-bar pentatonic tune in the shape A A' B A, played twice and then varied, over pad, bass and shaker. Four moods: home, calm (subjects), story (music box), play. It plays on menus, stories, subjects, Shape Lab and the Note Rain list, and **never** on pages that listen or teach notes. It gets quieter while Melo talks and goes silent while Melo plays notes or the child presses keys (`isBusy`), whenever the microphone is open (mic, recorder, native-voice recording, speech recognition all hold it), and when the tab is hidden. Children have a 🎵/🔇 button; parents set the volume or switch it off. Tapping menu tiles makes a soft pop. |
| 📖 **Life-skills stories** (`subjects/stories.ts`, `pages/Stories.tsx`) | 16 picture stories about moments children really meet: sharing a toy with a little cousin, a broken cup and telling the truth, falling off a new bicycle, knocking over a friend's tower, anger in a lost game, a new child at school, waiting for the swing, washing hands, "one more video", helping a tired parent, a stranger with a "lost puppy", saving for a football, coming second, fear of the dark, asking for help, practising a little every day. Each story is told one picture and sentence at a time, read aloud, with Next. At the key moment it asks "What should Kabir do?". Every choice shows what happens and **why**; a weaker choice is never called "wrong", just "what might happen?", and the child tries again. Then the ending, the big idea, why it matters, one check question and a mission in the child's name ("I did it!" goes to the learning graph). The results are recorded as Vedas & wisdom, strand "life" (`story_<id>` topics): the first choice counts as real-life application, and stories show ✓ when read. English, Hindi and Hinglish; other languages fall back to English. A 📖 Stories tile is on the home screen. |
| 🎙️ **Licensed voices, many of them** (`app/lang/tts.py`, engine `piper`) | Piper neural voices, offline. Only voices whose training data is licensed for commercial use: each model card was checked (CC0, public domain, CC BY, CC BY-SA, Unlicense). Excluded: non-commercial (Hindi pratham and priyamvada, ryan, hfc, dfki, kss ...), unknown or "see URL" (amy, alan, irina ...), IIT Madras IndicTTS (rohan, maya) and AGPL (tom). There are **8 English voices** (Kathleen, LJ, Kristin, Alba / Joe, Mike, John, Norman) and several for German, Spanish, French, Russian (male only), Telugu, Marathi (female only) and Bengali (speakers chosen by measured pitch). Each word gets one voice of each gender by its id, so a lesson is read by different people. **2,318 clips re-recorded** (en 276, de 296, es 298, fr 254, ru 133 male, te 306, mr 159 female, bn 304), replacing Microsoft edge-tts clips. Every clip credits its voice and licence. Piper bundles eSpeak-NG (GPL), so it is a **build-time tool only**, like Parler: `pip install piper-tts lameenc`, then `python -m app.lang.tts --piper en de es fr ru te mr bn`. Models go to `data/piper_voices/` (about 60 MB each, never bundled) and only the MP3 clips ship. |

Still on edge-tts (no openly licensed voice exists yet): Hindi, Gujarati, Tamil, Kannada, Punjabi (gTTS), Arabic, Turkish, Japanese, Korean, Chinese, Cantonese, Russian female, Marathi male, and Sanskrit (Hindi voice). Next steps: AI4Bharat Indic-Parler-TTS (Apache-2.0; needs torch and about 4 GB) for Hindi, Tamil, Gujarati and Kannada, or a paid licence (Azure / Google), and real recordings through `voice-tracker.csv`.

Content note: the 16 stories (and their Hindi and Hinglish text) were written by the model. Have a teacher or parent read them before launch, like the rest of the content.

Verified in the built app (headless Edge, a test account on a throwaway data folder): stories (choice, retry, check, mission, round recorded), Note Rain (whole song in wait mode with the computer keys, 3 stars saved), home tiles, Settings section; no console errors. The first run found that a finished song waited about 5 s on an empty screen before the stars; it now ends one beat after the last note.

Tests: 232 backend (`test_note_rain.py`, Piper licence, order and credit tests in `test_tts.py`), 209 frontend (`noterain.test.ts`: chart, speeds, judging, stars, worlds, MIDI parsing, octave folding, computer keys; `stories.test.ts`: three languages everywhere, one good option, shuffled check, missions with the name; background music: same seed = same tune, ends at home, silent while listening or playing).

### Update 2026-11-24 (night): the Listening room, version 1.6.0

| Change | Detail |
|---|---|
| 🎧 **Listening room** (`pages/Listen.tsx`, `subjects/listening.ts`) | A home tile "Listen & feel". Seven tracks, chosen by how the child wants to feel: 🌊 Calm waves (breathe with a circle: 4 s in, 6 s out), 🔔 Bell hunt (count the high bells, then say how many: trains attention; at most 12 bells), 💃 Happy dance (clap, jump, spin, freeze prompts on the beat), 🪔 Morning raga Bhupali (Sa Re Ga Pa Dha over a tanpura-like Sa-Pa drone), 🎻 Pachelbel's Canon (count the 8 repeating chords, highlighted as they play), 🎉 Ode to Joy (hum and show the steps), 🌙 Brahms' lullaby. Each track has a reason in child words. Flow: "how do you feel?" (4 faces), then 1/3/5/10 minutes, then the task, then "how do you feel now?". Before and after (and the bell count) go to the learning graph. It plays even when background music is off, because the child chose it. |
| Honest claims | Music can change mood, breathing and attention for a while; it is not a treatment and does not make children smarter by itself (the "Mozart effect" did not replicate). That note is shown for grown-ups, and a test keeps words like "smarter", "IQ" and "cure" out of the tracks. |
| Music engine | `bgm.ts` now plays exact pieces (public domain: Brahms 1868, Pachelbel c. 1680, Beethoven 1824; written out in `listening.ts`) in any metre, a raga drone, and bells, and sends bar and bell events to the page. |
| Version 1.6.0 | Everything in this update (Note Rain, background music, stories, licensed voices, Listening room). |

**Malayalam (go-to-market #12): not started.** Melo has no Malayalam words, phrases, UI text or voices yet. What it needs: the language entry and words, the 150 phrases in 15 situations, recordings and voices (Piper has `ml_IN` voices whose licences still need checking; AI4Bharat Indic-Parler-TTS speaks Malayalam), and a native speaker's review. That is about 1 to 2 weeks, as planned.

Tests: 232 backend, 212 frontend (`listening.test.ts`: every task present, Hindi and Hinglish everywhere, no big brain claims, pieces loop in whole bars with their chords).

### Update 2026-11-24 (night, later): real recordings and binaural beats in the Listening room

| Change | Detail |
|---|---|
| 🎼 **Real recordings** (`frontend/public/listen/`, credits in `CREDITS.md`) | **Mozart, Sonata for Two Pianos K. 448, 1st movement** (the movement used in the 1993 study): a real two-piano performance from Wikimedia Commons (user Alton and a friend, 2005), **CC BY-SA 3.0**, credited on screen with a link. **Beethoven, Moonlight Sonata, 1st movement**: Paul Pitman for Musopen, **public domain**. Both converted from Ogg Vorbis to MP3 (128 kbps; Safari cannot play Ogg), with the peak set to -1 dB and nothing else changed. Tasks: "two pianos talking" for K. 448, "imagine moonlight on a lake" for the Moonlight. Melo explains first, then the recording plays (no talking over it), looped for the chosen 1 to 10 minutes, and fades out. |
| Honest K. 448 text | It says what the 1993 study found (a slightly better puzzle score for about 15 minutes) and what later studies found: enjoyable music lifts mood and alertness, and that helps thinking. It never says Mozart makes children smarter. |
| 🎧 **Binaural beats** (`audio/binaural.ts`) | A 200 Hz sine tone in the left ear and 200 Hz + the beat in the right ear, over very soft brown noise, with a 4-second fade in and 3-second fade out. Five bands: 😴 2 Hz delta (sleep), 🌙 6 Hz theta (daydream), 🍃 10 Hz alpha (calm and ready), ⚡ 15 Hz beta (alert), ✨ 40 Hz gamma (sharp attention). Each one says headphones are needed and that the research is mixed. The parent note says: headphones, low volume, at most 10 minutes, ask a doctor first if the child has epilepsy. **Nothing on screen flashes at the beat rate** (15 to 40 Hz flicker can trigger seizures); only the slow 10-second breathing circle moves. |
| Listening room layout | Three groups: 🦉 Melo plays, 🎼 Real recordings, 🎧 Binaural beats. |

Verified in the built app (headless Edge): both recordings load from `/listen/` (range requests, 206), play and pause on Stop; the binaural tracks run with no errors. Tests: 232 backend, 215 frontend (the recordings are shipped with licence, performer and Commons source; beat frequencies and the tone in each ear; the binaural text mentions headphones and the mixed evidence; nothing flashes).

## Update 2026-11-25: alphabets for every language, shlokas by real reciters, real videos

| Change | Detail |
|---|---|
| 🔤 **Alphabets** (`app/lang/alphabet.py`, `routers/alphabet.py`, `pages/Alphabet.tsx`) | Every letter of all 20 languages, **including rare and borrowed letters**. Hindi 68: vowels, अं अः अँ, consonants, then extra letters (ॠ ऌ ॡ ऍ ऑ ऩ ऱ ळ ऴ क़ ख़ ग़ ज़ ड़ ढ़ फ़ य़) and joined letters (क्ष त्र ज्ञ श्र). Marathi 62, Sanskrit 62, Gujarati 57, Bengali 55 (ৎ ড় ঢ় য়), Punjabi 53 (ਖ਼ ਗ਼ ਜ਼ ੜ ਫ਼ ਲ਼ ਸ਼ ੳ ੲ, tippi and addak), Tamil 40 (12 vowels, 18 consonants, ஃ, grantha letters, க்ஷ ஸ்ரீ), Telugu 57, Kannada 57, English 26, French 42 (all accents, æ œ), Spanish 33, German 30, Turkish 29, Russian 33, Arabic 36 (hamza seats, ة ى), Korean 40 (double consonants, compound vowels), Japanese 117 (hiragana, dakuten and handakuten, katakana), Mandarin 59 (pinyin initials and finals with teaching characters), Cantonese 51 (Jyutping). The Indian scripts are generated from the shared Unicode layout, so the same row is the same sound in every script; the nukta letters are stored in normal (NFC) form. |
| Four skills per letter | 📖 read (see the letter, choose its sound), 👂 listen (hear it, choose the letter), ✍️ write (trace it on the trace pad), 🗣️ speak (say it: speech recognition when the microphone is allowed, otherwise compare with Melo and self-check). Rounds of 5 letters in teaching order. A letter is taught first ("Learn this first": the letter, how it's said, a word from Melo's vocabulary that starts with it, with its picture). A letter-skill counts as learned after 2 right answers in a row, kept per child on the server (`/api/children/{id}/alphabet/{code}`), with progress dots on every letter and a learning-graph event every round. |
| 🔀 **Compare alphabets** | Any number of languages side by side, one row per sound (क ક ক க క ಕ ਕ К K ك ㄱ か are all "k"). It shows every sound, including the ones only one language has ("Only in Hindi"). Tap any letter to hear it. |
| 🔊 Letter voices | Letters are voiced items (`abc00`...`abc116`) in the same voice pipeline as words. They are pre-recorded with the licensed Piper voices where available, otherwise neural voices, and bundled. Korean consonants are said with a vowel (ㄱ → 가), Arabic letters by their names, Chinese by the teaching character. |
| 🕉️ **Shlokas and mantras by real reciters** (Listening room, `public/listen/chants/`) | 12 recordings by human reciters, all openly licensed (credits on screen and in `CREDITS.md`): the **Ramayana dhyāna ślokas** of Bāla Kāṇḍa and **Sundara Kāṇḍa** by **Sriram Ghanapāṭhī and Harisītārāma Mūrti Ghanapāṭhī** (CC BY-SA 2.5 India); **Sama Veda chants recorded at real Soma yagnas** (Vāmadevyam, Brihat Sāma, the cow-milking Dhenu Sāma, and Satrasya Ṛddhi by Dr. Girija Prasad Shadangi of Sri Venkateswara Vedic University; CC BY-SA 4.0); **Guru Stotram** by Swami Atmananda (CC0); **Purusha Sukta** (CC0); **Lingāṣṭakam** (CC0); **Mukunda Mālā** sung by **Bengaluru Nagaratnamma** on a historic gramophone record (public domain); **Gāyatrī** and **Mahāmṛtyuñjaya** recited with the tones (Free Art Licence). Each one has a hook ("the mantra with a cucumber in it!", "a song sung while a cow is milked!"), a reason a child understands, something to do while listening, and for the short ones the Devanagari, IAST and meaning. Gita 3.8 (CC BY-SA) could not be downloaded past Wikimedia's rate limit; it can be added later. |
| 🎬 **Real videos instead of drawn animation** (`public/listen/video/`, `subjects/videos.ts`) | 13 short clips from Wikimedia Commons, played muted and looping while a child listens, each credited under the clip: a pianist in concert (Mozart), a moonrise (Moonlight Sonata, lullaby), the aurora filmed from the ISS (NASA, binaural beats), a real yagna (Sama chants), Ganga aarti in Varanasi (Lingāṣṭakam), waves in Sri Lanka (Sundara Kāṇḍa, Calm waves), cows grazing (Dhenu Sāma), the Himalayas (Brihat Sāma), Earth from the ISS (Purusha Sukta, "climbing to the sky"), Deepavali diyas (Guru Stotram), a sunrise (Gāyatrī, Bhupali, Rāmāyaṇa), a waterfall (Mahāmṛtyuñjaya), and an 1899 film of the Varanasi ghats (Nagaratnamma's old recording). All public domain, CC0, CC BY or CC BY-SA; none NC or ND. Size: about 34 MB. The emoji "scenes" drawn earlier were removed. |

Content note: the hooks and meanings were written by the model; have them read by the teacher of Indian traditions with the rest of the Vedas content (go-to-market #4).

## Update 2026-11-25 (later): Move & yoga, Brain games, alphabet games, repeat counts

| Change | Detail |
|---|---|
| 🤸 **Move & yoga** (`pages/Move.tsx`, `subjects/move.ts`, `public/move/`) | **6 exercises** (star jumps, frog jumps, cheetah run on the spot, pretend skipping, dance and FREEZE, big cat stretch) and **15 yoga asanas** for 3+ (Tāḍāsana, Vṛkṣāsana, Trikoṇāsana, Sūrya Namaskāra slowly, Bhujaṅgāsana, Baddha Koṇāsana, Mārjāryāsana, Adho Mukha Śvānāsana, Bālāsana, Setubandhāsana, Naukāsana, Mālāsana, Siṃhāsana, Bhrāmarī, Śavāsana). Each has real media from Wikimedia Commons (no drawn animation): the step-by-step "Yoga with Modi" guides (CC BY 3.0, sound on request) for Tadasana, Vrikshasana and Trikonasana, a Surya Namaskar video, and for the animal poses a real video of the animal (a snake charmer's cobra in Jaipur, a butterfly, a cat yawning, lion cubs, a bee, a boat in Kerala, a baby frog) plus a real photo of the pose (Joseph Renger's yoga series and others). Exercises: NASA's "How Do Astronauts Exercise in Space?" (public domain), a cheetah sprint (CC0), children dancing, a child skipping. Every photo was viewed before use; one unsuitable photo (lion pose) was left out, and an adult fight-gym jumping-jack video was replaced by the NASA film. 61 MB, credits under every clip and in `public/move/CREDITS.md`. Flow: steps read aloud one at a time (Next), then "Let's do it!": a drum beat and counting for exercises (FREEZE calls in the dance), a soft chime with "breathe in / out" for holding a pose; stars, confetti, the reason why, a safety tip where needed, and a learning-graph note. |
| 🧠 **Brain games** (`pages/BrainGames.tsx`, `teaching/brain.ts`) | Six interactive games, each training one skill: 🃏 Memory match (working memory), 🎹 Copy the tune (four coloured music pads, a growing tune: sound memory), 🔍 Odd one out (attention), 🔮 What comes next? (pattern logic), ⭐ Catch the stars (tap stars, never clouds: focus and self-control), 🔢 Quick count (dots flash: number sense). Each starts very easy and goes up a level after a strong round (down after a hard one), saved per child; sounds, a streak, confetti and stars; every round goes to the learning graph. An honest note for grown-ups: practice helps, no game makes a child "smarter" on its own. |
| 🔤 Alphabet games | Every language lesson now starts with an "Alphabet games" entry, and the alphabet page leads with four game cards: 🎈 Balloon pop (listen), 🫧 Sound bubbles (read), ✨ Magic tracing (write), 🦜 Parrot talk (speak), with progress bars, floating balloons and bubbles, a streak and confetti. |
| 🔁 Repeat counts | Parents choose in Settings how many times a recording plays (1, 3, 5, 7, 11, 21, 108 or until the timer) and how many times each letter or word is said (1 to 5). |
| 🐞 Fixed | Listening room: Play was disabled until a mood face was tapped (now optional). Build smoke test: the sign-up step missed the parent agreement (broken since the legal update), so the Release workflow had been failing. |

