# Pixel Rhythms · Omni prototype 0.1.1

A ten-pad extension of KP's existing glass Jukebox. Same two playback decks, crossfades, master volume, waveform and stereo meters. Each pad can hold an existing loop, one Krea image, one Daydream reference, and an authored prompt. Musical variation in the generated soundtrack is intentional.

## Recovery update: make one attempt observable

This update keeps the ten-pad instrument and its existing IndexedDB database (`pixel-rhythms-omni-v1`). It does not modify `.env.local`, the server, SDK version, storage schema, or saved media assignments.

### Install into the existing Windows folder

1. With paid generation still disabled, stop the old server with **Ctrl+C**. If a Reactor session is already open, use **End Reactor** first.
2. Download this branch ZIP from GitHub and extract it into a temporary folder. Keep your existing `D:\Projects\reactor-jukebox\omni` folder.
3. From the extracted ZIP's `omni` folder, copy **only** `index.html`, `style.css`, and the entire `src` folder into `D:\Projects\reactor-jukebox\omni`, accepting replacement of these source files. Keep a backup copy of those three items if you have local source edits. Do not replace `.env.local` or delete any browser data. All other files can stay as they are; dependencies have not changed.
4. In PowerShell:

   ```powershell
   cd D:\Projects\reactor-jukebox\omni
   npm.cmd run dev
   ```

5. Open **http://127.0.0.1:8093** in the same browser/profile as before, then refresh. The heading should say **0.1.1**. Keep this exact host and port to retain the same browser assignments.

For a Git checkout with no uncommitted edits, pulling `codex/omni-jukebox-prototype` is an alternative to copying source files. Do not reset or clean your local checkout.

### First check: no credits

- **Arrange pads** opens the existing selected-pad inputs. The new **Generate selected pad** button sits beside those inputs. It requests one new passage when paid generation is enabled; it works regardless of the toolbar mode. Pads still generate in **Generate variations** mode and play clips in **Play loops** mode.
- Leave **Enable paid generation** unchecked. Use **Check inputs (no credits)**. This checks assigned fields, image decoding/dimensions, audio metadata/duration, and browser recording support without connecting to Reactor or uploading files. Passing is local readiness, not proof of server acceptance.
- An empty Daydream field shows **Choose this pad’s Daydream audio reference** in the missing-input list and in the result beside the button. A pad-triggered validation failure opens the relevant editor and scrolls this result into view.
- **Activity log** below the editor keeps the latest 200 timestamped events for this visit, newest first. **Copy log** copies those events for review/sharing. Logs are not saved across reloads. They do not intentionally include tokens, upload references, or prompt bodies; URL/token-like strings in error descriptions are redacted. Review descriptions before sharing.
- The log separates **Local validation → Connection → Upload → Request → Request acceptance → Generation → Reception → Capture → Playback**. These are observations, not promises that all stages will succeed. Uploads are logged separately. `clip_queued` is acceptance, `clip_generated` is readiness, `clip_finished` means media was sent by Reactor, and a nonempty capture still needs to play in the local Jukebox.
- Do not enable paid generation until we agree a small limit and verify current pricing. This update does not authorize or perform a paid test. To finish the free check, use **End Reactor**, then **Ctrl+C** in PowerShell.

### Verification for this update

- `npm run build` and all **17** automated tests passed, including simulated upload failure, refused/undefined enqueue, generation failure after acceptance, and simulated capture-stage reporting. Simulated media is not evidence that real Reactor capture works.
- Headless Chromium check with synthetic local media: all ten pads present; image + prompt but missing audio produces an in-view error; complete inputs pass the free check; paid-disabled Generate stops before token exchange; image/prompt assignments survive reload; two local clips play and crossfade. Zero token requests and zero browser errors in that check.
- The missing-input editor and log were inspected in a browser screenshot. Windows/iPad rendering and real service connection, reference uploads, generation, stream capture, and generated-take playback remain unverified. No paid run was performed.
- SDK **3.1.0** remains pinned. Reply/refusal and track behavior were checked against its installed declarations and the current [official Omni schema](https://docs.reactor.inc/model-api-reference/fast-h3-omni/schema) / [tutorial](https://docs.reactor.inc/model-api-reference/fast-h3-omni/tutorial). The [project handoff](https://app.notion.com/p/3e41f16ba962817d8144cdd570f83673) and its BPVR callback/loading source informed the separation of stages; archived code was not treated as verified SDK code.

## First run: arrange and play, with no API key

Requires Node 22+ (your recorded Node 24 setup is suitable). Download this branch as a ZIP and extract it to a new folder on D:, or clone this branch. Open PowerShell in this `omni` subfolder:

```powershell
npm.cmd install
npm.cmd run dev
```

Open http://127.0.0.1:8093. Keep the terminal open.

1. Open **Arrange pads**. All ten pads are present; keep the inherited names or rename them.
2. Choose a pad and assign its **Existing loop**, **Krea image**, **Daydream reference**, and **Direction**. Start by furnishing two or three pads, then fill the others when ready.
3. Use **Save pad**. **Play existing loop** auditions the chosen source. In **Play loops** mode the performance pads use the newest generated take if one exists, otherwise the existing clip.
4. Try the 0.5, 1.5, and 3-second fades. Mouse/touch and keys 1–5 / Q–T use the same actions.

No generation happens on opening the page, loading media, playing local loops, or changing a prompt.

## What to prepare

Per pad: one existing MP4/WebM (optional for generation, useful while waiting), one JPEG/PNG/WebP, one 2–15-second audio excerpt, and your authored prompt. Images/audio references must each be at most 25 MiB. Use an image below 25 megapixels and between 1:4 and 4:1.

Use `<Picture 1>` and `<Audio 1>` if helpful in the prompt. The app appends a short sentence assigning the picture as visual guidance and the audio as music guidance. It does not use an LLM to rewrite your prompt. Requested durations are the model's supported values, not arbitrary musical bar lengths.

All ten presets share the same implementation; there are no fake example generations and no placeholder media presented as yours. The layout is intended to preserve the existing instrument rather than redesign it.

## Enable Reactor later

First agree a small paid-test limit and check current Reactor pricing/account usage. This prototype has **no dollar spending cap**. No paid run was performed during source development.

Copy `.env.example` to `.env.local` in this `omni` folder. Privately copy the `REACTOR_API_KEY` value from your working Omni project's `.env.local` into this new file. Do not upload either environment file to GitHub or chat. Restart `npm.cmd run dev` after changing it.

In the app choose **Generate variations**, open **Arrange pads**, enable paid generation there only after agreeing a limit, then press a configured pad or **Generate selected pad**. One request is allowed at a time. It uploads that pad's two references, generates a fresh clip, receives the clip offstage, and crossfades the recorded result into the two-deck player. Your current local loop keeps playing while this happens. Repeated generation requests use the model's advancing seed; this app does not pin it.

The five-minute client session timer calls disconnect. It is a rehearsal convenience, not a billing guarantee; in-flight requests may still cost money. **End Reactor** explicitly disconnects and keeps local playback usable. To finish, click **End Reactor**, then press **Ctrl+C** in PowerShell. Closing a tab attempts cleanup, but is not the recommended shutdown method.

## Saving

Pad configuration and selected file copies use IndexedDB in this browser, tied to this local address. Use the same browser and `127.0.0.1:8093`. Browser storage can be cleared/evicted; keep original media backed up.

**Export prompt settings** downloads names/prompts/durations and reference filenames, not the media. Importing settings keeps current media assignments. Generated takes are held only for this page visit. **Save latest take** downloads the video and its prompt record; the browser may ask to allow the second download. Assign a saved take as an Existing loop to use it across visits.

## What is and is not verified

- Build and automated checks cover preset import, asynchronous clip matching, local token-route boundaries, and serving the SDK's WebAssembly asset.
- No paid generation, end-to-end Reactor media capture, or Windows laptop playback test has been performed. The 0.1.1 local browser checks are listed above.
- The recording uses browser MediaRecorder over Reactor's received video/audio tracks. It allows a short drain interval after `clip_finished`, which reports sent media. Captures may contain leading/trailing padding; audio/video alignment, capture format, seams and performance require testing. Seamless loops and beat alignment are not claimed.
- This version receives a complete passage before fading it in. Waiting includes model generation plus playback/capture time. Direct stream transitions are a later experiment.
- Reference audio steers the generated soundtrack; it is not substituted with the original Daydream track.
- No X delivery, physical MIDI integration, public hosting, or continuation between pads is included yet.
- The local server binds to loopback and serves an explicit file allowlist. It should stay on your laptop. The API key remains on the server; the browser receives only a scoped token. Selected references go to Reactor only when you request generation.

## Code map

- `index.html`, `style.css`: the ten-pad performance surface and collapsible setup.
- `src/player.js`, `src/meters.js`: local playback, crossfades, and audio feedback adapted from the original Jukebox.
- `src/app.js`, `src/pads.js`, `src/store.js`: pad actions, prompt configuration, and browser persistence.
- `src/activity.js`: bounded timestamped activity log with URL/token redaction.
- `src/reactor.js`, `src/events.js`: session lifecycle, reference uploads, matched generation events, and media capture.
- `server.mjs`: local files and server-side token exchange.
- `build.mjs`: bundles the browser code and copies its required WebAssembly asset.

Pinned transport: `@reactor-team/js-sdk` 3.1.0. This separate prototype does not change the dependencies of your existing local Reactor projects. The original root `index.html` remains the baseline.

To check after editing:

```powershell
npm.cmd run build
npm.cmd test
```

References: [Omni schema](https://docs.reactor.inc/model-api-reference/fast-h3-omni/schema), [Omni tutorial](https://docs.reactor.inc/model-api-reference/fast-h3-omni/tutorial), [original Jukebox baseline](https://github.com/kprasad1221/pixel-rhythms-jukebox/tree/18a5b4a01931187f9d6765118e0677934aa2b1de).
